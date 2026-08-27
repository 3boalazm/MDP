import { ImageResponse } from "next/og";

// A simplified single-path waveform glyph, colored to match the SakanWave
// logo (white, from public/logo-sakanwave.svg) — square PWA icon sizes need
// a compact mark, not the full wordmark lockup used in the header.
const WAVEFORM_PATH =
  "M2 13c1.5 0 1.5-6 3-6s1.5 9 3 9 1.5-12 3-12 1.5 15 3 15 1.5-9 3-9 1.5 6 3 6";

/**
 * Renders the app's waveform mark on the dark canvas background. Used by the
 * icon route handlers below so every PWA icon size stays in sync — no
 * external image tooling required, just next/og's Satori-based renderer.
 */
export function buildIconResponse(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const pad = Math.round(size * (maskable ? 0.3 : 0.2));
  const markSize = size - pad * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #12161d 0%, #090b0f 100%)",
        }}
      >
        <svg width={markSize} height={markSize} viewBox="0 0 24 24" fill="none">
          <path
            d={WAVEFORM_PATH}
            stroke="#ffffff"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
