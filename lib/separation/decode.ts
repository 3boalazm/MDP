import { MAX_DURATION_SECONDS, SAMPLE_RATE } from "./constants";

export class DecodeError extends Error {}
export class DurationError extends Error {}

export interface DecodedTrack {
  buffer: AudioBuffer;
  left: Float32Array;
  right: Float32Array;
  isMono: boolean;
}

/**
 * Decodes to exactly SAMPLE_RATE (44.1kHz) by constructing the AudioContext
 * with that rate — decodeAudioData resamples internally to match it, so we
 * never need a separate resampling pass. Mono input is duplicated to both
 * channels so the model always sees the stereo tensor it requires.
 */
export async function decodeForSeparation(file: File): Promise<DecodedTrack> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate: SAMPLE_RATE });

  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    throw new DecodeError("Couldn't decode this file. Try a standard MP3 or WAV file.");
  } finally {
    ctx.close();
  }

  if (buffer.duration > MAX_DURATION_SECONDS) {
    throw new DurationError(
      `This track is ${(buffer.duration / 60).toFixed(1)} minutes long — the browser-side model is capped at ${MAX_DURATION_SECONDS / 60} minutes to keep memory use bounded.`
    );
  }

  const isMono = buffer.numberOfChannels < 2;
  const left = buffer.getChannelData(0);
  const right = isMono ? left : buffer.getChannelData(1);

  return { buffer, left, right, isMono };
}
