"use client";

import { useLocale } from "@/lib/i18n";
import { STEM_COLOR, STEM_GLOW } from "@/lib/stemColors";
import { SOURCES, type Source } from "@/lib/separation/constants";
import { StemIcon } from "@/app/components/StemResultCard";

const TILT: Record<Source, string> = { vocals: "-3deg", drums: "2deg", bass: "-2deg", other: "3deg" };

export function StemsShowcase() {
  const { t } = useLocale();

  return (
    <section className="px-4 py-16 sm:py-20 text-center">
      <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight">{t.stemsShowcase.title}</h2>
      <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
        {t.stemsShowcase.subtitle}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
        {SOURCES.map((source) => {
          const color = STEM_COLOR[source];
          const glow = STEM_GLOW[source];
          return (
            <div
              key={source}
              className="glass stem-tilt-card relative flex w-36 flex-col items-center gap-3 overflow-hidden rounded-2xl py-8"
              style={{ "--tilt": TILT[source], borderColor: "var(--card-border)" } as React.CSSProperties}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(circle at 50% 30%, ${glow}, transparent 70%)` }}
                aria-hidden="true"
              />
              <div
                className="relative flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "var(--card-raised)", boxShadow: `0 0 20px ${glow}` }}
              >
                <StemIcon source={source} color={color} size={22} />
              </div>
              <span className="relative text-sm font-semibold" style={{ color }}>
                {t.stems.label[source]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
