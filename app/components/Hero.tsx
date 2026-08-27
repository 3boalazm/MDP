"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";
import { InstallButton } from "@/app/components/InstallButton";
import { STEM_COLOR } from "@/lib/stemColors";
import { SOURCES } from "@/lib/separation/constants";

const RING_COUNT = 6;
const WAVE_BAR_COUNT = 32;
const WAVE_COLORS = SOURCES.map((s) => STEM_COLOR[s]);

export function Hero() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:py-28 text-center">
      <WaveBars />
      <BlurOrbs />
      <BreathingRings />

      <div className="relative mx-auto max-w-2xl animate-fade-in-up">
        <p
          className="text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: "var(--accent-audio)" }}
        >
          {t.hero.eyebrow}
        </p>
        <h1 className="font-display mt-4 text-[34px] sm:text-6xl font-medium tracking-tight leading-[1.15] sm:leading-[1.08]">
          {t.hero.title}
        </h1>
        <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
          {t.hero.subtitle}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/workspace"
            className="shine hover-lift press-scale glow-accent rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{ background: "var(--foreground)", color: "var(--background)" }}
          >
            {t.hero.primaryCta}
          </Link>
          <a
            href="#how-it-works"
            className="hover-lift press-scale rounded-full px-6 py-3 text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--card-border)", color: "var(--foreground)" }}
          >
            {t.hero.secondaryCta}
          </a>
        </div>

        <div className="mt-4 flex justify-center">
          <InstallButton />
        </div>

        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
          style={{ color: "var(--muted)" }}
        >
          <TrustItem>{t.hero.trust.noUpload}</TrustItem>
          <Dot />
          <TrustItem>{t.hero.trust.onDevice}</TrustItem>
          <Dot />
          <TrustItem>
            <span className="ltr-metric">{t.hero.trust.formats}</span>
          </TrustItem>
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

// Deterministic (not Math.random()) so server and client render identical
// heights — avoids a hydration mismatch from picking a new random pattern
// on each render.
function barHeight(i: number) {
  return 30 + 22 * Math.sin(i * 0.7) + 14 * Math.sin(i * 1.9 + 1);
}

function WaveBars() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex h-40 items-end justify-center gap-1 opacity-[0.14]"
      aria-hidden="true"
    >
      {Array.from({ length: WAVE_BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          className="wave-bar w-1.5 rounded-full"
          style={
            {
              height: `${Math.max(14, barHeight(i))}%`,
              background: WAVE_COLORS[i % WAVE_COLORS.length],
              "--i": i,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function BlurOrbs() {
  return (
    <>
      <div
        className="blur-orb animate-blob-drift"
        aria-hidden="true"
        style={{
          width: 420,
          height: 420,
          left: "8%",
          top: "-10%",
          background: "radial-gradient(circle, rgba(106,76,255,0.28), transparent 70%)",
        }}
      />
      <div
        className="blur-orb animate-blob-drift"
        aria-hidden="true"
        style={{
          width: 380,
          height: 380,
          right: "6%",
          bottom: "-15%",
          background: "radial-gradient(circle, rgba(84,214,199,0.18), transparent 70%)",
          animationDelay: "3s",
        }}
      />
    </>
  );
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
