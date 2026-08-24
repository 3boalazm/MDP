import type { Source } from "./constants";

/**
 * Sums the selected stems at their given gains into one stereo AudioBuffer.
 * Only scales down if the sum would clip (peak > 1) — preserves relative
 * dynamics rather than always normalizing.
 */
export function mixStems(
  stems: Record<Source, AudioBuffer>,
  sources: Source[],
  gains: Record<Source, number>
): AudioBuffer {
  const { length, sampleRate } = stems[sources[0]];
  const outL = new Float32Array(length);
  const outR = new Float32Array(length);

  for (const s of sources) {
    const gain = gains[s];
    if (gain === 0) continue;
    const buf = stems[s];
    const l = buf.getChannelData(0);
    const r = buf.getChannelData(1);
    for (let i = 0; i < length; i++) {
      outL[i] += l[i] * gain;
      outR[i] += r[i] * gain;
    }
  }

  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(outL[i]);
    const b = Math.abs(outR[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  if (peak > 1) {
    const scale = 1 / peak;
    for (let i = 0; i < length; i++) {
      outL[i] *= scale;
      outR[i] *= scale;
    }
  }

  const out = new AudioBuffer({ numberOfChannels: 2, length, sampleRate });
  out.copyToChannel(outL, 0);
  out.copyToChannel(outR, 1);
  return out;
}
