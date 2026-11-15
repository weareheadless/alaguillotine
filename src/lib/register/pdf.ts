/**
 * Reading a PDF without a PDF library.
 *
 * House financial disclosures arrive as PDFs that are encrypted with the
 * standard security handler and an empty user password, use Identity-H CID
 * fonts, and carry their text in Flate streams. There is no `pdftotext` in a
 * Worker, so this does the four things those files actually need:
 *
 *   1. RC4 key derivation for the standard handler (R2–R4, empty password).
 *   2. Flate inflate through DecompressionStream.
 *   3. A Unicode map per font: /ToUnicode when present, otherwise the embedded
 *      TrueType `cmap` inverted from glyph id to character.
 *   4. Content-stream text extraction that keeps line breaks, by tracking the
 *      text matrix.
 *
 * It is deliberately conservative. Anything it cannot decode is dropped rather
 * than guessed: no glyph, no character. If a file cannot be opened it returns
 * null, and the caller records that the document could not be read instead of
 * inventing a sentence from it. A wrong character in an amount is worse than a
 * missing document.
 */

const PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
  15, 21,
];
const K = new Uint32Array(64).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));

/** MD5, because the standard security handler keys are built with it. */
export function md5(input: Uint8Array): Uint8Array {
  const length = input.length;
  const bitLength = length * 8;
  const withPad = new Uint8Array((((length + 8) >> 6) + 1) * 64);
  withPad.set(input);
  withPad[length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 8, bitLength >>> 0, true);
  view.setUint32(withPad.length - 4, Math.floor(bitLength / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const words = new Uint32Array(16);
  for (let offset = 0; offset < withPad.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i += 1) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const sum = (A + F + K[i] + words[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((sum << S[i]) | (sum >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((word, i) => outView.setUint32(i * 4, word, true));
  return out;
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const state = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) state[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i] + key[i % key.length]) & 255;
    const tmp = state[i];
    state[i] = state[j];
    state[j] = tmp;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n += 1) {
    i = (i + 1) & 255;
    j = (j + state[i]) & 255;
    const tmp = state[i];
    state[i] = state[j];
    state[j] = tmp;
    out[n] = data[n] ^ state[(state[i] + state[j]) & 255];
  }
  return out;
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

function bytesOf(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

function hexBytes(value: string): Uint8Array {
  const clean = value.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

interface PdfObject {
  dict: string;
  stream?: Uint8Array;
}

function parseObjects(raw: string, bytes: Uint8Array): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const header = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;
  let guard = 0;
  while ((match = header.exec(raw)) && guard < 5000) {
    guard += 1;
    const num = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const streamAt = raw.indexOf("stream", bodyStart);
    const endAt = raw.indexOf("endobj", bodyStart);
    if (streamAt < 0 || (endAt >= 0 && endAt < streamAt)) {
      objects.set(num, { dict: raw.slice(bodyStart, endAt < 0 ? bodyStart + 4000 : endAt) });
      if (endAt >= 0) header.lastIndex = endAt;
      continue;
    }
    const dict = raw.slice(bodyStart, streamAt);
    let dataStart = streamAt + 6;
    if (raw[dataStart] === "\r" && raw[dataStart + 1] === "\n") dataStart += 2;
    else if (raw[dataStart] === "\n" || raw[dataStart] === "\r") dataStart += 1;
    const declaredEnd = raw.indexOf("endstream", dataStart);
    if (declaredEnd < 0) break;
    // `/Length` is usually the exact byte count, but it may be an indirect
    // reference (`/Length 39 0 R`) — Apache FOP writes those. Resolving it as
    // if it were the length truncates the stream to a few bytes, so when it is
    // a reference we fall back to the `endstream` boundary and trim the EOL.
    const lengthText = /\/Length\s+(\d+)(\s+\d+\s+R)?/.exec(dict);
    const indirect = Boolean(lengthText?.[2]);
    const length = indirect ? 0 : Number(lengthText?.[1] ?? 0);
    let dataEnd =
      length > 0 && dataStart + length <= declaredEnd ? dataStart + length : declaredEnd;
    if (length === 0) {
      while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) {
        dataEnd -= 1;
      }
    }
    const stream = bytes.subarray(dataStart, dataEnd);
    objects.set(num, { dict, stream });
    const after = raw.indexOf("endobj", dataEnd);
    header.lastIndex = after > 0 ? after : dataEnd;
  }
  return objects;
}

/** The standard security handler, for files opened with an empty password. */
function fileKey(raw: string, objects: Map<number, PdfObject>): Uint8Array | null {
  const encryptRef = /\/Encrypt\s+(\d+)\s+\d+\s+R/.exec(raw.slice(raw.lastIndexOf("trailer")));
  // No /Encrypt means no key is needed, which is not the same as refusing a
  // file. Returning null here marked every unencrypted filing unreadable.
  if (!encryptRef) return new Uint8Array(0);
  const encrypt = objects.get(Number(encryptRef[1]));
  if (!encrypt) return new Uint8Array(0);

  const get = (name: string): string => {
    const match = new RegExp(`/${name}\\s*([^/>\\]]+)`).exec(encrypt.dict);
    return match ? match[1].trim() : "";
  };
  const r = Number(get("R"));
  const length = Number(get("Length")) || 40;
  if (r > 4) return null; // AES / crypt filters: not attempted.

  const o = hexBytes(/\/O\s*<([0-9a-fA-F\s]+)>/.exec(encrypt.dict)?.[1] ?? "");
  const pText = /\/P\s*(-?\d+)/.exec(encrypt.dict)?.[1] ?? "0";
  const p = Number(pText);
  const idMatch = /\/ID\s*\[\s*<([0-9a-fA-F\s]+)>/.exec(raw.slice(raw.lastIndexOf("trailer")));
  const id = idMatch ? hexBytes(idMatch[1]) : new Uint8Array(0);
  if (!o.length) return null;

  const pBytes = new Uint8Array(4);
  new DataView(pBytes.buffer).setInt32(0, p, true);

  const seed = new Uint8Array(PADDING.length + o.length + 4 + id.length);
  seed.set(PADDING, 0);
  seed.set(o, PADDING.length);
  seed.set(pBytes, PADDING.length + o.length);
  seed.set(id, PADDING.length + o.length + 4);

  let digest = md5(seed);
  const keyLength = Math.max(5, Math.min(16, Math.floor(length / 8)));
  if (r >= 3) {
    for (let i = 0; i < 50; i += 1) digest = md5(digest.subarray(0, keyLength));
  }
  return digest.subarray(0, keyLength);
}

function objectKey(key: Uint8Array, num: number, gen: number): Uint8Array {
  const seed = new Uint8Array(key.length + 5);
  seed.set(key);
  seed[key.length] = num & 0xff;
  seed[key.length + 1] = (num >> 8) & 0xff;
  seed[key.length + 2] = (num >> 16) & 0xff;
  seed[key.length + 3] = gen & 0xff;
  seed[key.length + 4] = (gen >> 8) & 0xff;
  return md5(seed).subarray(0, Math.min(key.length + 5, 16));
}

/**
 * Deflate, in plain JavaScript.
 *
 * DecompressionStream is the obvious choice and the wrong one here: Node's
 * implementation rejects these streams outright while zlib.inflateSync reads
 * them, and a Worker may follow either. An amount of money cannot rest on which
 * inflater the platform happened to ship, so this is the reference algorithm
 * (fixed and dynamic Huffman, stored blocks) and nothing else.
 */
export function inflateZlib(input: Uint8Array, raw = false): Uint8Array | null {
  let pos = 0;
  if (!raw && input.length > 2 && (input[0] & 0x0f) === 8 && (((input[0] << 8) | input[1]) % 31) === 0) {
    pos = 2; // zlib wrapper; the Adler-32 at the end is not needed
  }

  let bitBuffer = 0;
  let bitCount = 0;
  let out = new Uint8Array(Math.max(1024, input.length * 4));
  let outLength = 0;

  const ensure = (extra: number) => {
    if (outLength + extra <= out.length) return;
    let size = out.length * 2;
    while (size < outLength + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(out.subarray(0, outLength));
    out = next;
  };

  const bits = (n: number): number => {
    while (bitCount < n) {
      if (pos >= input.length) throw new Error("inflate: out of input");
      bitBuffer |= input[pos] << bitCount;
      pos += 1;
      bitCount += 8;
    }
    const value = bitBuffer & ((1 << n) - 1);
    bitBuffer >>>= n;
    bitCount -= n;
    return value;
  };

  const build = (lengths: number[]) => {
    const counts = new Uint16Array(16);
    for (const length of lengths) counts[length] += 1;
    counts[0] = 0;
    const offsets = new Uint16Array(16);
    for (let i = 1; i < 16; i += 1) offsets[i] = offsets[i - 1] + counts[i - 1];
    const symbols = new Uint16Array(lengths.length);
    lengths.forEach((length, symbol) => {
      if (length) {
        symbols[offsets[length]] = symbol;
        offsets[length] += 1;
      }
    });
    return { counts, symbols };
  };

  const decode = (tree: { counts: Uint16Array; symbols: Uint16Array }): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let length = 1; length <= 15; length += 1) {
      code |= bits(1);
      const count = tree.counts[length];
      if (code - first < count) return tree.symbols[index + (code - first)];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error("inflate: bad code");
  };

  const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  let fixedLiteral: ReturnType<typeof build> | null = null;
  let fixedDistance: ReturnType<typeof build> | null = null;

  try {
    let last = 0;
    while (!last) {
      last = bits(1);
      const type = bits(2);

      if (type === 0) {
        // Stored: skip to a byte boundary, then read LEN and its complement.
        bitBuffer = 0;
        bitCount = 0;
        if (pos + 4 > input.length) return null;
        const length = input[pos] | (input[pos + 1] << 8);
        const check = input[pos + 2] | (input[pos + 3] << 8);
        pos += 4;
        if ((length ^ 0xffff) !== check) return null;
        ensure(length);
        out.set(input.subarray(pos, pos + length), outLength);
        outLength += length;
        pos += length;
        continue;
      }

      let literal: ReturnType<typeof build>;
      let distance: ReturnType<typeof build>;

      if (type === 1) {
        if (!fixedLiteral) {
          const lengths = new Array(288).fill(0);
          for (let i = 0; i < 144; i += 1) lengths[i] = 8;
          for (let i = 144; i < 256; i += 1) lengths[i] = 9;
          for (let i = 256; i < 280; i += 1) lengths[i] = 7;
          for (let i = 280; i < 288; i += 1) lengths[i] = 8;
          fixedLiteral = build(lengths);
          fixedDistance = build(new Array(30).fill(5));
        }
        literal = fixedLiteral;
        distance = fixedDistance as ReturnType<typeof build>;
      } else if (type === 2) {
        const hlit = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const codeLengths = new Array(19).fill(0);
        for (let i = 0; i < hclen; i += 1) codeLengths[order[i]] = bits(3);
        const codeTree = build(codeLengths);

        const lengths: number[] = [];
        while (lengths.length < hlit + hdist) {
          const symbol = decode(codeTree);
          if (symbol < 16) {
            lengths.push(symbol);
          } else if (symbol === 16) {
            const previous = lengths[lengths.length - 1] ?? 0;
            const repeat = 3 + bits(2);
            for (let i = 0; i < repeat; i += 1) lengths.push(previous);
          } else if (symbol === 17) {
            const repeat = 3 + bits(3);
            for (let i = 0; i < repeat; i += 1) lengths.push(0);
          } else {
            const repeat = 11 + bits(7);
            for (let i = 0; i < repeat; i += 1) lengths.push(0);
          }
        }
        literal = build(lengths.slice(0, hlit));
        distance = build(lengths.slice(hlit));
      } else {
        return null;
      }

      for (;;) {
        const symbol = decode(literal);
        if (symbol < 256) {
          ensure(1);
          out[outLength] = symbol;
          outLength += 1;
        } else if (symbol === 256) {
          break;
        } else {
          const index = symbol - 257;
          if (index >= 29) return null;
          const length = LENGTH_BASE[index] + bits(LENGTH_EXTRA[index]);
          const distSymbol = decode(distance);
          if (distSymbol >= 30) return null;
          const back = DIST_BASE[distSymbol] + bits(DIST_EXTRA[distSymbol]);
          if (back > outLength) return null;
          ensure(length);
          for (let i = 0; i < length; i += 1) {
            out[outLength] = out[outLength - back];
            outLength += 1;
          }
        }
      }
    }
  } catch {
    return null;
  }

  return out.subarray(0, outLength);
}

/** A font: how to turn the bytes in a text run into characters. */
interface FontInfo {
  /** Type0/Identity-H text is two bytes per glyph. */
  twoByte: boolean;
  /** CID (or byte) to string. */
  map: Map<number, string>;
}

function parseToUnicode(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const utf16 = (hex: string): string => {
    let out = "";
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (!Number.isNaN(code)) out += String.fromCharCode(code);
    }
    return out;
  };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(pair[1], 16), utf16(pair[2]));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g,
    )) {
      const from = parseInt(range[1], 16);
      const to = parseInt(range[2], 16);
      if (range[3]) {
        const base = parseInt(range[3], 16);
        for (let c = from; c <= to && c - from < 65536; c += 1) {
          map.set(c, String.fromCharCode(base + (c - from)));
        }
      } else if (range[4]) {
        const items = [...range[4].matchAll(/<([0-9a-fA-F]+)>/g)].map((m) => utf16(m[1]));
        items.forEach((item, i) => {
          if (from + i <= to) map.set(from + i, item);
        });
      }
    }
  }
  return map;
}

