import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cross-origin isolation unlocks SharedArrayBuffer, which lets
  // onnxruntime-web's WASM execution provider use multiple threads instead
  // of one. The model fetch (huggingface.co) already sends a permissive
  // Access-Control-Allow-Origin, which satisfies COEP for that request.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
