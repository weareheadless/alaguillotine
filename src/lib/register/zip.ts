import { inflateZlib } from "./pdf";

/**
 * The Clerk publishes each year's disclosure index as a ZIP. A Worker has no
 * unzip, so this reads the central directory and inflates the entries it finds.
 *
 * Only what the index needs: stored and deflated entries, no passwords, no
 * ZIP64. Anything else is skipped rather than guessed at.
 */

function u16(view: DataView, at: number): number {
  return view.getUint16(at, true);
}

function u32(view: DataView, at: number): number {
  return view.getUint32(at, true);
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function unzip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22) return [];

  // End of central directory: scan backwards over the comment.
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65558); at -= 1) {
    if (u32(view, at) === 0x06054b50) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) return [];

  const count = u16(view, eocd + 10);
  const directoryAt = u32(view, eocd + 16);
  const entries: ZipEntry[] = [];

  let at = directoryAt;
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > bytes.length || u32(view, at) !== 0x02014b50) break;
    const method = u16(view, at + 10);
    const compressedSize = u32(view, at + 20);
    const nameLength = u16(view, at + 28);
    const extraLength = u16(view, at + 30);
    const commentLength = u16(view, at + 32);
    const localAt = u32(view, at + 42);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (localAt + 30 <= bytes.length && u32(view, localAt) === 0x04034b50) {
      const localName = u16(view, localAt + 26);
      const localExtra = u16(view, localAt + 28);
      const dataAt = localAt + 30 + localName + localExtra;
      const compressed = bytes.subarray(dataAt, dataAt + compressedSize);
      if (method === 0) {
        entries.push({ name, data: compressed });
      } else if (method === 8) {
        const inflated = inflateZlib(compressed, true);
        if (inflated) entries.push({ name, data: inflated });
      }
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}