/** TrueType `cmap`, inverted: glyph id → character. */
function parseTrueTypeCmap(font: Uint8Array): Map<number, string> {
  const map = new Map<number, string>();
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  if (font.length < 12) return map;
  const numTables = view.getUint16(4);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i += 1) {
    const at = 12 + 16 * i;
    if (at + 16 > font.length) break;
    const tag = String.fromCharCode(...font.subarray(at, at + 4));
    if (tag === "cmap") cmapOffset = view.getUint32(at + 8);
  }
  if (cmapOffset < 0 || cmapOffset + 4 > font.length) return map;
  const count = view.getUint16(cmapOffset + 2);
  const candidates: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = cmapOffset + 4 + 8 * i;
    if (at + 8 > font.length) break;
    const platform = view.getUint16(at);
    const offset = cmapOffset + view.getUint32(at + 4);
    if (offset + 2 > font.length) continue;
    const format = view.getUint16(offset);
    if (format === 4 || (format === 12 && platform === 3)) candidates.push(offset);
  }
  // Prefer a full Unicode table when there is one.
  candidates.sort((a, b) => (view.getUint16(b) === 12 ? 1 : 0) - (view.getUint16(a) === 12 ? 1 : 0));

  for (const base of candidates) {
    const format = view.getUint16(base);
    if (format === 12) {
      const groups = view.getUint32(base + 12);
      for (let g = 0; g < groups; g += 1) {
        const at = base + 16 + 12 * g;
        if (at + 12 > font.length) break;
        const startChar = view.getUint32(at);
        const endChar = view.getUint32(at + 4);
        const startGlyph = view.getUint32(at + 8);
        for (let c = startChar; c <= endChar && c - startChar < 65535; c += 1) {
          map.set(startGlyph + (c - startChar), String.fromCodePoint(c));
        }
      }
    } else if (format === 4) {
      const segX2 = view.getUint16(base + 6);
      const segs = segX2 / 2;
      const endsAt = base + 14;
      const startsAt = endsAt + segX2 + 2;
      const deltasAt = startsAt + segX2;
      const offsetsAt = deltasAt + segX2;
      for (let s = 0; s < segs; s += 1) {
        const end = view.getUint16(endsAt + 2 * s);
        const start = view.getUint16(startsAt + 2 * s);
        const delta = view.getInt16(deltasAt + 2 * s);
        const rangeOffset = view.getUint16(offsetsAt + 2 * s);
        if (start === 0xffff) continue;
        for (let c = start; c <= end && c !== 0xffff; c += 1) {
          let glyph: number;
          if (rangeOffset === 0) {
            glyph = (c + delta) & 0xffff;
          } else {
            const at = offsetsAt + 2 * s + rangeOffset + 2 * (c - start);
            if (at + 2 > font.length) continue;
            glyph = view.getUint16(at);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph && !map.has(glyph)) map.set(glyph, String.fromCharCode(c));
        }
      }
    }
    if (map.size) break;
  }
  return map;
}

