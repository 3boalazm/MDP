// HT-Demucs FT specialist checkpoints, exported to ONNX by StemSplit
// (https://github.com/StemSplit/demucs-onnx, MIT license) from Meta's
// original HT-Demucs weights (facebookresearch/demucs, MIT license).
// fp16 weights: same accuracy as fp32 for this graph, half the download.
// The architecture always outputs all 4 sources in one forward pass — each
// checkpoint is just fine-tuned with extra emphasis on ONE source, so its
// output for that source is the strongest; the other 3 channels from the
// same pass are still real, just not that checkpoint's specialty.
export const MODEL_URL =
  "https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/resolve/main/htdemucs_ft_vocals_fp16weights.onnx";
export const MODEL_NAME = "HT-Demucs FT";
export const MODEL_CACHE_NAME = "demucs-model-v1";

// Additional specialist passes, each run only to replace one weak channel
// from the vocals checkpoint above with that checkpoint's specialized
// output for its own source — the other 3 channels from each pass are
// discarded.
export const DRUMS_MODEL_URL =
  "https://huggingface.co/StemSplitio/htdemucs-ft-drums-onnx/resolve/main/htdemucs_ft_drums_fp16weights.onnx";
export const DRUMS_MODEL_NAME = "HT-Demucs FT (drums)";

export const BASS_MODEL_URL =
  "https://huggingface.co/StemSplitio/htdemucs-ft-bass-onnx/resolve/main/htdemucs_ft_bass_fp16weights.onnx";
export const BASS_MODEL_NAME = "HT-Demucs FT (bass)";

export const OTHER_MODEL_URL =
  "https://huggingface.co/StemSplitio/htdemucs-ft-other-onnx/resolve/main/htdemucs_ft_other_fp16weights.onnx";
export const OTHER_MODEL_NAME = "HT-Demucs FT (other)";

// The ONNX graph is hard-bound to 44.1kHz stereo input, shape [1, 2, N_SAMPLES].
export const SAMPLE_RATE = 44100;
export const SEGMENT_SECONDS = 7.8;
export const N_SAMPLES = Math.round(SEGMENT_SECONDS * SAMPLE_RATE); // 343,980
export const N_CHANNELS = 2;
export const OVERLAP = Math.floor(N_SAMPLES / 4);
export const STRIDE = N_SAMPLES - OVERLAP;

// Output tensor "stems" has shape (1, 4, 2, N) in this fixed order.
export const SOURCES = ["drums", "bass", "other", "vocals"] as const;
export type Source = (typeof SOURCES)[number];

export type StemBuffers = Record<Source, { L: Float32Array; R: Float32Array }>;

// Per-stem mixer fader range: 100% is unity (the model's original output
// level); up to 150% lets a stem be boosted above that.
export const MAX_GAIN = 1.5;

export const MAX_INPUT_MB = 100;
export const MAX_DURATION_SECONDS = 12 * 60;

export type EngineBackend = "webgpu" | "wasm";

// A session profile: which execution provider, and whether to use ORT's
// normal (faster) graph optimizer + memory arena, or the constrained
// settings forced by this model's memory footprint. wasm only ever fits
// "unoptimized" (verified — even "basic" aborts); webgpu MAY tolerate
// "optimized" on real GPU hardware since compute buffers live in VRAM, not
// the constrained WASM32 heap — untested on real hardware, so it's tried
// first and falls back to "unoptimized" webgpu, then wasm, on failure.
export interface SessionProfile {
  provider: EngineBackend;
  optimized: boolean;
}

export const ATTEMPT_PROFILES_WITH_GPU: SessionProfile[] = [
  { provider: "webgpu", optimized: true },
  { provider: "webgpu", optimized: false },
  { provider: "wasm", optimized: false },
];
// For every pass after the first, the previous pass's just-terminated
// webgpu context may not have fully released its GPU memory yet — the
// higher-memory "optimized" attempt is the one most likely to fail from
// that leftover pressure, and failing it first just wastes time before
// falling through anyway. Skip straight to the leaner "unoptimized" webgpu
// attempt (still GPU-accelerated), then wasm.
export const ATTEMPT_PROFILES_WITH_GPU_SUBSEQUENT: SessionProfile[] = [
  { provider: "webgpu", optimized: false },
  { provider: "wasm", optimized: false },
];
export const ATTEMPT_PROFILES_NO_GPU: SessionProfile[] = [{ provider: "wasm", optimized: false }];

export type WorkerInMessage =
  | {
      type: "run";
      modelBytes: ArrayBuffer;
      mixL: Float32Array;
      mixR: Float32Array;
      // A single attempt targets exactly one profile. Each attempt gets its
      // own fresh worker (and therefore its own WASM linear memory instance)
      // — trying multiple profiles sequentially in one worker was found to
      // compound memory pressure and fail attempts with std::bad_alloc even
      // when tried alone would have fit (see onnxruntime issue #10957).
      profile: SessionProfile;
    }
  | { type: "cancel" };

export type WorkerOutMessage =
  | { type: "engine"; backend: EngineBackend }
  | { type: "stage"; stage: "loading-session" | "processing" | "finalizing" }
  | { type: "chunk-progress"; chunk: number; totalChunks: number }
  | { type: "done"; stems: StemBuffers }
  | { type: "cancelled" }
  | { type: "error"; message: string };
