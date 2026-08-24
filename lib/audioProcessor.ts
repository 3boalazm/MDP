// Non-AI fallback engine, used only when the ONNX model (lib/separation)
// can't load or run on this device. See lib/separation/useSeparation.ts for
// the primary, AI-based pipeline.
export class UnsupportedAudioError extends Error {}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } catch {
    throw new UnsupportedAudioError(
      "Couldn't decode this file. Try a standard MP3 or WAV file."
    );
  } finally {
    ctx.close();
  }
}

/**
 * Classic phase-cancellation "karaoke" trick: content panned dead-center
 * (often lead vocals, but also bass/kick in many mixes) cancels out when
 * one channel is subtracted from the other. Mono files carry no stereo
 * information to exploit, so they pass through unchanged.
 */
export function removeCenterChannel(buffer: AudioBuffer, strength: number): AudioBuffer {
  const { numberOfChannels, length, sampleRate } = buffer;

  if (numberOfChannels < 2) {
    const out = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
    out.copyToChannel(buffer.getChannelData(0), 0);
    return out;
  }

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const outL = new Float32Array(length);
  const outR = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    outL[i] = left[i] - strength * right[i];
    outR[i] = right[i] - strength * left[i];
  }

  const out = new AudioBuffer({ numberOfChannels: 2, length, sampleRate });
  out.copyToChannel(outL, 0);
  out.copyToChannel(outR, 1);
  return out;
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  const dataLength = buffer.length * numChannels * (bitDepth / 8);
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const clamped = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
