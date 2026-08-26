"use client";

import { useLocale } from "@/lib/i18n";

export function Steps() {
  const { t } = useLocale();

  return (
    <section id="how-it-works" className="px-4 py-16 sm:py-20 scroll-mt-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-center text-2xl sm:text-3xl font-medium tracking-tight">{t.steps.title}</h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {t.steps.items.map((step) => (
            <div
              key={step.n}
              className="hover-lift rounded-2xl p-5"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              <span className="ltr-metric inline-block text-xs font-semibold tabular-nums" style={{ color: "var(--accent-audio)" }}>
                {step.n}
              </span>
              <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
