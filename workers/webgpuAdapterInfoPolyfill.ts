// onnxruntime-web@1.18's WebGPU backend calls the old draft-spec
// `GPUAdapter.requestAdapterInfo()` method to log adapter details. Current
// browsers implement the finalized spec instead, which replaced that async
// method with a synchronous `GPUAdapter.info` property — so the old method
// doesn't exist, and WebGPU init throws "requestAdapterInfo is not a
// function" before it ever gets to create a session, forcing a fallback to
// WASM (much slower — no GPU acceleration) even when a real GPU is
// available. Patch it back in per-adapter, wrapping the modern property.
// Must be imported before "onnxruntime-web" anywhere in the worker.
if (typeof navigator !== "undefined" && "gpu" in navigator) {
  const gpu = (navigator as unknown as { gpu: { requestAdapter: (...args: unknown[]) => Promise<unknown> } }).gpu;
  const originalRequestAdapter = gpu.requestAdapter.bind(gpu);
  gpu.requestAdapter = async (...args: unknown[]) => {
    const adapter = await originalRequestAdapter(...args);
    const a = adapter as Record<string, unknown> | null;
    if (a && typeof a.requestAdapterInfo !== "function") {
      a.requestAdapterInfo = () => Promise.resolve(a.info ?? {});
    }
    return adapter;
  };
}

export {};
