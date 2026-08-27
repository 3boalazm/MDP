"use client";

import { useCallback, useRef, useState } from "react";
import { MODAL_TRIA_URL } from "./triaConstants";
import { MAX_INPUT_MB } from "./constants";

export type TriaStage = "idle" | "validating" | "uploading" | "generating" | "done" | "cancelled" | "error";

export type TriaErrorKind = "validation" | "auth" | "rate-limit" | "network" | "server";

export interface TriaGenerationState {
  stage: TriaStage;
  uploadProgress: { loaded: number; total: number } | null;
  elapsedMs: number;
  error: string | null;
  errorKind: TriaErrorKind | null;
  resultUrl: string | null;
}

const initialState: TriaGenerationState = {
  stage: "idle",
  uploadProgress: null,
  elapsedMs: 0,
  error: null,
  errorKind: null,
  resultUrl: null,
};

// Generous — a cold container (loading TRIA's ~459MB of weights + gradio/
// audiotools/librosa imports) plus chunked generation of a long track can
// legitimately take minutes; see web/server/tria_app.py's own 1800s function
// timeout. This is a client-side XHR timeout, not a Vercel function one —
// the browser calls Modal directly (MODAL_TRIA_URL is public), so there's no
// serverless duration cap in the middle of this request at all.
const XHR_TIMEOUT_MS = 25 * 60 * 1000;

export function useTriaGeneration() {
  const [state, setState] = useState<TriaGenerationState>(initialState);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const prevUrlRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokePrevUrl = useCallback(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
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
    revokePrevUrl();
    setState(initialState);
  }, [clearTimer, revokePrevUrl]);

  // rhythmFile: the audio to base the generated drums' timing on (typically
  // the user's already-uploaded track). timbreFile is optional — the server
  // falls back to a bundled example drum kit sound when omitted.
  const start = useCallback(
    async (rhythmFile: File, timbreFile?: File) => {
      clearTimer();
      revokePrevUrl();
      setState({ ...initialState, stage: "validating" });

      if (!MODAL_TRIA_URL) {
        setState((s) => ({ ...s, stage: "error", errorKind: "server", error: "Drum generation isn't configured." }));
        return;
      }
      if (rhythmFile.size > MAX_INPUT_MB * 1024 * 1024) {
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

      // Same short-lived token scheme as Fast Mode — reuses the same route
      // and shared secret, see web/app/api/fast-mode-token/route.ts and
      // web/server/tria_app.py's _verify_token.
      let token: string;
      try {
        const tokenRes = await fetch("/api/fast-mode-token");
        if (!tokenRes.ok) {
          clearTimer();
          setState((s) => ({ ...s, stage: "error", errorKind: "server", error: "Drum generation isn't configured." }));
          return;
        }
        token = ((await tokenRes.json()) as { token: string }).token;
      } catch {
        clearTimer();
        setState((s) => ({
          ...s,
          stage: "error",
          errorKind: "network",
          error: "Couldn't reach the drum generation server. Check your connection.",
        }));
        return;
      }

      setState((s) => ({ ...s, stage: "uploading", uploadProgress: { loaded: 0, total: rhythmFile.size } }));

      const form = new FormData();
      form.append("rhythm_file", rhythmFile);
      if (timbreFile) form.append("timbre_file", timbreFile);

      const wavBuffer = await new Promise<ArrayBuffer | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("POST", MODAL_TRIA_URL, true);
        xhr.responseType = "arraybuffer";
        xhr.timeout = XHR_TIMEOUT_MS;
        xhr.setRequestHeader("X-Fast-Mode-Token", token);

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          setState((s) => ({ ...s, uploadProgress: { loaded: e.loaded, total: e.total } }));
        };
        xhr.upload.onload = () => setState((s) => ({ ...s, stage: "generating" }));

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
          const kind: TriaErrorKind = xhr.status === 401 ? "auth" : xhr.status === 429 ? "rate-limit" : "server";
          const fallback =
            xhr.status === 401
              ? "Session expired — try again."
              : xhr.status === 429
                ? "Drum generation is busy right now — try again shortly."
                : `Drum generation failed (HTTP ${xhr.status}).`;
          setState((s) => ({ ...s, stage: "error", errorKind: kind, error: detail ?? fallback }));
          resolve(null);
        };
        xhr.onerror = () => {
          setState((s) => ({
            ...s,
            stage: "error",
            errorKind: "network",
            error: "Couldn't reach the drum generation server.",
          }));
          resolve(null);
        };
        xhr.ontimeout = () => {
          setState((s) => ({
            ...s,
            stage: "error",
            errorKind: "network",
            error: "Drum generation timed out — the track may be too long, or the server is under heavy load.",
          }));
          resolve(null);
        };
        xhr.onabort = () => resolve(null);

        xhr.send(form);
      });

      clearTimer();
      if (!wavBuffer) return;

      const url = URL.createObjectURL(new Blob([wavBuffer], { type: "audio/wav" }));
      prevUrlRef.current = url;
      setState((s) => ({ ...s, stage: "done", resultUrl: url }));
    },
    [clearTimer, revokePrevUrl]
  );

  return { state, start, cancel, reset };
}
