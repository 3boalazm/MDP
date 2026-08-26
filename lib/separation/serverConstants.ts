// Config for the optional server-side "Fast Mode" (see server/app.py).
// The Modal URL is public by nature (it's the request destination), so it's
// fine as NEXT_PUBLIC_*. There is deliberately no client-side API key here —
// the real shared secret (MODAL_SHARED_SECRET) lives only on the Next.js
// server; the browser fetches a short-lived signed token from
// /api/fast-mode-token instead (see that route + server/app.py). Left unset,
// Fast Mode simply doesn't render.
export const MODAL_SEPARATE_URL = process.env.NEXT_PUBLIC_MODAL_SEPARATE_URL ?? "";
export const SERVER_MODE_AVAILABLE = Boolean(MODAL_SEPARATE_URL);
