"use client";

import { useLocale } from "@/lib/i18n";
import { SERVER_MODE_AVAILABLE } from "@/lib/separation/serverConstants";

export function Privacy() {
  const { t } = useLocale();

  const sections = [
    { title: t.privacy.onDeviceTitle, body: t.privacy.onDeviceBody },
    { title: t.privacy.cachingTitle, body: t.privacy.cachingBody },
    { title: t.privacy.engineTitle, body: t.privacy.engineBody },
    ...(SERVER_MODE_AVAILABLE ? [{ title: t.privacy.fastModeTitle, body: t.privacy.fastModeBody }] : []),
  ];

  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-center text-2xl sm:text-3xl font-medium tracking-tight">{t.privacy.title}</h1>
        <p className="mt-3 text-center text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
          {t.privacy.subtitle}
        </p>

        <div className="mt-10 flex flex-col gap-2">
          {sections.map((s) => (
            <div
              key={s.title}
              className="hover-lift rounded-2xl p-5"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
