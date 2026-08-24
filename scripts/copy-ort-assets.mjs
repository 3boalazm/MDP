import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "node_modules", "onnxruntime-web", "dist");
const dest = join(here, "..", "public", "ort");

// Clear stale files from a previous onnxruntime-web version before copying —
// filenames can collide across versions while the binary contents differ.
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// Both the plain and JSEP (WebGPU-capable) wasm runtimes, self-hosted so the
// static Vercel deployment never depends on a third-party CDN for the ORT
// runtime itself (only the model weights come from an external host).
// onnxruntime-web 1.18.x ships only .wasm binaries (loader JS is bundled
// into ort.*.js); newer versions also ship matching .mjs loader files.
const candidates = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

let copied = 0;
for (const file of candidates) {
  const from = join(src, file);
  if (!existsSync(from)) continue;
  copyFileSync(from, join(dest, file));
  copied++;
}

console.log(`copy-ort-assets: copied ${copied} files to public/ort/`);
