"use client";

import Link from "next/link";
import { Logo } from "@/app/components/Logo";
import { useLocale } from "@/lib/i18n";

export function Header() {
  const { t, locale, toggleLocale } = useLocale();

  return (
    <header className="glass sticky top-0 z-40">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label={t.header.brand}>
          <Logo variant="icon" height={36} className="brand-glow-hover" />
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "var(--muted)" }}>
          <Link href="/#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
            {t.header.nav.howItWorks}
          </Link>
          <Link href="/#faq" className="hover:text-[var(--foreground)] transition-colors">
            {t.header.nav.faq}
          </Link>
          <Link href="/#privacy" className="hover:text-[var(--foreground)] transition-colors">
            {t.header.nav.privacy}
          </Link>
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
          <Link
            href="/workspace"
            className="shine hover-lift press-scale rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {t.header.cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
