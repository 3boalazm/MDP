import { WaveformMark } from "@/app/components/Header";

export function Footer() {
  return (
    <footer id="privacy" className="px-4 py-14" style={{ borderTop: "1px solid var(--card-border)" }}>
      <div className="mx-auto max-w-2xl flex flex-col items-center text-center gap-4">
        <WaveformMark size={20} />
        <p className="text-sm font-medium">Your audio stays yours.</p>
        <p className="text-xs leading-relaxed max-w-md" style={{ color: "var(--muted)" }}>
          On-device separation runs entirely in your browser via onnxruntime-web. Model files are cached
          locally after the first download and can be cleared anytime from your browser&apos;s site data
          settings — nothing about your audio is stored or sent to a server.
        </p>
        <p className="text-[11px] leading-relaxed max-w-md" style={{ color: "var(--muted)" }}>
          Primary engine: four HT-Demucs FT specialist models (MIT licensed), run entirely on-device via
          onnxruntime-web — one per stem (vocals, drums, bass, other). Phase cancellation is used only as a
          fallback if the models can&apos;t run on this device.
        </p>
        <div className="flex items-center gap-4 text-xs mt-1" style={{ color: "var(--muted)" }}>
          <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
            How it works
          </a>
          <a href="#faq" className="hover:text-[var(--foreground)] transition-colors">
            FAQ
          </a>
          <a href="#workspace" className="hover:text-[var(--foreground)] transition-colors">
            New separation
          </a>
        </div>
      </div>
    </footer>
  );
}
