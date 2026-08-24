"use client";

import { useCallback, useRef, useState } from "react";
import { useSeparation } from "@/lib/separation/useSeparation";
import { useFallback } from "@/lib/fallback/useFallback";
import { MAX_INPUT_MB, MAX_DURATION_SECONDS } from "@/lib/separation/constants";
import type { Pass, SpecialistSource } from "@/lib/separation/useSeparation";
import { StemMixer } from "@/app/components/StemMixer";

type Mode = "ai" | "fallback";

const PASS_LABEL: Record<Pass, string> = {
  main: "main model",
  drums: "drums specialist",
  bass: "bass specialist",
  other: "other specialist",
};

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stageLabel(stage: string, pass: Pass) {
  switch (stage) {
    case "validating":
      return "Validating file…";
    case "decoding":
      return "Decoding audio…";
    case "loading-model":
      return pass === "main" ? "Loading AI model…" : `Loading ${PASS_LABEL[pass]} model…`;
    case "loading-session":
      return pass === "main" ? "Starting AI engine…" : `Starting ${PASS_LABEL[pass]} engine…`;
    case "processing":
      return pass === "main" ? "Separating vocals, drums, bass & other…" : `Improving ${pass}…`;
    case "finalizing":
      return "Reconstructing output…";
    default:
      return "Working…";
  }
}

