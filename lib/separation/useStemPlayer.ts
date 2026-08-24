"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_GAIN, SOURCES, type Source } from "./constants";

type Gains = Record<Source, number>;

const fullGains = (): Gains => Object.fromEntries(SOURCES.map((s) => [s, 1])) as Gains;

// Time constant for gain ramps: setting GainNode.gain.value directly changes
// volume instantly at the sample level, which produces an audible click —
// heard as a buzz/zipper noise while dragging a slider, worst on percussive
// (drums) and sustained-tone (melodic/"other") content where the
// discontinuity is most perceptible. setTargetAtTime ramps smoothly instead.
const GAIN_RAMP_SECONDS = 0.015;

/**
 * Plays 4 stem AudioBuffers in sample-accurate sync via one GainNode per
 * stem, so per-stem volume can be adjusted live — like a Moises-style mixer.
 * AudioBufferSourceNode is one-shot (can't pause/resume), so pause/seek
 * discard the current source nodes and reschedule fresh ones from the new
 * offset; only currentTime + gain values persist across that.
 */
export function useStemPlayer(stems: Record<Source, AudioBuffer> | null, duration: number) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<Record<Source, GainNode> | null>(null);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const startedAtCtxTimeRef = useRef(0);
  const offsetAtStartRef = useRef(0);
  // Mirrors `gains` state synchronously (state updates are async/batched),
  // so a slider moved before the first play() still applies correctly once
  // ensureContext() creates the nodes.
  const gainsRef = useRef<Gains>(fullGains());

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [gains, setGains] = useState<Gains>(fullGains);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      // Gains can be boosted above unity (up to MAX_GAIN); a limiter on the
      // master bus keeps boosted mixes from clipping without audibly
      // coloring a normal (<=100% per stem) mix, since it only engages near
      // 0dBFS.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      limiter.connect(ctx.destination);

      const nodes = {} as Record<Source, GainNode>;
      for (const s of SOURCES) {
        const g = ctx.createGain();
        g.gain.value = gainsRef.current[s];
        g.connect(limiter);
        nodes[s] = g;
      }
      ctxRef.current = ctx;
      gainNodesRef.current = nodes;
    }
    return ctxRef.current;
  }, []);

  const stopSources = useCallback(() => {
    for (const src of sourceNodesRef.current) {
      try {
        src.stop();
      } catch {
        // Already stopped/ended — ignore.
      }
      src.disconnect();
    }
    sourceNodesRef.current = [];
  }, []);

  const scheduleFrom = useCallback(
    (offset: number) => {
      if (!stems) return;
      const ctx = ensureContext();
      stopSources();
      const startAt = ctx.currentTime + 0.05;
      const nodes: AudioBufferSourceNode[] = [];
      for (const s of SOURCES) {
        const src = ctx.createBufferSource();
        src.buffer = stems[s];
        src.connect(gainNodesRef.current![s]);
        src.start(startAt, Math.max(0, offset));
        nodes.push(src);
      }
      sourceNodesRef.current = nodes;
      startedAtCtxTimeRef.current = startAt;
      offsetAtStartRef.current = offset;
    },
    [stems, ensureContext, stopSources]
  );

  const play = useCallback(() => {
    if (!stems || isPlaying) return;
    scheduleFrom(currentTime >= duration ? 0 : currentTime);
    setIsPlaying(true);
  }, [stems, isPlaying, currentTime, duration, scheduleFrom]);

  const pause = useCallback(() => {
    if (!isPlaying) return;
    const ctx = ctxRef.current;
    if (ctx) {
      const elapsed = ctx.currentTime - startedAtCtxTimeRef.current;
      setCurrentTime(Math.min(offsetAtStartRef.current + Math.max(0, elapsed), duration));
    }
    stopSources();
    setIsPlaying(false);
  }, [isPlaying, duration, stopSources]);

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, duration));
      setCurrentTime(clamped);
      if (isPlaying) scheduleFrom(clamped);
    },
    [isPlaying, duration, scheduleFrom]
  );

  const setGain = useCallback((source: Source, value: number) => {
    const clamped = Math.max(0, Math.min(value, MAX_GAIN));
    gainsRef.current = { ...gainsRef.current, [source]: clamped };
    setGains(gainsRef.current);
    const ctx = ctxRef.current;
    const node = gainNodesRef.current?.[source];
    if (ctx && node) {
      node.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.setTargetAtTime(clamped, ctx.currentTime, GAIN_RAMP_SECONDS);
    }
  }, []);

  // Advance the displayed position while playing, and stop cleanly at the end.
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const ctx = ctxRef.current;
      if (ctx) {
        const elapsed = ctx.currentTime - startedAtCtxTimeRef.current;
        const pos = offsetAtStartRef.current + Math.max(0, elapsed);
        if (pos >= duration) {
          setCurrentTime(duration);
          stopSources();
          setIsPlaying(false);
          return;
        }
        setCurrentTime(pos);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, duration, stopSources]);

  useEffect(() => {
    return () => {
      stopSources();
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [stopSources]);

  return { isPlaying, currentTime, gains, play, pause, seek, setGain };
}
