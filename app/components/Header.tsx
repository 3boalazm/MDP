"use client";

import { InstallButton } from "@/app/components/InstallButton";

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{ background: "rgba(9,11,15,0.75)", borderBottom: "1px solid var(--card-border)" }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
        <a href="#top" className="flex items-center gap-2 shrink-0">
          <WaveformMark />
          <span className="text-sm font-semibold tracking-wide">STEM STUDIO</span>
        </a>

        <nav className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "var(--muted)" }}>
          <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
            How it works
          </a>
          <a href="#faq" className="hover:text-[var(--foreground)] transition-colors">
            FAQ
          </a>
          <a href="#privacy" className="hover:text-[var(--foreground)] transition-colors">
            Privacy
          </a>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:block">
            <InstallButton />
          </div>
          <a
            href="#workspace"
            className="rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            Start separating
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