const ACTIVE_STAGES = new Set([
  "validating",
  "decoding",
  "loading-model",
  "loading-session",
  "processing",
  "finalizing",
]);

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [wantDrums, setWantDrums] = useState(true);
  const [wantBass, setWantBass] = useState(true);
  const [wantOther, setWantOther] = useState(true);
  const [mode, setMode] = useState<Mode>("ai");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sep = useSeparation();
  const fb = useFallback();

  const baseName = file?.name.replace(/\.[^.]+$/, "") || "track";

  const pickFile = useCallback((f: File) => {
    setPendingFile(f);
    setMode("ai");
  }, []);

  const startSeparation = useCallback(() => {
    if (!pendingFile) return;
    setFile(pendingFile);
    void sep.start(pendingFile, { drums: wantDrums, bass: wantBass, other: wantOther });
    setPendingFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile, wantDrums, wantBass, wantOther]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) pickFile(dropped);
    },
    [pickFile]
  );

  const useFallbackNow = useCallback(() => {
    if (!file) return;
    setMode("fallback");
    void fb.run(file);
  }, [file, fb]);

  const resetAll = useCallback(() => {
    sep.reset();
    fb.reset();
    setMode("ai");
    setFile(null);
    setPendingFile(null);
    setWantDrums(true);
    setWantBass(true);
    setWantOther(true);
    if (inputRef.current) inputRef.current.value = "";
  }, [sep, fb]);

  const isDropzone = mode === "ai" && sep.state.stage === "idle" && !pendingFile;
  const isConfiguring = mode === "ai" && sep.state.stage === "idle" && !!pendingFile;
  const isActive = mode === "ai" && ACTIVE_STAGES.has(sep.state.stage);
  const anySpecialistSelected = wantDrums || wantBass || wantOther;
  const activePassOrder: Pass[] = [
    "main",
    ...(wantDrums ? (["drums"] as Pass[]) : []),
    ...(wantBass ? (["bass"] as Pass[]) : []),
    ...(wantOther ? (["other"] as Pass[]) : []),
  ];
  const failedSpecialists = sep.state.result
    ? (Object.keys(sep.state.result.quality) as SpecialistSource[]).filter(
        (s) => sep.state.result!.quality[s] === "standard"
      )
    : [];

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-sm"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <h1 className="text-2xl font-semibold text-center">Remove Vocals</h1>
        <p className="mt-2 text-sm text-center" style={{ color: "var(--muted)" }}>
          Your audio is processed locally in your browser. No audio is uploaded to a server.
        </p>

        <div className="mt-6">
          {isDropzone && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center gap-3 py-12 px-4 text-center"
              style={{
                borderColor: isDragging ? "var(--accent)" : "var(--card-border)",
                background: isDragging ? "var(--dropzone-active-bg)" : "var(--dropzone-bg)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium">Drop your song here</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>or</p>
              <span
                className="inline-block rounded-full px-4 py-2 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Choose file
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                }}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                MP3, WAV, or M4A · up to {MAX_INPUT_MB}MB · {MAX_DURATION_SECONDS / 60} min
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Up to 4 specialist AI models (~650MB total), cached after first download.
              </p>
            </div>
          )}

          {isConfiguring && pendingFile && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-center truncate" title={pendingFile.name}>
                {pendingFile.name}
              </p>

              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Turn off any specialist you don&apos;t need — each one skipped means one less model to download
                and one less pass to process, so it finishes faster.
              </p>

              <div className="flex flex-col gap-2">
                <SpecialistToggle label="Enhance Vocals" checked disabled hint="always on — main model" />
                <SpecialistToggle label="Enhance Drums" checked={wantDrums} onChange={setWantDrums} />
                <SpecialistToggle label="Enhance Bass" checked={wantBass} onChange={setWantBass} />
                <SpecialistToggle label="Enhance Other" checked={wantOther} onChange={setWantOther} />
              </div>

              {!anySpecialistSelected && (
                <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
                  Only the main model will run — drums/bass/other will use its standard (not specialist) quality.
                  Fastest option.
                </p>
              )}

              <button
                onClick={startSeparation}
                className="rounded-full px-4 py-2.5 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Separate
              </button>
              <button
                onClick={resetAll}
                className="text-sm font-medium underline underline-offset-2"
                style={{ color: "var(--muted)" }}
              >
                Choose a different file
              </button>
            </div>
          )}

          {isActive && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                className="h-8 w-8 rounded-full border-2 animate-spin"
                style={{ borderColor: "var(--track)", borderTopColor: "var(--accent)" }}
              />
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Pass {activePassOrder.indexOf(sep.state.pass) + 1}/{activePassOrder.length}:{" "}
                {PASS_LABEL[sep.state.pass]}
              </p>
              <p className="text-sm font-medium">{stageLabel(sep.state.stage, sep.state.pass)}</p>

              {sep.state.stage === "loading-model" && sep.state.modelProgress && (
                <div className="w-full">
                  <ProgressBar
                    fraction={
                      sep.state.modelProgress.total > 0
                        ? sep.state.modelProgress.loaded / sep.state.modelProgress.total
                        : 0
                    }
                  />
                  <p className="text-xs text-center mt-1" style={{ color: "var(--muted)" }}>
                    {formatMB(sep.state.modelProgress.loaded)} /{" "}
                    {sep.state.modelProgress.total > 0 ? formatMB(sep.state.modelProgress.total) : "?"} MB
                  </p>
                </div>
              )}

              {sep.state.stage === "processing" && sep.state.chunkProgress && (
                <div className="w-full">
                  <ProgressBar fraction={sep.state.chunkProgress.current / sep.state.chunkProgress.total} />
                  <p className="text-xs text-center mt-1" style={{ color: "var(--muted)" }}>
                    Chunk {sep.state.chunkProgress.current}/{sep.state.chunkProgress.total} · Elapsed{" "}
                    {formatDuration(sep.state.elapsedMs)}
                    {sep.state.etaMs !== null ? ` · ETA ${formatDuration(sep.state.etaMs)}` : ""}
                  </p>
                </div>
              )}

              {sep.state.engine && (
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  GPU acceleration: {sep.state.engine === "webgpu" ? "WebGPU" : "WASM (CPU)"}
                </p>
              )}

              <button
                onClick={sep.cancel}
                className="text-xs font-medium underline underline-offset-2"
                style={{ color: "var(--muted)" }}
              >
                Cancel
              </button>
            </div>
          )}

          {mode === "ai" && sep.state.stage === "cancelled" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Cancelled.
              </p>
              <button
                onClick={resetAll}
                className="text-sm font-medium underline underline-offset-2"
                style={{ color: "var(--accent)" }}
              >
                Try another file
              </button>
            </div>
          )}

          {mode === "ai" && sep.state.stage === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div
                className="rounded-lg px-4 py-3 text-sm w-full"
                style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
              >
                {sep.state.error}
              </div>
              {sep.state.errorKind === "engine" && (
                <button
                  onClick={useFallbackNow}
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  Use basic fallback instead (lower quality, not AI)
                </button>
              )}
              <button
                onClick={resetAll}
                className="text-sm font-medium underline underline-offset-2"
                style={{ color: "var(--muted)" }}
              >
                Try another file
              </button>
            </div>
          )}

          {mode === "ai" && sep.state.stage === "done" && sep.state.result && (
            <div className="flex flex-col gap-5">
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                style={{ background: "var(--success-bg)", color: "var(--success)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                AI model loaded — vocals, drums, bass &amp; other separated
              </div>

              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Engine: AI source separation ({sep.state.engine === "webgpu" ? "WebGPU" : "WASM"}) · Model:{" "}
                {sep.modelName}
              </p>

              {sep.state.isMono && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
                  This file is mono. The model still ran, but without real stereo information its accuracy is reduced.
                </p>
              )}

              {failedSpecialists.length > 0 && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
                  {failedSpecialists.join(", ")} specialist pass{failedSpecialists.length > 1 ? "es" : ""}{" "}
                  couldn&apos;t run on this device — that stem came from the main model instead (standard, not
                  enhanced, quality).
                </p>
              )}

              <StemMixer stems={sep.state.result.stems} duration={sep.state.result.duration} baseName={baseName} />

              <button
                onClick={resetAll}
                className="text-sm font-medium underline underline-offset-2"
                style={{ color: "var(--muted)" }}
              >
                Try another file
              </button>
            </div>
          )}

          {mode === "fallback" && (
            <FallbackPanel
              status={fb.status}
              error={fb.error}
              isMono={fb.isMono}
              strength={fb.strength}
              resultUrl={fb.resultUrl}
              baseName={baseName}
              onStrengthChange={fb.changeStrength}
              onReset={resetAll}
            />
          )}
        </div>

        <p className="mt-6 text-[11px] text-center leading-relaxed" style={{ color: "var(--muted)" }}>
          Primary engine: four HT-Demucs FT specialist models (MIT licensed), run entirely on-device via
          onnxruntime-web — one per stem (vocals, drums, bass, other). Phase cancellation is used only
          as a fallback if the models can&apos;t run on this device.
        </p>
      </div>
    </div>
  );
}

