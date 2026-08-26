import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remove Vocals — AI Stem Separator",
    short_name: "Remove Vocals",
    description: "Strip vocals, drums, bass & other stems from any song — entirely in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#090b0f",
    theme_color: "#090b0f",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
