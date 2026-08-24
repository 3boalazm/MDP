/// <reference lib="webworker" />
import "./processPolyfill";
import "./webgpuAdapterInfoPolyfill";
import * as ort from "onnxruntime-web/experimental";
import {
  N_CHANNELS,
  N_SAMPLES,
  OVERLAP,
  SOURCES,
  STRIDE,
  type StemBuffers,
  type WorkerInMessage,
  type WorkerOutMessage,
} from "../lib/separation/constants";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = Math.min(
  (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2,
  4
);

let cancelled = false;

function post(message: WorkerOutMessage, transfer: Transferable[] = []) {
  ctx.postMessage(message, transfer);
}

/** Linear crossfade at both edges of each chunk; flat 1.0 in the middle. */
function makeOverlapWindow(segment: number, overlap: number): Float32Array {
  const w = new Float32Array(segment).fill(1);
  for (let i = 0; i < overlap; i++) {
    const v = i / overlap;
    w[i] = v;
    w[segment - 1 - i] = v;
  }
  return w;
}

async function run(msg: Extract<WorkerInMessage, { type: "run" }>) {
  cancelled = false;
  let session: ort.InferenceSession | null = null;
  try {
    post({ type: "stage", stage: "loading-session" });
    // On wasm, this graph's session creation reliably hit std::bad_alloc /
    // an Emscripten abort with ORT's default arena allocator and graph
    // optimizer — verified on two onnxruntime-web versions and two real
    // machines; even "basic" graphOptimizationLevel (not just "all") still
    // aborts there. webgpu's compute buffers live in VRAM rather than the
    // constrained WASM32 heap, so "optimized" is tried there first (real
    // speed win, zero quality difference) and falls back on failure.
    const { optimized } = msg.profile;
    session = await ort.InferenceSession.create(msg.modelBytes, {
      executionProviders: [msg.profile.provider],
      graphOptimizationLevel: optimized ? "all" : "disabled",
      enableCpuMemArena: optimized,
      enableMemPattern: optimized,
    });
    post({ type: "engine", backend: msg.profile.provider });

    post({ type: "stage", stage: "processing" });
    const { mixL, mixR } = msg;
    const totalLen = mixL.length;
    const nChunks = Math.max(1, Math.ceil(totalLen / STRIDE));
    const nSources = SOURCES.length;
    // One accumulator pair per source (drums, bass, other, vocals) — the
    // model produces all four from a single forward pass, so no extra
    // inference cost to keep them all instead of discarding three.
    const outL: Float32Array[] = SOURCES.map(() => new Float32Array(totalLen));
    const outR: Float32Array[] = SOURCES.map(() => new Float32Array(totalLen));
    const weight = new Float32Array(totalLen);
    const window = makeOverlapWindow(N_SAMPLES, OVERLAP);
    // Reused across every chunk — avoids reallocating a ~2.6MB buffer per chunk.
    const chunkBuf = new Float32Array(N_CHANNELS * N_SAMPLES);

    for (let i = 0; i < nChunks; i++) {
      if (cancelled) {
        post({ type: "cancelled" });
        return;
      }

      const start = i * STRIDE;
      const end = Math.min(start + N_SAMPLES, totalLen);
      const chunkLen = end - start;
      chunkBuf.fill(0);
      chunkBuf.subarray(0, chunkLen).set(mixL.subarray(start, end));
      chunkBuf.subarray(N_SAMPLES, N_SAMPLES + chunkLen).set(mixR.subarray(start, end));

      const inputTensor = new ort.Tensor("float32", chunkBuf, [1, N_CHANNELS, N_SAMPLES]);
      const result = await session.run({ mix: inputTensor });
      const stems = result.stems.data as Float32Array;

      for (let src = 0; src < nSources; src++) {
        const offset = src * N_CHANNELS * N_SAMPLES;
        const dstL = outL[src];
        const dstR = outR[src];
        for (let s = 0; s < chunkLen; s++) {
          const w = window[s];
          dstL[start + s] += stems[offset + s] * w;
          dstR[start + s] += stems[offset + N_SAMPLES + s] * w;
        }
      }
      for (let s = 0; s < chunkLen; s++) {
        weight[start + s] += window[s];
      }

      post({ type: "chunk-progress", chunk: i + 1, totalChunks: nChunks });
      // Yield so a pending "cancel" message can be observed between chunks.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    post({ type: "stage", stage: "finalizing" });
    const transfer: Transferable[] = [];
    const stemsOut = {} as StemBuffers;
    const peaks: Record<string, number> = {};
    for (let src = 0; src < nSources; src++) {
      const dstL = outL[src];
      const dstR = outR[src];
      let peak = 0;
      for (let s = 0; s < totalLen; s++) {
        const w = Math.max(weight[s], 1e-8);
        const l = dstL[s] / w;
        const r = dstR[s] / w;
        dstL[s] = l;
        dstR[s] = r;
        const a = Math.abs(l);
        const b = Math.abs(r);
        if (a > peak) peak = a;
        if (b > peak) peak = b;
      }
      // A separated stem's peak can genuinely exceed the mix's own headroom
      // (an isolated transient can be louder in isolation than its
      // contribution to the mix) — playing that raw would hard-clip at the
      // audio output, heard as a harsh constant buzz. Scale the whole stem
      // down only when needed, preserving its internal dynamics.
      if (peak > 1) {
        const scale = 0.98 / peak;
        for (let s = 0; s < totalLen; s++) {
          dstL[s] *= scale;
          dstR[s] *= scale;
        }
      }
      peaks[SOURCES[src]] = peak;
      stemsOut[SOURCES[src]] = { L: dstL, R: dstR };
      transfer.push(dstL.buffer, dstR.buffer);
    }
    console.log("[separationWorker] per-stem peak levels (pre-limit):", JSON.stringify(peaks));

    post({ type: "done", stems: stemsOut }, transfer);
  } catch (err) {
    const detail =
      err instanceof Error
        ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
        : `[non-Error throw] typeof=${typeof err} value=${String(err)}`;
    console.error("[separationWorker] run() failed:", detail, err);
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    await session?.release().catch(() => {});
  }
}

ctx.addEventListener("message", (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }
  if (msg.type === "run") {
    void run(msg);
  }
});
