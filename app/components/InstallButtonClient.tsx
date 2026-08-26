"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

// Rendered only on the client (see InstallButton.tsx) so these lazy
// initializers, which read browser-only APIs, can never mismatch SSR output.
export function InstallButtonClient() {
  const { t } = useLocale();
  const [installed, setInstalled] = useState(isStandalone);
  const [iosEligible] = useState(isIOSSafari);
  const [showIOS, setShowIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferredPrompt && !iosEligible) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    setShowIOS(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t.install.button}
        className="hover-lift press-scale inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
        style={{ borderColor: "var(--card-border)", color: "var(--accent)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.install.button}
      </button>

      {showIOS && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6"
          onClick={() => setShowIOS(false)}
        >
          <div
            className="glass w-full max-w-sm rounded-2xl p-6 shadow-lg animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium">{t.install.iosTitle}</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {t.install.iosBody}
            </p>
            <button
              type="button"
              onClick={() => setShowIOS(false)}
              className="hover-lift press-scale mt-4 w-full rounded-full py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {t.install.gotIt}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
