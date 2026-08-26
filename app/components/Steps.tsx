const STEPS = [
  {
    n: "01",
    title: "Drop your song",
    body: "Choose an MP3, WAV, or M4A file. It never leaves your device.",
  },
  {
    n: "02",
    title: "Separate locally",
    body: "An AI model runs in your browser, isolating vocals, drums, bass & other.",
  },
  {
    n: "03",
    title: "Preview & download",
    body: "Play each stem, mute or solo, and export the WAV files you need.",
  },
];

export function Steps() {
  return (
    <section id="how-it-works" className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="rounded-2xl p-5"
              style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
            >
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--accent-audio)" }}>
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