interface PdfDocument {
  objects: Map<number, PdfObject>;
  key: Uint8Array | null;
  cache: Map<number, Uint8Array | null>;
  fonts: Map<number, FontInfo>;
}

/**
 * The platform inflater, as a fallback.
 *
 * The hand-written inflater is deterministic and handles the Clerk's streams,
 * but Apache FOP (used by the European Parliament) emits blocks it refuses.
 * `DecompressionStream` reads those. Trying the platform second, not first,
 * keeps the known-good path for the documents we already validated while
 * refusing to call a readable file unreadable.
 */
async function inflateWithPlatform(data: Uint8Array): Promise<Uint8Array | null> {
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream(format));
      const out = await new Response(stream).arrayBuffer();
      if (out.byteLength) return new Uint8Array(out);
    } catch {
      /* try the next framing */
    }
  }
  return null;
}

async function objectStream(doc: PdfDocument, num: number): Promise<Uint8Array | null> {
  if (doc.cache.has(num)) return doc.cache.get(num) ?? null;
  const object = doc.objects.get(num);
  if (!object?.stream) {
    doc.cache.set(num, null);
    return null;
  }
  let data = object.stream;
  if (doc.key && doc.key.length) {
    data = rc4(objectKey(doc.key, num, 0), data);
  }
  const inflated = inflateZlib(data) ?? (await inflateWithPlatform(data));
  // Uninflatable data is not text. Returning it would feed compressed bytes to
  // the text reader and produce plausible-looking nonsense.
  if (!inflated) {
    doc.cache.set(num, null);
    return null;
  }
  const out = inflated;
  doc.cache.set(num, out);
  return out;
}

