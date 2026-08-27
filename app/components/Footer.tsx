"use client";

import Link from "next/link";
import { Logo } from "@/app/components/Logo";
import { useLocale } from "@/lib/i18n";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="px-4 py-10" style={{ borderTop: "1px solid var(--card-border)" }}>
      <div className="mx-auto max-w-2xl flex flex-col items-center text-center gap-3">
        <Logo height={22} />
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t.footer.tagline}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs mt-1" style={{ color: "var(--muted)" }}>
          <Link href="/how-it-works" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.howItWorks}
          </Link>
          <Link href="/faq" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.faq}
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.privacy}
          </Link>
          <Link href="/workspace" className="hover:text-[var(--foreground)] transition-colors">
            {t.footer.nav.newSeparation}
          </Link>
        </div>
      </div>
    </footer>
  );
}
