// onnxruntime-web@1.18's UMD-style bundle references `process.env` at module
// evaluation time. That's normally shimmed by bundlers for the main thread,
// but Turbopack doesn't inject the same shim into a Worker's module graph —
// causing a ReferenceError before the worker ever runs a line of our code.
// Must be imported before "onnxruntime-web" anywhere in the worker.
if (typeof (globalThis as Record<string, unknown>).process === "undefined") {
  (globalThis as Record<string, unknown>).process = { env: {} };
}

export {};
