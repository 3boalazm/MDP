"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeForSeparation, DurationError } from "./decode";
import { loadModelBytes, ModelLoadError } from "./modelSource";
import { getCachedProfile, prioritizeCachedProfile, setCachedProfile } from "./profileCache";
import {
  ATTEMPT_PROFILES_NO_GPU,
  ATTEMPT_PROFILES_WITH_GPU,
  ATTEMPT_PROFILES_WITH_GPU_SUBSEQUENT,
  BASS_MODEL_URL,
  DRUMS_MODEL_URL,
  MAX_INPUT_MB,
  MODEL_NAME,
  MODEL_URL,
  OTHER_MODEL_URL,
  SAMPLE_RATE,
  SOURCES,
  type EngineBackend,
  type SessionProfile,
  type Source,
  type StemBuffers,
  type WorkerOutMessage,
} from "./constants";

export type Stage =
  | "idle"
  | "validating"
  | "decoding"
  | "loading-model"
  | "loading-session"
  | "processing"
  | "finalizing"
  | "done"
  | "cancelled"
  | "error";

export type Pass = "main" | "drums" | "bass" | "other";
export type SpecialistSource = "drums" | "bass" | "other";

export type ErrorKind = "validation" | "decode" | "engine";

// "enhanced": that source's specialist pass ran and succeeded.
// "standard": the specialist was requested but failed, so this source kept
//   the main pass's weaker channel instead — never silently claimed as enhanced.
// "skipped": the caller chose not to run that specialist at all (faster).
export type StemQuality = "enhanced" | "standard" | "skipped";

export interface SeparationOptions {
  // Which specialist passes to run, in addition to the always-required main
  // (vocals) pass. Defaults to true (run all) for each.
  drums?: boolean;
  bass?: boolean;
  other?: boolean;
}

export interface SeparationResult {
  stems: Record<Source, AudioBuffer>;
  duration: number;
  quality: Record<SpecialistSource, StemQuality>;
}

export interface SeparationState {
  stage: Stage;
  pass: Pass;
  isMono: boolean;
  modelProgress: { loaded: number; total: number } | null;
  chunkProgress: { current: number; total: number } | null;
  engine: EngineBackend | null;
  elapsedMs: number;
  etaMs: number | null;
  error: string | null;
  errorKind: ErrorKind | null;
  result: SeparationResult | null;
}

const initialState: SeparationState = {
  stage: "idle",
  pass: "main",
  isMono: false,
  modelProgress: null,
  chunkProgress: null,
  engine: null,
  elapsedMs: 0,
  etaMs: null,
  error: null,
  errorKind: null,
  result: null,
};

type PassOutcome =
  | { outcome: "done"; stems: StemBuffers }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

// A worker that silently stops responding (observed: a WASM Aborted() inside
// onnxruntime-web that doesn't always propagate as a catchable error — see
// https://github.com/3boalazm/MDP/issues/1) would otherwise hang runAttempt's
// promise forever, freezing the UI with no way out. This is a stall
// detector, not a total-duration timeout: it resets on every message the
// worker sends (stage change, chunk progress, …), so a run that's genuinely
// still working — just slow on constrained hardware — is never killed for
// taking a while, only for going completely silent.
const STALL_TIMEOUT_MS = 90_000;

