"use client";

import { Waveform } from "@/app/components/Waveform";
import { useLocale } from "@/lib/i18n";
import { MAX_GAIN, type Source } from "@/lib/separation/constants";

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function StemResultCard({
  source,
  buffer,
  progress,
  duration,
  gain,
  muted,
  soloed,
  selected,
  onToggleSelected,
  onSeek,
  onGainChange,
  onToggleMute,
  onToggleSolo,
  onDownload,
}: {
  source: Source;
  buffer: AudioBuffer | undefined;
  /** 0..1 playhead position */
  progress: number;
  duration: number;
  gain: number;
  muted: boolean;
  soloed: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onSeek: (fraction: number) => void;
  onGainChange: (v: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDownload: () => void;
}) {
  const { t } = useLocale();
  const label = t.stems.label[source];

  return (
    <div
      className="hover-lift animate-stagger-in flex flex-col gap-3 rounded-2xl p-4"
      style={{
        background: "var(--card-raised)",
        border: `1px solid ${soloed ? "var(--accent-audio)" : "var(--card-border)"}`,
        boxShadow: soloed ? "0 0 0 1px rgba(84,214,199,0.4), 0 8px 24px rgba(84,214,199,0.18)" : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StemIcon source={source} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span
          className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide"
          style={{ color: "var(--accent-audio)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-audio)" }} />
          {t.stems.ready}
        </span>
      </div>

      <Waveform buffer={buffer} progress={muted ? 0 : progress} onSeek={onSeek} />

      <div className="ltr-metric flex items-center justify-between text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
        <span>{formatTime(progress * duration)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMute}
          aria-pressed={muted}
          className="hover-lift press-scale rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            background: muted ? "var(--danger-bg)" : "transparent",
            color: muted ? "var(--danger)" : "var(--muted)",
            border: "1px solid var(--card-border)",
          }}
        >
          {t.stems.mute}
        </button>
        <button
          onClick={onToggleSolo}
          aria-pressed={soloed}
          className="hover-lift press-scale rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            background: soloed ? "var(--accent-audio)" : "transparent",
            color: soloed ? "var(--accent-audio-foreground)" : "var(--muted)",
            border: soloed ? "1px solid transparent" : "1px solid var(--card-border)",
          }}
        >
          {t.stems.solo}
        </button>
        <input
          dir="ltr"
          type="range"
          min={0}
          max={MAX_GAIN}
          step={0.01}
          value={gain}
          onChange={(e) => onGainChange(Number(e.target.value))}
          className="flex-1 accent-[var(--accent)]"
          aria-label={`${label} volume`}
        />
        <span className="ltr-metric text-[10px] w-8 text-right tabular-nums" style={{ color: "var(--muted)" }}>
          {Math.round(gain * 100)}%
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--card-border)" }}>
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "var(--muted)" }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="accent-[var(--accent)]"
            aria-label={`${t.stems.combine} ${label}`}
          />
          {t.stems.combine}
        </label>
        <button
          onClick={onDownload}
          className="shine hover-lift press-scale ms-auto rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          {t.stems.downloadWav}
        </button>
      </div>
    </div>
  );
}

export function StemIcon({ source }: { source: Source }) {
  const common = {
    width: 16,
    height: 16,
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
