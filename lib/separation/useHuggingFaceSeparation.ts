"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { parseStoredZip, ZipParseError } from "./unzip";
import { MAX_INPUT_MB, SAMPLE_RATE, SOURCES, type Source } from "./constants";
import type { SeparationOptions, SeparationResult } from "./useSeparation";
import type { SeparationProviderHook, SeparationProviderState } from "./provider";

export type HfStage =
  | "idle"
  | "validating"
  | "uploading"
  | "queued"
  | "gpu-processing"
  | "finalizing"
  | "done"
  | "cancelled"
  | "error";

// "quota" is distinct from "rate-limit": rate-limit means too many requests
// in a short window (retry soon); quota means Hugging Face's *daily*
// GPU-minute budget for the whole app is exhausted (retry tomorrow, or use
// on-device instead) — conflating the two would show misleading "try again
// in a bit" copy for a problem that won't resolve for hours.
export type HfErrorKind = "validation" | "auth" | "rate-limit" | "quota" | "network" | "server";

export interface HfSeparationState extends SeparationProviderState {
  stage: HfStage;
  uploadProgress: { loaded: number; total: number } | null;
  errorKind: HfErrorKind | null;
}

const initialState: HfSeparationState = {
  stage: "idle",
  uploadProgress: null,
  elapsedMs: 0,
  error: null,
  errorKind: null,
  result: null,
};

// The server always runs the full htdemucs_ft bag in one pass (unlike the
// client's 4 separate ONNX passes) — every returned stem is specialist
// quality, never the "standard" fallback the client can produce. Mirrors
// useServerSeparation.ts's FULL_QUALITY exactly.
const FULL_QUALITY = { drums: "enhanced", bass: "enhanced", other: "enhanced" } as const;

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 20 * 60 * 1000; // generous ceiling over MAX_DURATION_SECONDS + queue/processing overhead

