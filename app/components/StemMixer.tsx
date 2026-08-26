"use client";

import { useCallback, useEffect, useState } from "react";
import { useStemPlayer } from "@/lib/separation/useStemPlayer";
import { audioBufferToWav } from "@/lib/audioProcessor";
import { mixStems } from "@/lib/separation/mixStems";
import { SOURCES, type Source } from "@/lib/separation/constants";
import { StemResultCard, STEM_LABEL } from "@/app/components/StemResultCard";

const DISPLAY_ORDER: Source[] = ["vocals", "drums", "bass", "other"];

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

const fullGains = (): Record<Source, number> => Object.fromEntries(SOURCES.map((s) => [s, 1])) as Record<Source, number>;

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
  const [showCombine, setShowCombine] = useState(false);
  const [lastGain, setLastGain] = useState<Record<Source, number>>(fullGains);
  const [mutedSet, setMutedSet] = useState<Set<Source>>(new Set());
  const [soloSource, setSoloSource] = useState<Source | null>(null);

  // Reflect mute/solo intent onto the actual audio gain nodes.
  useEffect(() => {
    for (const s of SOURCES) {
      const g = soloSource ? (s === soloSource ? lastGain[s] : 0) : mutedSet.has(s) ? 0 : lastGain[s];
      player.setGain(s, g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastGain, mutedSet, soloSource, player.setGain]);

  const toggleSelected = (source: Source) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const toggleMute = useCallback((s: Source) => {
    setMutedSet((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const toggleSolo = useCallback((s: Source) => {
    setSoloSource((prev) => (prev === s ? null : s));
  }, []);

  const saveCombined = () => {
    const sources = DISPLAY_ORDER.filter((s) => selected.has(s));
    if (sources.length < 2) return;
    const mixed = mixStems(stems, sources, lastGain);
    downloadStem(mixed, `${baseName}-${sources.join("+")}.wav`);
  };

  const downloadAll = () => {
    DISPLAY_ORDER.forEach((s, i) => {
      setTimeout(() => downloadStem(stems[s], `${baseName}-${s}.wav`), i * 200);
    });
  };

  const progress = duration > 0 ? Math.min(player.currentTime, duration) / duration : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
          Your stems
        </h2>
        <button
          onClick={downloadAll}
          className="rounded-full px-3.5 py-1.5 text-xs font-medium"
          style={{ background: "var(--card-raised)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
        >
          Download all stems
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DISPLAY_ORDER.map((source, i) => (
          <div key={source} style={{ animationDelay: `${i * 70}ms` }}>
            <StemResultCard
              source={source}
              buffer={stems[source]}
              progress={progress}
              duration={duration}
              gain={lastGain[source]}
              muted={mutedSet.has(source)}
              soloed={soloSource === source}
              selected={selected.has(source)}
              onToggleSelected={() => toggleSelected(source)}
              onSeek={(fraction) => player.seek(fraction * duration)}
              onGainChange={(v) => setLastGain((prev) => ({ ...prev, [source]: v }))}
              onToggleMute={() => toggleMute(source)}
              onToggleSolo={() => toggleSolo(source)}
              onDownload={() => downloadStem(stems[source], `${baseName}-${source}.wav`)}
            />
          </div>
        ))}
      </div>

      <div>
        <button
          onClick={() => setShowCombine((v) => !v)}
          className="text-xs font-medium underline underline-offset-2"
          style={{ color: "var(--muted)" }}
        >
          {showCombine ? "Hide" : "More"}: combine stems into one file
        </button>
        {showCombine && selected.size >= 2 && (
          <div className="mt-2">
            <button
              onClick={saveCombined}
              className="text-xs font-medium rounded-full px-4 py-2"
              style={{ background: "var(--card-raised)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}
            >
              Save combined ({DISPLAY_ORDER.filter((s) => selected.has(s)).map((s) => STEM_LABEL[s]).join(" + ")})
            </button>
          </div>
        )}
        {showCombine && selected.size < 2 && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            Check &ldquo;Combine&rdquo; on two or more stems above to mix and save them as one file.
          </p>
        )}
      </div>

      {/* Now playing — a shared transport, since all stems play back in sync. */}
      <div
        className="sticky bottom-3 flex flex-col gap-2 rounded-2xl p-3.5 shadow-lg"
        style={{ background: "var(--card-raised)", border: "1px solid var(--card-border)" }}
      >
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
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] tabular-nums w-10" style={{ color: "var(--muted)" }}>
            {formatTime(player.currentTime)}
          </span>

          <div className="flex items-center gap-5">
            <button onClick={() => player.seek(player.currentTime - 10)} aria-label="Back 10 seconds">
              <RewindIcon />
            </button>
            <button
              onClick={() => (player.isPlaying ? player.pause() : player.play())}
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              aria-label={player.isPlaying ? "Pause" : "Play"}
            >
              {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button onClick={() => player.seek(player.currentTime + 10)} aria-label="Forward 10 seconds">
              <ForwardIcon />
            </button>
          </div>

          <span className="text-[11px] tabular-nums w-10 text-right" style={{ color: "var(--muted)" }}>
            -{formatTime(Math.max(0, duration - player.currentTime))}
          </span>
        </div>
      </div>
    </div>
  );
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
