import { NextResponse } from "next/server";

// Polls a Hugging Face ZeroGPU job's status. Never holds a long-lived
// connection — opens the Space's SSE stream for this event_id, reads for a
// bounded window, then closes, regardless of whether the job is done yet.
// The browser re-calls this route every ~1.5s (see
// web/lib/separation/useHuggingFaceSeparation.ts) until it gets back a zip.
//
// This keeps every invocation short (well under any Vercel Function
// timeout) instead of needing one continuous connection per job — job state
// lives server-side on Hugging Face, keyed by event_id, so a fresh short
// poll can always pick up wherever the job currently is.
//
// NOTE: exact Gradio SSE event names/payload shapes for
// /gradio_api/call/<fn>/<event_id> can drift slightly across Gradio
// versions — this parser is intentionally defensive (looks for a "complete"
// or "error" event by name, falls back to plain "processing" if neither
// arrives within the read window) and should be checked against the actual
// deployed Space's behavior; see hf-space/README.md's curl verification
// steps.
export const maxDuration = 15;

const HF_TOKEN = process.env.HF_TOKEN;
const HF_SPACE_URL = process.env.HF_SPACE_URL;
const READ_WINDOW_MS = 8000;

type ErrorKind = "auth" | "rate-limit" | "quota" | "network" | "server";

function classifyError(message: string): ErrorKind {
  const lower = message.toLowerCase();
  if (lower.includes("quota") || lower.includes("gpu budget") || lower.includes("daily")) return "quota";
  if (lower.includes("rate") || lower.includes("429") || lower.includes("too many")) return "rate-limit";
  if (lower.includes("token") || lower.includes("auth") || lower.includes("401") || lower.includes("403")) return "auth";
  return "server";
}

function fileDataUrl(fileData: { url?: string; path?: string }): string | null {
  if (fileData.url) return fileData.url;
  if (fileData.path) return `${HF_SPACE_URL}/gradio_api/file=${encodeURIComponent(fileData.path)}`;
  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!HF_TOKEN || !HF_SPACE_URL) {
    return NextResponse.json({ status: "error", error: "Fast Mode isn't configured.", errorKind: "server" }, { status: 503 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ status: "error", error: "Missing jobId.", errorKind: "server" }, { status: 400 });
  }

  let sseRes: Response;
  try {
    sseRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/separate/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${HF_TOKEN}`, Accept: "text/event-stream" },
    });
  } catch {
    return NextResponse.json({ status: "queued" });
  }
  if (!sseRes.ok || !sseRes.body) {
    return NextResponse.json({ status: "queued" });
  }

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + READ_WINDOW_MS;

  try {
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const chunk = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), Math.max(0, remaining))
        ),
      ]);
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // SSE frames are separated by a blank line; each frame has "event:"
      // and "data:" lines.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
        const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
        const eventName = eventLine?.slice(6).trim();
        const dataStr = dataLine?.slice(5).trim();

        if (eventName === "error") {
          let message = "Fast Mode processing failed.";
          try {
            const parsed = dataStr ? JSON.parse(dataStr) : null;
            if (typeof parsed === "string") message = parsed;
            else if (parsed?.message) message = parsed.message;
          } catch {
            // fall through with default message
          }
          return NextResponse.json({ status: "error", error: message, errorKind: classifyError(message) });
        }

        if (eventName === "complete") {
          let outputPath: { url?: string; path?: string } | null = null;
          try {
            const parsed = dataStr ? JSON.parse(dataStr) : null;
            const first = Array.isArray(parsed) ? parsed[0] : null;
            if (first && typeof first === "object") outputPath = first as { url?: string; path?: string };
          } catch {
            // fall through — handled by the null check below
          }
          const resultUrl = outputPath ? fileDataUrl(outputPath) : null;
          if (!resultUrl) {
            return NextResponse.json({ status: "error", error: "Couldn't read the server's result.", errorKind: "server" });
          }

          const fileRes = await fetch(resultUrl, { headers: { Authorization: `Bearer ${HF_TOKEN}` } });
          if (!fileRes.ok || !fileRes.body) {
            return NextResponse.json({ status: "error", error: "Couldn't download the server's result.", errorKind: "server" });
          }
          return new NextResponse(fileRes.body, { headers: { "Content-Type": "application/zip" } });
        }
        // Any other named event (e.g. "heartbeat", "generating") just means
        // the job is alive — keep reading within the window.
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
  }

  return NextResponse.json({ status: "processing" });
}
