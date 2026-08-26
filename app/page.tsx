"use client";

import { useCallback, useRef, useState } from "react";
import { useSeparation } from "@/lib/separation/useSeparation";
import { useServerSeparation } from "@/lib/separation/useServerSeparation";
import { useFallback } from "@/lib/fallback/useFallback";
import { MAX_INPUT_MB, MAX_DURATION_SECONDS } from "@/lib/separation/constants";
import { SERVER_MODE_AVAILABLE } from "@/lib/separation/serverConstants";
import { useLocale } from "@/lib/i18n";
import type { Pass, SpecialistSource } from "@/lib/separation/useSeparation";
import type { ServerStage } from "@/lib/separation/useServerSeparation";
import { StemMixer } from "@/app/components/StemMixer";
import { Hero } from "@/app/components/Hero";
import { Steps } from "@/app/components/Steps";
import { Faq } from "@/app/components/Faq";
import { Footer } from "@/app/components/Footer";

type Mode = "ai" | "fallback" | "server";

function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ACTIVE_STAGES = new Set([
  "validating",
  "decoding",
  "loading-model",
  "loading-session",
  "processing",
  "finalizing",
]);

const SERVER_ACTIVE_STAGES = new Set(["validating", "uploading", "processing", "finalizing"]);

export default function Home() {
  const { t, locale } = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [wantDrums, setWantDrums] = useState(true);
  const [wantBass, setWantBass] = useState(true);
  const [wantOther, setWantOther] = useState(true);
  const [mode, setMode] = useState<Mode>("ai");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sep = useSeparation();
  const serverSep = useServerSeparation();
  const fb = useFallback();

  const baseName = file?.name.replace(/\.[^.]+$/, "") || "track";

  const pickFile = useCallback((f: File) => {
    setPendingFile(f);
    setMode("ai");
  }, []);

  const startSeparation = useCallback(() => {
    if (!pendingFile) return;
    setFile(pendingFile);
    if (mode === "server") {
      // Fast Mode's config screen hides the per-specialist checkboxes and
      // states it always computes all 4 stems — but wantDrums/wantBass/
      // wantOther can still hold `false` left over from a prior on-device
      // configuration, since switching modes doesn't reset them. Passing
      // that stale value through would make the server omit a stem, and
      // the results screen has no "missing stem" handling for Fast Mode
      // (unlike on-device, which always gets all 4 from the main pass
      // regardless of these flags) — so always request all 4 here.
      void serverSep.start(pendingFile, { drums: true, bass: true, other: true });
    } else {
      void sep.start(pendingFile, { drums: wantDrums, bass: wantBass, other: wantOther });
    }
    setPendingFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile, mode, wantDrums, wantBass, wantOther]);

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

  const switchToOnDevice = useCallback(() => {
    if (!file) return;
    serverSep.reset();
    setMode("ai");
    setPendingFile(file);
  }, [file, serverSep]);

  const resetAll = useCallback(() => {
    sep.reset();
    serverSep.reset();
    fb.reset();
    setMode("ai");
    setFile(null);
    setPendingFile(null);
    setWantDrums(true);
    setWantBass(true);
    setWantOther(true);
    if (inputRef.current) inputRef.current.value = "";
  }, [sep, serverSep, fb]);

  const openFilePicker = useCallback(() => {
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => inputRef.current?.click(), 350);
  }, []);

  // Neither hook has a job running/finished yet, and we're not in fallback —
  // covers both the dropzone and configuring screens regardless of which
  // mode the user has (or hasn't yet) selected in the configuring panel.
  const noJobYet = sep.state.stage === "idle" && serverSep.state.stage === "idle" && mode !== "fallback";
  const isDropzone = noJobYet && !pendingFile;
  const isConfiguring = noJobYet && !!pendingFile;
  const isAiActive = mode === "ai" && ACTIVE_STAGES.has(sep.state.stage);
  const isServerActive = mode === "server" && SERVER_ACTIVE_STAGES.has(serverSep.state.stage);
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
  const listSeparator = locale === "ar" ? "، " : ", ";

  return (
    <>
      <Hero onChooseFile={openFilePicker} />
      <Steps />

      <section id="workspace" className="px-4 py-16 sm:py-20 scroll-mt-16">
        <div className="glass mx-auto w-full max-w-md rounded-2xl p-8">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-center" style={{ color: "var(--accent-audio)" }}>
            {t.workspace.eyebrow}
          </p>
          <p className="mt-2 text-sm text-center" style={{ color: "var(--muted)" }}>
            {mode === "server" ? t.workspace.serverNote : t.workspace.privacyNote}
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
                className="rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-3 py-12 px-4 text-center"
                style={{
                  borderColor: isDragging ? "var(--accent)" : "var(--card-border)",
                  background: isDragging ? "var(--dropzone-active-bg)" : "var(--dropzone-bg)",
                  transform: isDragging ? "scale(1.01)" : "scale(1)",
                  boxShadow: isDragging ? "0 0 0 4px var(--dropzone-active-bg)" : "none",
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                  <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm font-medium">
                  {isDragging ? t.workspace.dropzone.dragLabel : t.workspace.dropzone.idleLabel}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {t.workspace.dropzone.or}
                </p>
                <span
                  className="shine hover-lift press-scale inline-block rounded-full px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  {t.workspace.dropzone.chooseFile}
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
                  {t.workspace.dropzone.limits(MAX_INPUT_MB, MAX_DURATION_SECONDS / 60)}
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t.workspace.dropzone.modelsNote}
                </p>
              </div>
            )}

            {isConfiguring && pendingFile && (
              <div className="flex flex-col gap-4 animate-stagger-in">
                <div
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: "var(--dropzone-bg)", border: "1px solid var(--card-border)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={pendingFile.name}>
                      {pendingFile.name}
                    </p>
                    <p className="ltr-metric text-[11px]" style={{ color: "var(--muted)" }}>
                      {formatBytes(pendingFile.size)}
                    </p>
                  </div>
                  <button
                    onClick={resetAll}
                    className="shrink-0 text-xs font-medium underline underline-offset-2"
                    style={{ color: "var(--muted)" }}
                  >
                    {t.workspace.fileSummary.changeFile}
                  </button>
                </div>

                {SERVER_MODE_AVAILABLE && (
                  <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--dropzone-bg)" }}>
                    <ModeToggle label={t.workspace.modeToggle.onDevice} active={mode === "ai"} onClick={() => setMode("ai")} />
                    <ModeToggle label={t.workspace.modeToggle.fastMode} active={mode === "server"} onClick={() => setMode("server")} />
                  </div>
                )}

                {mode === "ai" && (
                  <>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {t.workspace.specialists.intro}
                    </p>

                    <div className="flex flex-col gap-2">
                      <SpecialistToggle
                        label={t.workspace.specialists.vocals}
                        checked
                        disabled
                        hint={t.workspace.specialists.vocalsHint}
                      />
                      <SpecialistToggle label={t.workspace.specialists.drums} checked={wantDrums} onChange={setWantDrums} />
                      <SpecialistToggle label={t.workspace.specialists.bass} checked={wantBass} onChange={setWantBass} />
                      <SpecialistToggle label={t.workspace.specialists.other} checked={wantOther} onChange={setWantOther} />
                    </div>

                    {!anySpecialistSelected && (
                      <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
                        {t.workspace.specialists.onlyMainNote}
                      </p>
                    )}
                  </>
                )}

                {mode === "server" && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--dropzone-bg)", color: "var(--muted)" }}>
                    {t.workspace.fastModeNote}
                  </p>
                )}

                <button
                  onClick={startSeparation}
                  className="shine hover-lift press-scale rounded-full px-4 py-2.5 text-sm font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  {t.workspace.startButton}
                </button>
              </div>
            )}

            {isAiActive && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div
                  className="h-8 w-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: "var(--track)", borderTopColor: "var(--accent)" }}
                />
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t.workspace.progress.passCounter(
                    activePassOrder.indexOf(sep.state.pass) + 1,
                    activePassOrder.length,
                    t.workspace.progress.passLabel[sep.state.pass]
                  )}
                </p>
                <p className="text-sm font-medium">
                  {t.workspace.progress.stage(
                    sep.state.stage,
                    t.workspace.progress.passLabel[sep.state.pass],
                    sep.state.pass === "main"
                  )}
                </p>

                {sep.state.stage === "loading-model" && sep.state.modelProgress && (
                  <div className="w-full">
                    <ProgressBar
                      fraction={
                        sep.state.modelProgress.total > 0
                          ? sep.state.modelProgress.loaded / sep.state.modelProgress.total
                          : 0
                      }
                    />
                    <p className="ltr-metric text-xs text-center mt-1" style={{ color: "var(--muted)" }}>
                      {formatMB(sep.state.modelProgress.loaded)} /{" "}
                      {sep.state.modelProgress.total > 0 ? formatMB(sep.state.modelProgress.total) : "?"} MB
                    </p>
                    <p className="text-[11px] text-center mt-1" style={{ color: "var(--muted)" }}>
                      {t.workspace.progress.modelDownloadNote}
                    </p>
                  </div>
                )}

                {sep.state.stage === "processing" && sep.state.chunkProgress && (
                  <div className="w-full">
                    <ProgressBar fraction={sep.state.chunkProgress.current / sep.state.chunkProgress.total} />
                    <p className="text-xs text-center mt-1" style={{ color: "var(--muted)" }}>
                      <span className="ltr-metric inline-block">
                        {t.workspace.progress.chunkProgress(sep.state.chunkProgress.current, sep.state.chunkProgress.total)}
                      </span>{" "}
                      · {t.workspace.progress.elapsed(formatDuration(sep.state.elapsedMs))}
                      {sep.state.etaMs !== null ? ` · ${t.workspace.progress.eta(formatDuration(sep.state.etaMs))}` : ""}
                    </p>
                  </div>
                )}

                {sep.state.engine && (
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {t.workspace.progress.gpu(sep.state.engine === "webgpu" ? "WebGPU" : "WASM (CPU)")}
                  </p>
                )}

                <button
                  onClick={sep.cancel}
                  className="text-xs font-medium underline underline-offset-2"
                  style={{ color: "var(--muted)" }}
                >
                  {t.workspace.progress.cancel}
                </button>
              </div>
            )}

            {isServerActive && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div
                  className="h-8 w-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: "var(--track)", borderTopColor: "var(--accent)" }}
                />
                <p className="text-sm font-medium">{t.workspace.serverProgress.stage(serverSep.state.stage as ServerStage)}</p>

                {serverSep.state.stage === "uploading" && serverSep.state.uploadProgress && (
                  <div className="w-full">
                    <ProgressBar
                      fraction={
                        serverSep.state.uploadProgress.total > 0
                          ? serverSep.state.uploadProgress.loaded / serverSep.state.uploadProgress.total
                          : 0
                      }
                    />
                    <p className="ltr-metric text-xs text-center mt-1" style={{ color: "var(--muted)" }}>
                      {formatMB(serverSep.state.uploadProgress.loaded)} / {formatMB(serverSep.state.uploadProgress.total)} MB
                    </p>
                  </div>
                )}

                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t.workspace.progress.elapsed(formatDuration(serverSep.state.elapsedMs))}
                </p>

                <button
                  onClick={serverSep.cancel}
                  className="text-xs font-medium underline underline-offset-2"
                  style={{ color: "var(--muted)" }}
                >
                  {t.workspace.progress.cancel}
                </button>
              </div>
            )}

            {mode === "server" && serverSep.state.stage === "cancelled" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {t.workspace.cancelled}
                </p>
                <button
                  onClick={resetAll}
                  className="text-sm font-medium underline underline-offset-2"
                  style={{ color: "var(--accent)" }}
                >
                  {t.workspace.newSeparation}
                </button>
              </div>
            )}

            {mode === "server" && serverSep.state.stage === "error" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center animate-shake">
                <div
                  className="rounded-lg px-4 py-3 text-sm w-full"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
                >
                  {serverSep.state.error}
                </div>
                {serverSep.state.errorKind !== "validation" && (
                  <button
                    onClick={switchToOnDevice}
                    className="shine hover-lift press-scale rounded-full px-4 py-2 text-sm font-medium"
                    style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    {t.workspace.useOnDeviceInstead}
                  </button>
                )}
                <button
                  onClick={resetAll}
                  className="text-sm font-medium underline underline-offset-2"
                  style={{ color: "var(--muted)" }}
                >
                  {t.workspace.newSeparation}
                </button>
              </div>
            )}

            {mode === "server" && serverSep.state.stage === "done" && serverSep.state.result && (
              <div className="flex flex-col gap-5">
                <div
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                  style={{ background: "var(--success-bg)", color: "var(--success)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t.workspace.done.serverBanner}
                </div>

                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t.workspace.done.serverEngineLine(formatDuration(serverSep.state.elapsedMs))}
                </p>

                <StemMixer stems={serverSep.state.result.stems} duration={serverSep.state.result.duration} baseName={baseName} />

                <button
                  onClick={resetAll}
                  className="text-sm font-medium underline underline-offset-2 self-center"
                  style={{ color: "var(--muted)" }}
                >
                  {t.workspace.newSeparation}
                </button>
              </div>
            )}

            {mode === "ai" && sep.state.stage === "cancelled" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {t.workspace.cancelled}
                </p>
                <button
                  onClick={resetAll}
                  className="text-sm font-medium underline underline-offset-2"
                  style={{ color: "var(--accent)" }}
                >
                  {t.workspace.newSeparation}
                </button>
              </div>
            )}

            {mode === "ai" && sep.state.stage === "error" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center animate-shake">
                <div
                  className="rounded-lg px-4 py-3 text-sm w-full"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
                >
                  {sep.state.error}
                </div>
                {sep.state.errorKind === "engine" && (
                  <button
                    onClick={useFallbackNow}
                    className="shine hover-lift press-scale rounded-full px-4 py-2 text-sm font-medium"
                    style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    {t.workspace.useFallbackInstead}
                  </button>
                )}
                <button
                  onClick={resetAll}
                  className="text-sm font-medium underline underline-offset-2"
                  style={{ color: "var(--muted)" }}
                >
                  {t.workspace.newSeparation}
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
                  {t.workspace.done.aiBanner}
                </div>

                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t.workspace.done.engineLine(
                    sep.state.engine === "webgpu" ? "WebGPU" : "WASM",
                    sep.modelName,
                    formatDuration(sep.state.elapsedMs)
                  )}
                </p>

                {sep.state.isMono && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                    {t.workspace.done.monoWarning}
                  </p>
                )}

                {failedSpecialists.length > 0 && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                    {t.workspace.done.failedSpecialistsWarning(
                      failedSpecialists.map((s) => t.stems.label[s]).join(listSeparator),
                      failedSpecialists.length > 1
                    )}
                  </p>
                )}

                <StemMixer stems={sep.state.result.stems} duration={sep.state.result.duration} baseName={baseName} />

                <button
                  onClick={resetAll}
                  className="text-sm font-medium underline underline-offset-2 self-center"
                  style={{ color: "var(--muted)" }}
                >
                  {t.workspace.newSeparation}
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
        </div>
      </section>

      <Faq />
      <Footer />
    </>
  );
}

function ModeToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent-foreground)" : "var(--muted)",
      }}
    >
      {label}
    </button>
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
    <div dir="ltr" className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--track)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--accent)" }} />
    </div>
  );
}

function StemBlock({ label, url, filename }: { label: string; url: string; filename: string }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <audio controls src={url} className="w-full h-10" />
      <a
        href={url}
        download={filename}
        className="shine hover-lift press-scale text-center rounded-full px-4 py-2 text-sm font-medium"
        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        {t.workspace.fallback.downloadLabel(label)}
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
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg px-4 py-3 text-xs" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
        {t.workspace.fallback.banner}
      </div>

      {status === "processing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--track)", borderTopColor: "var(--accent)" }}
          />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {t.workspace.fallback.processing}
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
              {t.workspace.fallback.monoNote}
            </p>
          )}
          {!isMono && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}>
                <label htmlFor="fallback-strength">{t.workspace.fallback.removalStrength}</label>
                <span className="ltr-metric">{Math.round(strength * 100)}%</span>
              </div>
              <input
                dir="ltr"
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
          <StemBlock
            label={t.workspace.fallback.instrumentalLabel}
            url={resultUrl}
            filename={`${baseName}-instrumental-fallback.wav`}
          />
        </div>
      )}

      <button onClick={onReset} className="text-sm font-medium underline underline-offset-2" style={{ color: "var(--muted)" }}>
        {t.workspace.newSeparation}
      </button>
    </div>
  );
}