export function useHuggingFaceSeparation(): SeparationProviderHook<HfSeparationState> {
  const [state, setState] = useState<HfSeparationState>(initialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);
  const pollStartRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPoll = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    clearPoll();
    clearTimer();
    setState((s) => ({ ...s, stage: "cancelled" }));
  }, [clearPoll, clearTimer]);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    abortRef.current?.abort();
    clearPoll();
    clearTimer();
    setState(initialState);
  }, [clearPoll, clearTimer]);

  const start = useCallback(
    async (file: File, options: SeparationOptions = {}) => {
      cancelledRef.current = false;
      clearPoll();
      clearTimer();
      setState({ ...initialState, stage: "validating" });

      if (file.size > MAX_INPUT_MB * 1024 * 1024) {
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind: "validation",
          error: `File is larger than ${MAX_INPUT_MB}MB.`,
        }));
        return;
      }

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState((s) => ({ ...s, elapsedMs: Date.now() - startTimeRef.current }));
      }, 200);

      setState((s) => ({ ...s, stage: "uploading", uploadProgress: { loaded: 0, total: file.size } }));

      const uploadController = new AbortController();
      abortRef.current = uploadController;

      let blobUrl: string;
      try {
        const blob = await upload(file.name, file, {
          access: "private",
          handleUploadUrl: "/api/hf-blob-upload",
          abortSignal: uploadController.signal,
          onUploadProgress: ({ loaded, total }) => {
            setState((s) => ({ ...s, uploadProgress: { loaded, total } }));
          },
        });
        blobUrl = blob.url;
      } catch (err) {
        clearTimer();
        if (cancelledRef.current) return;
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind: "network",
          error: err instanceof Error ? err.message : "Couldn't upload the file.",
        }));
        return;
      }
      if (cancelledRef.current) return;

      setState((s) => ({ ...s, stage: "queued" }));

      let jobId: string;
      try {
        const startController = new AbortController();
        abortRef.current = startController;
        const startRes = await fetch("/api/hf-separate/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl,
            options: { drums: options.drums ?? true, bass: options.bass ?? true, other: options.other ?? true },
          }),
          signal: startController.signal,
        });
        if (!startRes.ok) {
          const body = (await startRes.json().catch(() => null)) as { error?: string; errorKind?: HfErrorKind } | null;
          throw Object.assign(new Error(body?.error ?? `Fast Mode failed (HTTP ${startRes.status}).`), {
            errorKind: body?.errorKind ?? "server",
          });
        }
        const body = (await startRes.json()) as { jobId: string };
        jobId = body.jobId;
      } catch (err) {
        clearTimer();
        if (cancelledRef.current) return;
        const errorKind = (err as { errorKind?: HfErrorKind })?.errorKind ?? "network";
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind,
          error: err instanceof Error ? err.message : "Couldn't reach the Fast Mode server.",
        }));
        return;
      }
      if (cancelledRef.current) return;

      pollStartRef.current = Date.now();

      const poll = async (): Promise<void> => {
        if (cancelledRef.current) return;
        if (Date.now() - pollStartRef.current > MAX_POLL_MS) {
          clearTimer();
          setState((s) => ({
            ...s,
            stage: "error",
            errorKind: "server",
            error: "Fast Mode timed out. Try again, or use on-device instead.",
          }));
          return;
        }

        const pollController = new AbortController();
        abortRef.current = pollController;
        let res: Response;
        try {
          res = await fetch(`/api/hf-separate/status?jobId=${encodeURIComponent(jobId)}`, {
            signal: pollController.signal,
          });
        } catch {
          if (cancelledRef.current) return;
          pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        if (cancelledRef.current) return;

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/zip")) {
          setState((s) => ({ ...s, stage: "finalizing" }));
          try {
            const zipBuffer = await res.arrayBuffer();
            const files = parseStoredZip(zipBuffer);
            const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
            const decoded = new Map<Source, AudioBuffer>();
            try {
              for (const [name, data] of files) {
                const source = name.replace(/\.(wav|mp3)$/i, "");
                if (!(SOURCES as readonly string[]).includes(source)) continue;
                decoded.set(source as Source, await ctx.decodeAudioData(data.slice(0)));
              }
            } finally {
              await ctx.close();
            }
            if (decoded.size === 0) throw new Error("The server didn't return any stems.");

            const canonicalLength = Math.min(...Array.from(decoded.values(), (b) => b.length));
            const stems = {} as Record<Source, AudioBuffer>;
            for (const [source, buf] of decoded) {
              const canonical = new AudioBuffer({ numberOfChannels: 2, length: canonicalLength, sampleRate: SAMPLE_RATE });
              canonical.copyToChannel(buf.getChannelData(0).subarray(0, canonicalLength), 0);
              canonical.copyToChannel(buf.getChannelData(1).subarray(0, canonicalLength), 1);
              stems[source] = canonical;
            }

            const quality = { ...FULL_QUALITY } as SeparationResult["quality"];
            for (const source of Object.keys(FULL_QUALITY) as (keyof typeof FULL_QUALITY)[]) {
              if (!stems[source]) quality[source] = "standard";
            }

            clearTimer();
            setState((s) => ({
              ...s,
              stage: "done",
              result: { stems, duration: canonicalLength / SAMPLE_RATE, quality },
            }));
          } catch (err) {
            clearTimer();
            setState((s) => ({
              ...s,
              stage: "error",
              errorKind: "server",
              error:
                err instanceof ZipParseError || err instanceof Error ? err.message : "Couldn't read the server's response.",
            }));
          }
          return;
        }

        const body = (await res.json().catch(() => null)) as
          | { status: "queued" | "processing" }
          | { status: "error"; error: string; errorKind: HfErrorKind }
          | null;

        if (!body) {
          pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        if (body.status === "error") {
          clearTimer();
          setState((s) => ({ ...s, stage: "error", errorKind: body.errorKind, error: body.error }));
          return;
        }

        setState((s) => ({ ...s, stage: body.status === "processing" ? "gpu-processing" : "queued" }));
        pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      };

      void poll();
    },
    [clearPoll, clearTimer]
  );

  return { state, start, cancel, reset };
}
