"use client";

import { useLocale } from "@/lib/i18n";

export function Header() {
  const { t, locale, toggleLocale } = useLocale();

  return (
    <header className="glass sticky top-0 z-40">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
        <a href="#top" className="flex items-center gap-2 shrink-0">
          <WaveformMark />
          <span className="font-display text-base font-medium tracking-wide">{t.header.brand}</span>
        </a>

        <nav className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "var(--muted)" }}>
          <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
            {t.header.nav.howItWorks}
          </a>
          <a href="#faq" className="hover:text-[var(--foreground)] transition-colors">
            {t.header.nav.faq}
          </a>
          <a href="#privacy" className="hover:text-[var(--foreground)] transition-colors">
            {t.header.nav.privacy}
          </a>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={toggleLocale}
            className="hover-lift press-scale rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ border: "1px solid var(--card-border)", color: "var(--foreground)" }}
            aria-label={t.common.switchTo}
            title={t.common.switchTo}
          >
            {locale === "ar" ? "EN" : "AR"}
          </button>
          <a
            href="#workspace"
            className="shine hover-lift press-scale rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {t.header.cta}
          </a>
        </div>
      </div>
    </header>
  );
}

export function WaveformMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 13c1.5 0 1.5-6 3-6s1.5 9 3 9 1.5-12 3-12 1.5 15 3 15 1.5-9 3-9 1.5 6 3 6"
        stroke="var(--accent-audio)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
