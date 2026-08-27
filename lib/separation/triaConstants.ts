// Config for the experimental TRIA drum-generation path (see
// web/server/tria_app.py). Same pattern as serverConstants.ts: the Modal URL
// is public by nature (it's the request destination the browser calls
// directly), so NEXT_PUBLIC_* is fine — there is deliberately no client-side
// secret, auth is a short-lived token minted server-side (reuses
// /api/fast-mode-token, same MODAL_SHARED_SECRET as Fast Mode). Left unset,
// this feature simply doesn't render.
export const MODAL_TRIA_URL = process.env.NEXT_PUBLIC_MODAL_TRIA_URL ?? "";
export const TRIA_AVAILABLE = Boolean(MODAL_TRIA_URL);

// TRIA's pretrained weights are CC BY-NC-SA 4.0 (non-commercial) — see
// hf-space/README.md "TRIA licensing". This is a UI-facing disclosure, not
// an enforcement mechanism (the real gate is server-side, see
// web/server/tria_app.py's tria-license-ack secret check).
export const TRIA_NC_LICENSE_NOTE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
