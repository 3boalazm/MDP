import { MODEL_CACHE_NAME } from "./constants";

export class ModelLoadError extends Error {}

/**
 * Downloads an ONNX model with byte-level progress, caching the raw
 * response via the Cache Storage API (keyed by URL) so repeat visits skip
 * the network entirely. Falls back to an uncached fetch if Cache Storage is
 * unavailable (e.g. private browsing in some browsers).
 */
export async function loadModelBytes(
  url: string,
  onProgress: (loadedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const cache = await safeOpenCache();
  const cached = await cache?.match(url);
  if (cached) {
    const buf = await cached.arrayBuffer();
    onProgress(buf.byteLength, buf.byteLength);
    return buf;
  }

  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new ModelLoadError(`Model download failed (HTTP ${response.status}).`);
  }

  const totalBytes = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.byteLength;
    onProgress(loadedBytes, totalBytes);
  }

  const bytes = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  if (cache) {
    try {
      await cache.put(url, new Response(bytes, { headers: response.headers }));
    } catch {
      // Quota exceeded or similar — non-fatal, we still have the bytes in memory.
    }
  }

  return bytes.buffer;
}

async function safeOpenCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(MODEL_CACHE_NAME);
  } catch {
    return null;
  }
}
