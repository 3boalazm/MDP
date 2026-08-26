import { SERVER_MODE_AVAILABLE } from "@/lib/separation/serverConstants";

const BASE_FAQ = [
  {
    q: "Does my audio ever leave my device?",
    a: "No, not in the default on-device mode. The AI models are downloaded once and cached in your browser, then every separation runs locally — your audio file is never sent anywhere.",
  },
  {
    q: "What file formats and limits are supported?",
    a: "MP3, WAV, and M4A, up to 100MB and 12 minutes per file. Stereo files give the model real left/right information to work with, so they separate more accurately than mono.",
  },
  {
    q: "How long does separation take?",
    a: "It depends on your device and which specialist models you enable. The first run also downloads the models (up to ~650MB total), which are cached afterward so later runs skip straight to processing.",
  },
  {
    q: "What happens if the AI engine can't run on my device?",
    a: "You'll be offered a basic fallback that uses phase cancellation instead of AI. It's noticeably lower quality, but still fully local — nothing is uploaded.",
  },
];

const SERVER_FAQ = {
  q: "What does Fast Mode change about privacy?",
  a: "Fast Mode trades privacy for speed: your audio is uploaded to a GPU server for processing instead of running in your browser. Use on-device mode if keeping your audio local matters to you.",
};

export function Faq() {
  const items = SERVER_MODE_AVAILABLE ? [...BASE_FAQ, SERVER_FAQ] : BASE_FAQ;

  return (
    <section id="faq" className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight">FAQ</h2>
        <div className="mt-8 flex flex-col gap-2">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl px-4 py-3.5"
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
