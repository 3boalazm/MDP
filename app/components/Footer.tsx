"use client";

import Link from "next/link";
import { Logo } from "@/app/components/Logo";
import { useLocale } from "@/lib/i18n";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer id="privacy" className="px-4 py-14 scroll-mt-16" style={{ borderTop: "1px solid var(--card-border)" }}>
      <div className="mx-auto max-w-2xl flex flex-col items-center text-center gap-4">
        <Logo height={24} />
        <p className="font-display text-base font-medium">{t.footer.tagline}</p>
        <p className="text-xs leading-relaxed max-w-md" style={{ color: "var(--muted)" }}>
          {t.footer.privacyBody}
        </p>
        <p className="text-[11px] leading-relaxed max-w-md" style={{ color: "var(--muted)" }}>
          {t.footer.engineBody}
        </p>
        <div className="flex items-center gap-4 text-xs mt-1" style={{ color: "var(--muted)" }}>
          <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.howItWorks}
          </a>
          <a href="#faq" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.faq}
          </a>
          <Link href="/workspace" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.newSeparation}
          </Link>
        </div>
      </div>
    </footer>
  );
}
