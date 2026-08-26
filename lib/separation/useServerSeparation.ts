"use client";

import { useCallback, useRef, useState } from "react";
import { parseStoredZip, ZipParseError } from "./unzip";
import { MODAL_SEPARATE_URL } from "./serverConstants";
import { MAX_INPUT_MB, SAMPLE_RATE, SOURCES, type Source } from "./constants";
import type { SeparationOptions, SeparationResult } from "./useSeparation";

export type ServerStage =
  | "idle"
  | "validating"
  | "uploading"
  | "processing"
  | "finalizing"
  | "done"
  | "cancelled"
  | "error";

export type ServerErrorKind = "validation" | "auth" | "rate-limit" | "network" | "server";

export interface ServerSeparationState {
  stage: ServerStage;
  uploadProgress: { loaded: number; total: number } | null;
  elapsedMs: number;
  error: string | null;
  errorKind: ServerErrorKind | null;
  result: SeparationResult | null;
}

const initialState: ServerSeparationState = {
  stage: "idle",
  uploadProgress: null,
  elapsedMs: 0,
  error: null,
  errorKind: null,
  result: null,
};

// The server always runs the full htdemucs_ft bag in one pass (unlike the
// client's 4 separate ONNX passes) — every returned stem is specialist
// quality, never the "standard" fallback the client can produce.
const FULL_QUALITY = { drums: "enhanced", bass: "enhanced", other: "enhanced" } as const;

export function useServerSeparation() {
  const [state, setState] = useState<ServerSeparationState>(initialState);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    clearTimer();
    setState((s) => ({ ...s, stage: "cancelled" }));
  }, [clearTimer]);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    clearTimer();
    setState(initialState);
  }, [clearTimer]);

  const start = useCallback(
    async (file: File, options: SeparationOptions = {}) => {
      clearTimer();
      setState({ ...initialState, stage: "validating" });

      if (!MODAL_SEPARATE_URL) {
        setState((s) => ({ ...s, stage: "error", errorKind: "server", error: "Fast Mode isn't configured." }));
        return;
      }
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

      // Fetch a short-lived signed token instead of carrying a static secret
      // in the client bundle — see web/app/api/fast-mode-token/route.ts.
      let token: string;
      try {
        const tokenRes = await fetch("/api/fast-mode-token");
        if (!tokenRes.ok) {
          clearTimer();
          setState((s) => ({ ...s, stage: "error", errorKind: "server", error: "Fast Mode isn't configured." }));
          return;
        }
        token = ((await tokenRes.json()) as { token: string }).token;
      } catch {
        clearTimer();
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind: "network",
          error: "Couldn't reach the Fast Mode server. Check your connection, or use on-device instead.",
        }));
        return;
      }

      setState((s) => ({ ...s, stage: "uploading", uploadProgress: { loaded: 0, total: file.size } }));

      const form = new FormData();
      form.append("file", file);
      form.append(
        "options",
        JSON.stringify({
          drums: options.drums ?? true,
          bass: options.bass ?? true,
          other: options.other ?? true,
        })
      );

      const zipBuffer = await new Promise<ArrayBuffer | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("POST", MODAL_SEPARATE_URL, true);
        xhr.responseType = "arraybuffer";
        xhr.setRequestHeader("X-Fast-Mode-Token", token);

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          setState((s) => ({ ...s, uploadProgress: { loaded: e.loaded, total: e.total } }));
        };
        xhr.upload.onload = () => setState((s) => ({ ...s, stage: "processing" }));

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.response as ArrayBuffer);
            return;
          }
          let detail: string | null = null;
          try {
            const text = new TextDecoder().decode(xhr.response as ArrayBuffer);
            detail = (JSON.parse(text) as { detail?: string }).detail ?? null;
          } catch {
            // Response wasn't JSON — fall back to a generic message below.
          }
          const kind: ServerErrorKind = xhr.status === 401 ? "auth" : xhr.status === 429 ? "rate-limit" : "server";
          const fallback =
            xhr.status === 401
              ? "Fast Mode's session expired — try again."
              : xhr.status === 429
                ? "Fast Mode is rate-limited right now — try again in a bit, or use on-device instead."
                : `Fast Mode failed (HTTP ${xhr.status}).`;
          setState((s) => ({ ...s, stage: "error", errorKind: kind, error: detail ?? fallback }));
          resolve(null);
        };
        xhr.onerror = () => {
          setState((s) => ({
            ...s,
            stage: "error",
            errorKind: "network",
            error: "Couldn't reach the Fast Mode server. Check your connection, or use on-device instead.",
          }));
          resolve(null);
        };
        xhr.onabort = () => resolve(null);

        xhr.send(form);
      });

      if (!zipBuffer) {
        clearTimer();
        return;
      }

      setState((s) => ({ ...s, stage: "finalizing" }));
      try {
        const files = parseStoredZip(zipBuffer);
        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
        const decoded = new Map<Source, AudioBuffer>();
        try {
          for (const [name, data] of files) {
            const source = name.replace(/\.mp3$/i, "");
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
          error: err instanceof ZipParseError || err instanceof Error ? err.message : "Couldn't read the server's response.",
        }));
      }
    },
    [clearTimer]
  );

  return { state, start, cancel, reset };
}
