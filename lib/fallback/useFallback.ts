"use client";

import { useCallback, useRef, useState } from "react";
import {
  audioBufferToWav,
  decodeAudioFile,
  removeCenterChannel,
  UnsupportedAudioError,
} from "../audioProcessor";

export type FallbackStatus = "idle" | "processing" | "done" | "error";

/**
 * The old phase-cancellation engine, kept only as an explicitly-labeled
 * fallback for when the ONNX model can't load or run on this device.
 * This is NOT AI source separation — see lib/audioProcessor.ts.
 */
export function useFallback() {
  const [status, setStatus] = useState<FallbackStatus>("idle");
  const [error, setError] = useState("");
  const [isMono, setIsMono] = useState(false);
  const [strength, setStrength] = useState(1);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const decodedRef = useRef<AudioBuffer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const process = useCallback(async (buffer: AudioBuffer, s: number) => {
    const result = removeCenterChannel(buffer, s);
    const blob = audioBufferToWav(result);
    const url = URL.createObjectURL(blob);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const run = useCallback(
    async (file: File) => {
      setStatus("processing");
      setError("");
      try {
        const buffer = await decodeAudioFile(file);
        decodedRef.current = buffer;
        setIsMono(buffer.numberOfChannels < 2);
        await process(buffer, strength);
        setStatus("done");
      } catch (err) {
        setStatus("error");
        setError(err instanceof UnsupportedAudioError ? err.message : "Something went wrong while processing that file.");
      }
    },
    [process, strength]
  );

  const changeStrength = useCallback(
    (value: number) => {
      setStrength(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (decodedRef.current) void process(decodedRef.current, value);
      }, 120);
    },
    [process]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
    decodedRef.current = null;
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  return { status, error, isMono, strength, resultUrl, run, changeStrength, reset };
}
