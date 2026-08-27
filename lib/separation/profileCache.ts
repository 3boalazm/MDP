import type { SessionProfile } from "./constants";

// Remembers which session profile actually worked on THIS browser/device the
// last time the main pass ran, so the next separation can try it first
// instead of re-paying the fail-then-fallback cost of a profile known not to
// work here (e.g. a GPU/driver that reliably rejects "optimized" WebGPU).
// Never removes a fallback option — only reorders the attempt list so the
// known-good one goes first. Only updated from the main pass (the only pass
// that ever attempts "optimized"), so a device that gains WebGPU support
// later (driver update) re-probes it next time the cache is cleared, not
// automatically — an accepted trade-off for a v1 local cache.
const STORAGE_KEY = "demucs:main-pass-profile:v1";

function isSessionProfile(value: unknown): value is SessionProfile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.provider === "webgpu" || v.provider === "wasm") &&
    typeof v.optimized === "boolean" &&
    (v.numThreads === undefined || typeof v.numThreads === "number")
  );
}

export function getCachedProfile(): SessionProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSessionProfile(parsed) ? parsed : null;
  } catch {
    return null; // Private browsing, disabled storage, corrupt value — just skip the optimization.
  }
}

export function setCachedProfile(profile: SessionProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable/full — this is a pure speed optimization, safe to drop.
  }
}

/** Moves `cached` to the front of `profiles` if it's one of the candidates
 * for this pass, leaving the rest in their original order as fallback. */
export function prioritizeCachedProfile(profiles: SessionProfile[], cached: SessionProfile | null): SessionProfile[] {
  if (!cached) return profiles;
  const match = profiles.find(
    (p) => p.provider === cached.provider && p.optimized === cached.optimized && p.numThreads === cached.numThreads
  );
  if (!match) return profiles;
  return [match, ...profiles.filter((p) => p !== match)];
}
