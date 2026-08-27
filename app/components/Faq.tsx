"use client";

import { useLocale } from "@/lib/i18n";
import { SERVER_MODE_AVAILABLE } from "@/lib/separation/serverConstants";

export function Faq() {
  const { t } = useLocale();
  const items = SERVER_MODE_AVAILABLE ? [...t.faq.items, t.faq.serverItem] : t.faq.items;

  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-center text-2xl sm:text-3xl font-medium tracking-tight">{t.faq.title}</h1>
        <div className="mt-8 flex flex-col gap-2">
          {items.map((item, i) => (
            <details
              // Index, not item.q — item.q is translated and changes on
              // locale toggle, which would remount every <details> and
              // silently close whichever one the user had open.
              key={i}
              className="hover-lift group rounded-2xl px-4 py-3.5"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium list-none">
                {item.q}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="2"
                  className="shrink-0 transition-transform group-open:rotate-45"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
