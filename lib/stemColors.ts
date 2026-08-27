import type { Source } from "@/lib/separation/constants";

/** One accent color per stem — see the --stem-* tokens in globals.css. */
export const STEM_COLOR: Record<Source, string> = {
  vocals: "var(--stem-vocals)",
  drums: "var(--stem-drums)",
  bass: "var(--stem-bass)",
  other: "var(--stem-other)",
};

export const STEM_GLOW: Record<Source, string> = {
  vocals: "var(--glow-vocals)",
  drums: "var(--glow-drums)",
  bass: "var(--glow-bass)",
  other: "var(--glow-other)",
};
