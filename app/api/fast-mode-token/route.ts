import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

// Mints a short-lived, single-purpose token for the browser to call the
// Modal "Fast Mode" endpoint directly (see server/app.py). The real shared
// secret (MODAL_SHARED_SECRET, no NEXT_PUBLIC_ prefix) lives only here, on
// the server — the browser only ever sees this expiring, purpose-limited
// token, never the secret itself. Modal verifies the token with the same
// secret via HMAC, so no shared state/DB is needed between the two.
const SECRET = process.env.MODAL_SHARED_SECRET;
const TOKEN_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  if (!SECRET) {
    return NextResponse.json({ error: "Fast Mode isn't configured." }, { status: 503 });
  }
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const signature = createHmac("sha256", SECRET).update(String(expiresAt)).digest("hex");
  return NextResponse.json({ token: `${expiresAt}.${signature}` });
}
