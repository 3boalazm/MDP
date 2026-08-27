// Config for the optional server-side "Fast Mode" (see hf-space/app.py).
// Unlike the previous Modal integration, the Hugging Face Space URL is
// server-only (HF_SPACE_URL, no NEXT_PUBLIC_ prefix) — the browser never
// calls it directly, only the Vercel relay routes under
// web/app/api/hf-separate/ do (see useHuggingFaceSeparation.ts). So
// availability can't be derived from a client-readable URL the way
// SERVER_MODE_AVAILABLE used to be; it needs its own explicit, non-sensitive
// public flag instead. Left unset, Fast Mode simply doesn't render.
export const HF_SEPARATE_AVAILABLE = Boolean(process.env.NEXT_PUBLIC_HF_SEPARATE_AVAILABLE);
