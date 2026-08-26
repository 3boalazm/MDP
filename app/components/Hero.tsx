"use client";

const RING_COUNT = 6;

export function Hero({ onChooseFile }: { onChooseFile: () => void }) {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:py-28 text-center">
      <BreathingRings />

      <div className="relative mx-auto max-w-2xl animate-fade-in-up">
        <p
          className="text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: "var(--accent-audio)" }}
        >
          Local audio separation
        </p>
        <h1 className="mt-4 text-[38px] sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Turn one track into four clean stems.
        </h1>
        <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
          Separate vocals, drums, bass, and other instruments directly in your browser.
          Nothing you upload here — because nothing gets uploaded.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onChooseFile}
            className="rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{ background: "var(--foreground)", color: "var(--background)" }}
          >
            Choose a file
          </button>
          <a
            href="#how-it-works"
            className="rounded-full px-6 py-3 text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--card-border)", color: "var(--foreground)" }}
          >
            See how it works
          </a>
        </div>

        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
          style={{ color: "var(--muted)" }}
        >
          <TrustItem>No upload</TrustItem>
          <Dot />
          <TrustItem>Runs on your device</TrustItem>
          <Dot />
          <TrustItem>MP3 · WAV · M4A</TrustItem>
        </div>
      </div>
    </section>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-audio)" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

function Dot() {
  return <span className="hidden sm:inline opacity-40">·</span>;
}

function BreathingRings() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      {Array.from({ length: RING_COUNT }).map((_, i) => {
        const size = 180 + i * 110;
        return (
          <div
            key={i}
            className="animate-ring-breathe absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={
              {
                width: size,
                height: size,
                border: "1px solid var(--card-border)",
                animationDelay: `${i * 0.4}s`,
                "--ring-opacity": 0.5 - i * 0.06,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