export function useSeparation() {
  const [state, setState] = useState<SeparationState>(initialState);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const chunkStartRef = useRef(0);
  const lastEngineRef = useRef<EngineBackend | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const terminateWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      terminateWorker();
      abortRef.current?.abort();
    };
  }, [clearTimer, terminateWorker]);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    clearTimer();
    timerRef.current = setInterval(() => {
      setState((s) => ({ ...s, elapsedMs: Date.now() - startRef.current }));
    }, 200);
  }, [clearTimer]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    workerRef.current?.postMessage({ type: "cancel" });
    terminateWorker();
    clearTimer();
    setState((s) => ({ ...s, stage: "cancelled" }));
  }, [terminateWorker, clearTimer]);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    clearTimer();
    terminateWorker();
    setState(initialState);
  }, [clearTimer, terminateWorker]);

  const start = useCallback(
    async (file: File, options: SeparationOptions = {}) => {
      const wantDrums = options.drums ?? true;
      const wantBass = options.bass ?? true;
      const wantOther = options.other ?? true;
      cancelledRef.current = false;
      terminateWorker();
      clearTimer();
      setState({ ...initialState, stage: "validating" });
      startTimer();

      if (file.size > MAX_INPUT_MB * 1024 * 1024) {
        clearTimer();
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind: "validation",
          error: `File is larger than ${MAX_INPUT_MB}MB.`,
        }));
        return;
      }

      let mixL: Float32Array;
      let mixR: Float32Array;
      let isMono: boolean;
      try {
        setState((s) => ({ ...s, stage: "decoding" }));
        const decoded = await decodeForSeparation(file);
        mixL = decoded.left;
        mixR = decoded.right;
        isMono = decoded.isMono;
      } catch (err) {
        clearTimer();
        if (cancelledRef.current) return;
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind: err instanceof DurationError ? "engine" : "decode",
          error: err instanceof Error ? err.message : "Failed to decode audio.",
        }));
        return;
      }
      if (cancelledRef.current) return;
      setState((s) => ({ ...s, isMono }));

      // Each attempt runs in its own fresh worker (its own WASM linear
      // memory instance). Trying multiple profiles sequentially in the SAME
      // worker was found to compound memory pressure and fail attempts with
      // std::bad_alloc even when tried alone would have fit — see
      // https://github.com/microsoft/onnxruntime/issues/10957.
      const runAttempt = (profile: SessionProfile, modelBytes: ArrayBuffer) =>
        new Promise<PassOutcome>((resolve) => {
          const worker = new Worker(new URL("../../workers/separationWorker.ts", import.meta.url), {
            type: "module",
          });
          workerRef.current = worker;

          let settled = false;
          let stallTimer: ReturnType<typeof setTimeout>;
          const settle = (outcome: PassOutcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(stallTimer);
            resolve(outcome);
          };
          const armStallTimer = () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => {
              terminateWorker();
              settle({
                outcome: "error",
                message: "The separation engine stopped responding. Your device or browser may be low on memory.",
              });
            }, STALL_TIMEOUT_MS);
          };
          armStallTimer();

          worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
            armStallTimer(); // any message at all means the worker is still alive
            const msg = event.data;
            switch (msg.type) {
              case "engine":
                lastEngineRef.current = msg.backend;
                setState((s) => ({ ...s, engine: msg.backend }));
                break;
              case "stage":
                if (msg.stage === "processing") chunkStartRef.current = Date.now();
                setState((s) => ({ ...s, stage: msg.stage }));
                break;
              case "chunk-progress": {
                const elapsed = Date.now() - chunkStartRef.current;
                const avgPerChunk = elapsed / msg.chunk;
                const remaining = msg.totalChunks - msg.chunk;
                setState((s) => ({
                  ...s,
                  chunkProgress: { current: msg.chunk, total: msg.totalChunks },
                  etaMs: remaining > 0 ? Math.round(avgPerChunk * remaining) : 0,
                }));
                break;
              }
              case "done":
                terminateWorker();
                settle({ outcome: "done", stems: msg.stems });
                break;
              case "cancelled":
                terminateWorker();
                settle({ outcome: "cancelled" });
                break;
              case "error":
                terminateWorker();
                settle({ outcome: "error", message: msg.message });
                break;
            }
          };

          worker.onerror = (event) => {
            terminateWorker();
            settle({ outcome: "error", message: event.message || "The separation worker crashed unexpectedly." });
          };

          // mixL/mixR are NOT transferred — reused for the drums pass and to
          // derive the instrumental afterward.
          worker.postMessage({ type: "run", modelBytes, mixL, mixR, profile }, [modelBytes]);
        });

      const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;

      const runModelPass = async (
        modelUrl: string,
        pass: Pass,
        profiles: SessionProfile[],
        onProfileDone?: (profile: SessionProfile) => void
      ): Promise<PassOutcome> => {
        setState((s) => ({ ...s, pass }));
        let lastMessage = "The AI model couldn't run on this device.";
        for (const profile of profiles) {
          if (cancelledRef.current) return { outcome: "cancelled" };

          setState((s) => ({ ...s, stage: "loading-model", modelProgress: { loaded: 0, total: 0 } }));
          const controller = new AbortController();
          abortRef.current = controller;
          let bytes: ArrayBuffer;
          try {
            bytes = await loadModelBytes(
              modelUrl,
              (loaded, total) => setState((s) => ({ ...s, modelProgress: { loaded, total } })),
              controller.signal
            );
          } catch (err) {
            if (cancelledRef.current) return { outcome: "cancelled" };
            return {
              outcome: "error",
              message: err instanceof ModelLoadError ? err.message : "Couldn't download the separation model.",
            };
          }
          if (cancelledRef.current) return { outcome: "cancelled" };

          const result = await runAttempt(profile, bytes);
          if (result.outcome !== "error") {
            if (result.outcome === "done") onProfileDone?.(profile);
            return result;
          }
          lastMessage = result.message;
        }
        return { outcome: "error", message: lastMessage };
      };

      // Skip straight to whichever profile actually worked on this device
      // last time (see profileCache.ts) instead of re-paying the cost of a
      // profile known to fail here — every other candidate stays available
      // as a fallback in its original order.
      const cachedProfile = getCachedProfile();

      const mainResult = await runModelPass(
        MODEL_URL,
        "main",
        prioritizeCachedProfile(hasWebGPU ? ATTEMPT_PROFILES_WITH_GPU : ATTEMPT_PROFILES_NO_GPU, cachedProfile),
        setCachedProfile
      );
      if (mainResult.outcome === "cancelled") {
        clearTimer();
        setState((s) => ({ ...s, stage: "cancelled" }));
        return;
      }
      if (mainResult.outcome === "error") {
        clearTimer();
        setState((s) => ({ ...s, stage: "error", errorKind: "engine", error: mainResult.message }));
        return;
      }

      const combinedStems: StemBuffers = { ...mainResult.stems };
      const quality: Record<SpecialistSource, StemQuality> = {
        drums: "skipped",
        bass: "skipped",
        other: "skipped",
      };

      const specialistPasses: { url: string; pass: Pass; source: SpecialistSource; want: boolean }[] = [
        { url: DRUMS_MODEL_URL, pass: "drums", source: "drums", want: wantDrums },
        { url: BASS_MODEL_URL, pass: "bass", source: "bass", want: wantBass },
        { url: OTHER_MODEL_URL, pass: "other", source: "other", want: wantOther },
      ];

      for (const { url, pass, source, want } of specialistPasses) {
        if (!want) continue; // quality[source] stays "skipped"
        if (cancelledRef.current) {
          clearTimer();
          setState((s) => ({ ...s, stage: "cancelled" }));
          return;
        }

        // The previous pass's worker (and its GPU context, if it used
        // webgpu) was just terminated. Browsers can lag reclaiming GPU
        // memory after a context is destroyed — starting the next pass's
        // webgpu session immediately after was observed to fail (falls
        // back to much-slower wasm) where it succeeds standalone. A short
        // pause lets that reclaim happen first. Skipped if the previous
        // pass was already on wasm — no GPU context to reclaim.
        if (lastEngineRef.current === "webgpu") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (cancelledRef.current) {
          clearTimer();
          setState((s) => ({ ...s, stage: "cancelled" }));
          return;
        }

        const result = await runModelPass(
          url,
          pass,
          prioritizeCachedProfile(
            hasWebGPU ? ATTEMPT_PROFILES_WITH_GPU_SUBSEQUENT : ATTEMPT_PROFILES_NO_GPU,
            cachedProfile
          )
        );
        if (result.outcome === "cancelled") {
          clearTimer();
          setState((s) => ({ ...s, stage: "cancelled" }));
          return;
        }
        // Each specialist is a quality bonus, not required — if one fails,
        // that source just keeps its weaker channel from the main pass
        // rather than failing the whole separation.
        if (result.outcome === "done") {
          combinedStems[source] = result.stems[source];
          quality[source] = "enhanced";
        } else {
          quality[source] = "standard";
        }
      }

      const totalLen = mixL.length;
      const stems = {} as Record<Source, AudioBuffer>;
      for (const name of SOURCES) {
        const { L, R } = combinedStems[name];
        const buf = new AudioBuffer({ numberOfChannels: 2, length: totalLen, sampleRate: SAMPLE_RATE });
        buf.copyToChannel(L as Float32Array<ArrayBuffer>, 0);
        buf.copyToChannel(R as Float32Array<ArrayBuffer>, 1);
        stems[name] = buf;
      }

      clearTimer();
      setState((s) => ({
        ...s,
        stage: "done",
        result: { stems, duration: totalLen / SAMPLE_RATE, quality },
      }));
    },
    [terminateWorker, clearTimer, startTimer]
  );

  return { state, start, cancel, reset, modelName: MODEL_NAME };
}
