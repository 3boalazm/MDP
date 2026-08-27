import { createHmac } from "node:crypto";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

// Kicks off a Hugging Face ZeroGPU separation job. The browser never talks
// to Hugging Face directly (the real HF_TOKEN must stay server-side), so
// this route: fetches the just-uploaded file from Vercel Blob server-side,
// forwards it to the Space with the real token attached, then deletes the
// Blob object now that Hugging Face has ingested the bytes. See
// hf-space/app.py for the receiving side and web/app/api/fast-mode-token
// /route.ts for the HMAC-token pattern this mirrors (new shared secret,
// same scheme).
export const maxDuration = 30; // blob fetch + 2 HF POSTs — well under Vercel's limits

const HF_TOKEN = process.env.HF_TOKEN;
const HF_SPACE_URL = process.env.HF_SPACE_URL;
const HF_SPACE_SHARED_SECRET = process.env.HF_SPACE_SHARED_SECRET;
const TOKEN_TTL_MS = 5 * 60 * 1000;

function mintToken(secret: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const signature = createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${signature}`;
}

interface SeparateOptions {
  drums?: boolean;
  bass?: boolean;
  other?: boolean;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!HF_TOKEN || !HF_SPACE_URL || !HF_SPACE_SHARED_SECRET) {
    return NextResponse.json({ error: "Fast Mode isn't configured.", errorKind: "server" }, { status: 503 });
  }

  let blobUrl: string;
  let options: SeparateOptions;
  try {
    const body = (await request.json()) as { blobUrl?: string; options?: SeparateOptions };
    if (!body.blobUrl || typeof body.blobUrl !== "string") {
      return NextResponse.json({ error: "Missing blobUrl.", errorKind: "validation" }, { status: 400 });
    }
    blobUrl = body.blobUrl;
    options = body.options ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid request body.", errorKind: "validation" }, { status: 400 });
  }

  let fileBytes: ArrayBuffer;
  let fileName: string;
  try {
    const blobRes = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!blobRes.ok) {
      return NextResponse.json({ error: "Couldn't read the uploaded file.", errorKind: "server" }, { status: 502 });
    }
    fileBytes = await blobRes.arrayBuffer();
    fileName = new URL(blobUrl).pathname.split("/").pop() || "upload";
  } catch {
    return NextResponse.json({ error: "Couldn't read the uploaded file.", errorKind: "network" }, { status: 502 });
  }

  let uploadedPath: string;
  try {
    const form = new FormData();
    form.append("files", new Blob([fileBytes]), fileName);
    const uploadRes = await fetch(`${HF_SPACE_URL}/gradio_api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}` },
      body: form,
    });
    if (!uploadRes.ok) {
      const kind = uploadRes.status === 401 || uploadRes.status === 403 ? "auth" : "server";
      return NextResponse.json(
        { error: `Fast Mode server rejected the upload (HTTP ${uploadRes.status}).`, errorKind: kind },
        { status: 502 }
      );
    }
    const uploaded = (await uploadRes.json()) as string[];
    uploadedPath = uploaded[0];
  } catch {
    return NextResponse.json({ error: "Couldn't reach the Fast Mode server.", errorKind: "network" }, { status: 502 });
  } finally {
    // Best-effort cleanup — the Blob's only purpose was getting the bytes to
    // Hugging Face, and it's private + random-suffixed either way, but
    // deleting it promptly keeps the free 1GB store from filling up.
    void del(blobUrl).catch(() => {});
  }

  try {
    const hmacToken = mintToken(HF_SPACE_SHARED_SECRET);
    const callRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/separate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { path: uploadedPath, meta: { _type: "gradio.FileData" } },
          hmacToken,
          options.drums ?? true,
          options.bass ?? true,
          options.other ?? true,
        ],
      }),
    });
    if (!callRes.ok) {
      const kind = callRes.status === 429 ? "rate-limit" : callRes.status === 401 || callRes.status === 403 ? "auth" : "server";
      return NextResponse.json(
        { error: `Fast Mode server couldn't start the job (HTTP ${callRes.status}).`, errorKind: kind },
        { status: 502 }
      );
    }
    const { event_id: jobId } = (await callRes.json()) as { event_id: string };
    return NextResponse.json({ jobId });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the Fast Mode server.", errorKind: "network" }, { status: 502 });
  }
}
