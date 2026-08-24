"use client";

import { useState } from "react";
import { useStemPlayer } from "@/lib/separation/useStemPlayer";
import { audioBufferToWav } from "@/lib/audioProcessor";
import { mixStems } from "@/lib/separation/mixStems";
import { MAX_GAIN, type Source } from "@/lib/separation/constants";

const DISPLAY_ORDER: Source[] = ["vocals", "drums", "bass", "other"];
const STEM_LABEL: Record<Source, string> = {
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  other: "Other",
};

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function downloadStem(buffer: AudioBuffer, filename: string) {
  const url = URL.createObjectURL(audioBufferToWav(buffer));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StemMixer({
  stems,
  duration,
  baseName,
}: {
  stems: Record<Source, AudioBuffer>;
  duration: number;
  baseName: string;
}) {
  const player = useStemPlayer(stems, duration);
  const [selected, setSelected] = useState<Set<Source>>(new Set());

  const toggleSelected = (source: Source) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const saveCombined = () => {
    const sources = DISPLAY_ORDER.filter((s) => selected.has(s));
    if (sources.length < 2) return;
    const mixed = mixStems(stems, sources, player.gains);
    downloadStem(mixed, `${baseName}-${sources.join("+")}.wav`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {DISPLAY_ORDER.map((source) => (
          <div key={source} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.has(source)}
              onChange={() => toggleSelected(source)}
              className="shrink-0 accent-[var(--accent)]"
              aria-label={`Select ${STEM_LABEL[source]} for combined save`}
            />
            <StemIcon source={source} />
            <input
              type="range"
              min={0}
              max={MAX_GAIN}
              step={0.01}
              value={player.gains[source]}
              onChange={(e) => player.setGain(source, Number(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
              aria-label={`${STEM_LABEL[source]} volume`}
            />
            <span className="text-[11px] w-9 text-right shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
              {Math.round(player.gains[source] * 100)}%
            </span>
            <button
              onClick={() => downloadStem(stems[source], `${baseName}-${source}.wav`)}
              className="text-[11px] underline underline-offset-2 shrink-0"
              style={{ color: "var(--muted)" }}
            >
              Save
            </button>
          </div>
        ))}
      </div>

      {selected.size >= 2 && (
        <button
          onClick={saveCombined}
          className="text-xs font-medium rounded-full px-4 py-2"
          style={{ background: "var(--dropzone-bg)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
        >
          Save combined ({DISPLAY_ORDER.filter((s) => selected.has(s)).map((s) => STEM_LABEL[s]).join(" + ")})
        </button>
      )}

      <div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(player.currentTime, duration)}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Seek"
        />
        <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          <span>{formatTime(player.currentTime)}</span>
          <span>-{formatTime(Math.max(0, duration - player.currentTime))}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button onClick={() => player.seek(player.currentTime - 10)} aria-label="Back 10 seconds">
          <RewindIcon />
        </button>
        <button
          onClick={() => (player.isPlaying ? player.pause() : player.play())}
          className="h-11 w-11 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          aria-label={player.isPlaying ? "Pause" : "Play"}
        >
          {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button onClick={() => player.seek(player.currentTime + 10)} aria-label="Forward 10 seconds">
          <ForwardIcon />
        </button>
      </div>
    </div>
  );
}

function StemIcon({ source }: { source: Source }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: 1.6,
  };
  switch (source) {
    case "vocals":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3m-4 0h8" strokeLinecap="round" />
        </svg>
      );
    case "drums":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="7" rx="8" ry="3.2" />
          <path d="M4 7v8a8 3.2 0 0016 0V7" />
          <path d="M8.5 4.5L4 2m11 2.5L19 2" strokeLinecap="round" />
        </svg>
      );
    case "bass":
      return (
        <svg {...common}>
          <circle cx="9" cy="16" r="4.5" />
          <path d="M12 13l6-9m-3 1l3 2m-5 1l3 2" strokeLinecap="round" />
        </svg>
      );
    case "other":
      return (
        <svg {...common}>
          <path d="M9 18V5l10-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </svg>
      );
  }
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6">
      <path d="M11 12l8-6v12z" />
      <path d="M3 12l8-6v12z" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.6">
      <path d="M13 12L5 6v12z" />
      <path d="M21 12l-8-6v12z" />
    </svg>
  );
}
