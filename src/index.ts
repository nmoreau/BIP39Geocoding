import { wordlist as english } from '@scure/bip39/wordlists/english';

// Constants for mapping lat/lon to 22-bit signed integers then to unsigned
const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

// We use 22 bits per coordinate → values in [0, 2^22 - 1]
const BITS_PER_COORD = 22;
const MAX_COORD = (1 << BITS_PER_COORD) - 1; // 0..4194303

// Total bits for interleaved Morton code
const TOTAL_BITS = BITS_PER_COORD * 2; // 44 bits total

export type Coord = { lat: number; lon: number };

export type EncodeOptions = {
  // Optional rounding behavior for quantization spacing
  rounding?: 'nearest' | 'floor' | 'ceil';
};

export type DecodeOptions = {
  // When true, returns the center of the cell rather than the lower bound
  center?: boolean;
};

// Quantization step sizes
const LAT_STEP = (LAT_MAX - LAT_MIN) / (MAX_COORD);
const LON_STEP = (LON_MAX - LON_MIN) / (MAX_COORD);

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) throw new Error('Invalid number');
  return Math.min(max, Math.max(min, value));
}

function quantize(value: number, min: number, step: number, rounding: 'nearest' | 'floor' | 'ceil'): number {
  const t = (value - min) / step;
  if (rounding === 'nearest') return Math.round(t);
  if (rounding === 'ceil') return Math.ceil(t);
  return Math.floor(t);
}

function dequantize(q: number, min: number, step: number, center: boolean): number {
  return min + (center ? (q + 0.5) : q) * step;
}

// Bit interleaving for 22-bit x,y into 44-bit Morton code (x: lon, y: lat)
function mortonInterleave(x: number, y: number): bigint {
  let code = 0n;
  for (let i = 0; i < BITS_PER_COORD; i++) {
    const xb = (x >>> i) & 1;
    const yb = (y >>> i) & 1;
    code |= BigInt(xb) << BigInt(2 * i);
    code |= BigInt(yb) << BigInt(2 * i + 1);
  }
  return code;
}

function mortonDeinterleave(code: bigint): { x: number; y: number } {
  const masked = code & ((1n << 44n) - 1n);
  let x = 0;
  let y = 0;
  for (let i = 0; i < BITS_PER_COORD; i++) {
    const xb = Number((masked >> BigInt(2 * i)) & 1n);
    const yb = Number((masked >> BigInt(2 * i + 1)) & 1n);
    x |= xb << i;
    y |= yb << i;
  }
  return { x, y };
}

function mapLat(lat: number, rounding: 'nearest' | 'floor' | 'ceil'): number {
  const clamped = clamp(lat, LAT_MIN, LAT_MAX);
  return clamp(quantize(clamped, LAT_MIN, LAT_STEP, rounding), 0, MAX_COORD);
}

function mapLon(lon: number, rounding: 'nearest' | 'floor' | 'ceil'): number {
  const clamped = clamp(lon, LON_MIN, LON_MAX);
  return clamp(quantize(clamped, LON_MIN, LON_STEP, rounding), 0, MAX_COORD);
}

