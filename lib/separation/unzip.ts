// Dependency-free reader for zip archives written with STORED (uncompressed)
// entries only — matches server/app.py's response format exactly (MP3 is
// already compressed, so the server skips deflate). No npm dependency needed
// since there's nothing to decompress, just byte ranges to slice out.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const MAX_COMMENT_LENGTH = 0xffff;

export class ZipParseError extends Error {}

export function parseStoredZip(buffer: ArrayBuffer): Map<string, ArrayBuffer> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const searchStart = Math.max(0, buffer.byteLength - 22 - MAX_COMMENT_LENGTH);
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new ZipParseError("Not a valid zip file (no end-of-central-directory record).");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  const result = new Map<string, ArrayBuffer>();
  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_DIR_SIGNATURE) {
      throw new ZipParseError("Malformed zip central directory.");
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (method !== 0) {
      throw new ZipParseError(`Unsupported compression method for "${name}" (expected stored).`);
    }

    // The local file header repeats name/extra lengths, which can differ
    // from the central directory's copy — read them from the local header
    // itself to find where this entry's data actually starts.
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    result.set(name, buffer.slice(dataStart, dataStart + compressedSize));

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return result;
}