function SpecialistToggle({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 text-sm ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <span className="flex flex-col">
        <span>{label}</span>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="accent-[var(--accent)]"
      />
    </label>
  );
}

function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--track)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
    </div>
  );
}

function StemBlock({ label, url, filename }: { label: string; url: string; filename: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <audio controls src={url} className="w-full h-10" />
      <a
        href={url}
        download={filename}
        className="text-center rounded-full px-4 py-2 text-sm font-medium"
        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        Download {label}
      </a>
    </div>
  );
}

function FallbackPanel({
  status,
  error,
  isMono,
  strength,
  resultUrl,
  baseName,
  onStrengthChange,
  onReset,
}: {
  status: string;
  error: string;
  isMono: boolean;
  strength: number;
  resultUrl: string | null;
  baseName: string;
  onStrengthChange: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg px-4 py-3 text-xs" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
        ⚠ Fallback mode: phase cancellation, not AI. Quality is noticeably lower than the AI engine.
      </div>

      {status === "processing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--track)", borderTopColor: "var(--accent)" }}
          />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Processing…
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {status === "done" && resultUrl && (
        <div className="flex flex-col gap-4">
          {isMono && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
              This file is mono, so there&apos;s no stereo separation to exploit — the output is unchanged from the original.
            </p>
          )}
          {!isMono && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}>
                <label htmlFor="fallback-strength">Removal strength</label>
                <span>{Math.round(strength * 100)}%</span>
              </div>
              <input
                id="fallback-strength"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={strength}
                onChange={(e) => onStrengthChange(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          )}
          <StemBlock label="Instrumental" url={resultUrl} filename={`${baseName}-instrumental-fallback.wav`} />
        </div>
      )}

      <button onClick={onReset} className="text-sm font-medium underline underline-offset-2" style={{ color: "var(--muted)" }}>
        Try another file
      </button>
    </div>
  );
}