function toBytes44(code: bigint): Uint8Array {
  // 44 bits → 6 bytes (48 bits) with top 4 bits zero
  const buf = new Uint8Array(6);
  let v = code & ((1n << 44n) - 1n);
  for (let i = 5; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

function fromBytes44(bytes: Uint8Array): bigint {
  if (bytes.length !== 6) throw new Error('Expected 6 bytes for 44-bit value');
  let v = 0n;
  for (let i = 0; i < 6; i++) {
    v = (v << 8n) | BigInt(bytes[i]);
  }
  return v & ((1n << 44n) - 1n);
}

function bytesToBitString(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
}

function bitStringToBytes(bits: string): Uint8Array {
  if (bits.length % 8 !== 0) throw new Error('Bit string length must be multiple of 8');
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    const byteStr = bits.slice(i * 8, i * 8 + 8);
    bytes[i] = parseInt(byteStr, 2);
  }
  return bytes;
}

// Map 44 bits to 4 BIP-39 words (each 11 bits), using english wordlist
export function encode(lat: number, lon: number, options: EncodeOptions = {}): string[] {
  const rounding = options.rounding ?? 'nearest';
  const qLat = mapLat(lat, rounding);
  const qLon = mapLon(lon, rounding);
  const morton = mortonInterleave(qLon, qLat); // x=lon, y=lat
  const bits44 = bytesToBitString(toBytes44(morton)).slice(-44);
  // Split into four 11-bit chunks
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    const chunk = bits44.slice(i * 11, (i + 1) * 11);
    const idx = parseInt(chunk, 2);
    words.push(english[idx]);
  }
  return words;
}

function normalizeWord(word: string): string {
  return word.normalize('NFKD').toLowerCase();
}

function levenshteinDistance(a: string, b: string, maxDistance: number): number {
  // Early exits
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;

  const prev = new Array<number>(lb + 1);
  const curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let bestInRow = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      const val = Math.min(del, ins, sub);
      curr[j] = val;
      if (val < bestInRow) bestInRow = val;
    }
    if (bestInRow > maxDistance) return maxDistance + 1;
    // swap rows
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

function resolveWord(input: string): string {
  const w = normalizeWord(input);
  // Exact
  if (english.includes(w)) return w;
  // Unique prefix of length >= 4 (BIP-39 English has unique 4-letter prefixes)
  if (w.length >= 4) {
    const candidates = english.filter((ew) => ew.startsWith(w));
    if (candidates.length === 1) return candidates[0];
  }
  // Single edit distance
  let best: string | null = null;
  let ties = 0;
  for (const ew of english) {
    const d = levenshteinDistance(w, ew, 1);
    if (d <= 1) {
      if (best === null) {
        best = ew;
        ties = 1;
      } else {
        ties += 1;
      }
    }
  }
  if (best && ties === 1) return best;
  throw new Error(`Unknown or ambiguous BIP-39 word: ${input}`);
}

export function decode(words: string[], options: DecodeOptions = {}): Coord {
  if (words.length !== 4) throw new Error('Expected exactly 4 words');
  const normalized = words.map((w) => resolveWord(w));
  // Convert 4 words to 44-bit string
  const indices = normalized.map((w) => {
    const idx = english.indexOf(w);
    if (idx < 0) throw new Error(`Unknown BIP-39 word: ${w}`);
    return idx;
  });
  const bitStr = indices.map((i) => i.toString(2).padStart(11, '0')).join('');
  const bytes = bitStringToBytes(bitStr.padStart(48, '0'));
  const code = fromBytes44(bytes);
  const { x, y } = mortonDeinterleave(code);
  const latRaw = dequantize(y, LAT_MIN, LAT_STEP, options.center ?? true);
  const lonRaw = dequantize(x, LON_MIN, LON_STEP, options.center ?? true);
  const lat = clamp(latRaw, LAT_MIN, LAT_MAX);
  const lon = clamp(lonRaw, LON_MIN, LON_MAX);
  return { lat, lon };
}

export function cellSize(): { latDegrees: number; lonDegrees: number } {
  return { latDegrees: LAT_STEP, lonDegrees: LON_STEP };
}

export function tryParse(wordsOrText: string | string[]): Coord | null {
  try {
    const words = Array.isArray(wordsOrText)
      ? wordsOrText
      : wordsOrText.trim().split(/\s+/);
    return decode(words);
  } catch {
    return null;
  }
}

export const internal = {
  mapLat,
  mapLon,
  mortonInterleave,
  mortonDeinterleave,
  toBytes44,
  fromBytes44,
  LAT_STEP,
  LON_STEP,
  MAX_COORD,
};


