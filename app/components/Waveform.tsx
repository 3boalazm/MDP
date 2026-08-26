"use client";

import { useMemo } from "react";

const BAR_COUNT = 56;

/** Downsamples an AudioBuffer to a fixed number of peak bars for display. */
function computePeaks(buffer: AudioBuffer, bars: number): number[] {
  const data = buffer.getChannelData(0);
  const bucketSize = Math.max(1, Math.floor(data.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, data.length);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0.01);
  return peaks.map((p) => Math.max(0.06, p / max));
}

export function Waveform({
  buffer,
  progress,
  onSeek,
  playedColor = "var(--accent-audio)",
  unplayedColor = "rgba(255,255,255,0.16)",
}: {
  buffer: AudioBuffer;
  /** 0..1 playhead position */
  progress: number;
  onSeek?: (fraction: number) => void;
  playedColor?: string;
  unplayedColor?: string;
}) {
  const peaks = useMemo(() => computePeaks(buffer, BAR_COUNT), [buffer]);
  const playedBars = Math.round(progress * BAR_COUNT);

  return (
    <div
      className="flex items-center gap-[2px] h-10 w-full cursor-pointer"
      role={onSeek ? "slider" : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(fraction);
      }}
    >
      {peaks.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-colors"
          style={{
            height: `${Math.round(p * 100)}%`,
            minHeight: 2,
            background: i < playedBars ? playedColor : unplayedColor,
          }}
        />
      ))}
    </div>
  );
}