function fontInfo(doc: PdfDocument, num: number): FontInfo {
  const cached = doc.fonts.get(num);
  if (cached) return cached;
  const info: FontInfo = { twoByte: false, map: new Map() };
  const object = doc.objects.get(num);
  if (!object) return info;
  const dict = object.dict;

  // A ToUnicode CMap is authoritative when the file carries one.
  const toUnicodeRef = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(dict);
  if (toUnicodeRef) {
    const stream = doc.cache.get(Number(toUnicodeRef[1]));
    if (stream) info.map = parseToUnicode(latin1(stream));
  }

  if (/\/Subtype\s*\/Type0/.test(dict)) {
    info.twoByte = true;
    if (info.map.size === 0) {
      const descendant = /\/DescendantFonts\s*\[\s*(\d+)\s+\d+\s+R/.exec(dict);
      if (descendant) {
        const cid = doc.objects.get(Number(descendant[1]));
        const descriptor = cid && /\/FontDescriptor\s+(\d+)\s+\d+\s+R/.exec(cid.dict);
        const fontFile = descriptor
          ? /\/FontFile2\s+(\d+)\s+\d+\s+R/.exec(
              doc.objects.get(Number(descriptor[1]))?.dict ?? "",
            )
          : null;
        if (fontFile) {
          const bytes = doc.cache.get(Number(fontFile[1]));
          if (bytes) info.map = parseTrueTypeCmap(bytes);
        }
      }
    }
  }
  doc.fonts.set(num, info);
  return info;
}

function decodeString(value: string, hex: boolean, font: FontInfo): string {
  let out = "";
  if (hex) {
    const clean = value.replace(/[^0-9a-fA-F]/g, "");
    const step = font.twoByte ? 4 : 2;
    for (let i = 0; i + step <= clean.length; i += step) {
      const code = parseInt(clean.slice(i, i + step), 16);
      const mapped = font.map.get(code);
      out += mapped ?? (font.map.size ? "" : String.fromCharCode(code));
    }
    return out;
  }
  // A literal string, with the escapes the spec allows.
  const literal = value
    .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" })[c as "n"] ?? c)
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  if (font.twoByte) {
    for (let i = 0; i + 1 < literal.length; i += 2) {
      const code = (literal.charCodeAt(i) << 8) | literal.charCodeAt(i + 1);
      out += font.map.get(code) ?? "";
    }
    return out;
  }
  for (const char of literal) {
    const code = char.charCodeAt(0);
    out += font.map.get(code) ?? char;
  }
  return out;
}

function tidy(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** Match `<< … >>` with nesting, which a regex cannot do. */
function balancedEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i += 1) {
    if (text[i] === "<" && text[i + 1] === "<") {
      depth += 1;
      i += 1;
    } else if (text[i] === ">" && text[i + 1] === ">") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** The dictionary stored under `key`, nested or referenced. */
function dictFor(dict: string, key: string, objects?: Map<number, PdfObject>): string {
  const direct = new RegExp(`/${key}\\s*<<`).exec(dict);
  if (direct) {
    const start = direct.index + direct[0].length - 2;
    const end = balancedEnd(dict, start);
    if (end > 0) return dict.slice(start, end);
  }
  const ref = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  if (ref && objects) {
    const object = objects.get(Number(ref[1]));
    if (object) {
      const start = object.dict.indexOf("<<");
      const end = start >= 0 ? balancedEnd(object.dict, start) : -1;
      if (end > 0) return object.dict.slice(start, end);
    }
  }
  return "";
}

const TOKEN =
  /\((?:\\[\s\S]|[^\\()])*\)|<[0-9a-fA-F\s]*>|\/([A-Za-z0-9#+-]+)\s+[-\d.]+\s+Tf|([-\d.]+)\s+([-\d.]+)\s+(Td|TD)|([-\d.]+)\s+([-\d.]+)\s+Tm|(T\*)|(BT)|(ET)|(TJ|Tj|'|")|([-\d.]+)/g;

function textOfContent(
  content: string,
  doc: PdfDocument,
  resources: string,
  depth: number,
): string {
  let out = "";
  let font: FontInfo = { twoByte: false, map: new Map() };
  let lastY = Number.NaN;
  let pending: string[] = [];
  const flushLine = () => {
    if (pending.length) {
      out += `${pending.join("")}\n`;
      pending = [];
    }
  };

  const fontAt = (name: string): FontInfo => {
    const block = dictFor(resources, "Font", doc.objects);
    if (!block) return font;
    const ref = new RegExp(`/${name}\\s+(\\d+)\\s+\\d+\\s+R`).exec(block);
    return ref ? fontInfo(doc, Number(ref[1])) : font;
  };

  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(content))) {
    const token = match[0];
    if (match[1]) {
      font = fontAt(match[1]);
      continue;
    }
    if (match[4]) {
      // Td / TD: a horizontal move inside the line, or a new line.
      const dx = Number(match[2]);
      const dy = Number(match[3]);
      if (Math.abs(dy) > 1.5) flushLine();
      void dx;
      continue;
    }
    if (match[5] !== undefined && match[7] === undefined) {
      // Tm: an absolute position. A new y is a new line.
      const y = Number(match[6]);
      if (!Number.isNaN(lastY) && Math.abs(y - lastY) > 1.5) flushLine();
      lastY = y;
      continue;
    }
    if (match[8] || match[9]) {
      flushLine();
      continue;
    }
    if (token.startsWith("(") || token.startsWith("<")) {
      const decoded = decodeString(token.slice(1, -1), token.startsWith("<"), font);
      if (decoded) pending.push(decoded);
    }
  }
  flushLine();

  // Form XObjects carry their own text and their own resources.
  if (depth < 3) {
    const forms = dictFor(resources, "XObject", doc.objects);
    if (forms) {
      for (const ref of forms.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+\d+\s+R/g)) {
        const object = doc.objects.get(Number(ref[2]));
        if (!object || !/\/Subtype\s*\/Form/.test(object.dict)) continue;
        const nested = doc.cache.get(Number(ref[2]));
        if (!nested) continue;
        const nestedResources = dictFor(object.dict, "Resources", doc.objects) || resources;
        out += textOfContent(latin1(nested), doc, nestedResources, depth + 1);
      }
    }
  }
  return out;
}

export async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  const raw = latin1(bytes);
  if (!raw.includes("%PDF")) return null;
  const objects = parseObjects(raw, bytes);
  if (!objects.size) return null;

  const key = fileKey(raw, objects);
  // AES-encrypted files are refused rather than half-read.
  if (key === null) return null;

  const doc: PdfDocument = { objects, key, cache: new Map(), fonts: new Map() };

  // Pre-inflate what the reader will ask for. The streams themselves do not
  // mention why they are wanted: a font program is a stream of TrueType bytes
  // whose dictionary says nothing about fonts, so the references are collected
  // first and the streams inflated by number.
  const needed = new Set<number>();
  for (const [num, object] of objects) {
    for (const ref of object.dict.matchAll(/\/(?:FontFile2|ToUnicode)\s+(\d+)\s+\d+\s+R/g)) {
      needed.add(Number(ref[1]));
    }
    if (/\/Subtype\s*\/Form/.test(object.dict)) needed.add(num);
    if (/\/Type\s*\/Page\b/.test(object.dict)) {
      for (const ref of object.dict.matchAll(/\/Contents\s+(\d+)\s+\d+\s+R/g)) {
        needed.add(Number(ref[1]));
      }
      for (const ref of object.dict.matchAll(/(\d+)\s+\d+\s+R/g)) {
        const candidate = objects.get(Number(ref[1]));
        if (candidate && /\/Type\s*\/(?:Page|Pages)\b/.test(candidate.dict)) needed.add(Number(ref[1]));
      }
    }
  }
  for (const num of needed) await objectStream(doc, num);

  const pageNums: number[] = [];
  for (const [num, object] of objects) {
    if (/\/Type\s*\/Page\b/.test(object.dict)) pageNums.push(num);
  }
  pageNums.sort((a, b) => a - b);

  let text = "";
  for (const pageNum of pageNums) {
    const page = objects.get(pageNum);
    if (!page) continue;
    const resources = dictFor(page.dict, "Resources", objects);
    const contents: number[] = [];
    const single = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(page.dict);
    if (single) contents.push(Number(single[1]));
    const array = /\/Contents\s*\[([^\]]*)\]/.exec(page.dict);
    if (array) {
      for (const ref of array[1].matchAll(/(\d+)\s+\d+\s+R/g)) contents.push(Number(ref[1]));
    }
    for (const contentNum of contents) {
      const stream = await objectStream(doc, contentNum);
      if (stream) text += textOfContent(latin1(stream), doc, resources, 0);
    }
  }

  const cleaned = tidy(text);
  return cleaned.length >= 40 ? cleaned : null;
}
