## BIP‑39 Four‑word Geocoding

Encode/decode geographic coordinates using 4 BIP‑39 words. Each axis is quantized to 22 bits, interleaved with Morton Z‑order into a 44‑bit value → 4×11‑bit BIP‑39 indices.

Design inspired by: [ChatGPT Canvas discussion](https://chatgpt.com/canvas/shared/689650f10ac88191a6837e29632502dc).


# Product One‑Pager — Four‑Word Geocode (BIP‑39) v1.2

## 1) Idea

Encode any GPS coordinate into **exactly 4 words** from a **BIP‑39** wordlist. Works offline and is fully reversible. UI is a **stand‑alone web page**: user enters **latitude/longitude** and gets the **4‑word code**; user can also paste **4 words** to recover a coordinate. **Words may repeat.**

---

## 2) Requirements

### 2.1 Functional

1. **Input → Encode:** user enters **(lat, lon)**.
2. **Output:** show **4 BIP‑39 words** and supporting numbers (**digits d1..d4, CRC‑4 value, ix, iy**).
3. **Reverse → Decode:** user enters **4 words + language** and the app returns the cell **center (lat, lon)**.
4. **Coverage:** entire Earth.
5. **Multi‑language (BIP‑39):** support **10 official packs** at launch — **en, ja, es, zh‑Hans, zh‑Hant, fr, it, ko, cs, pt**. Language changes only the word surface; digits/cell stay the same for a location.
6. **Repetition:** words may repeat; all **2048⁴** combinations are valid.

### 2.2 Non‑functional

1. **Deterministic & bijective** mapping between code and grid cell.
2. **Client‑only**; offline encode/decode (no server calls).
3. Encode/decode latency **< 16 ms** on a modern laptop.
4. Accessible inputs; copy‑to‑clipboard for the code; no external map dependency.

---

## 3) Solution (how it will be built)

### 3.1 Capacity & resolution

* BIP‑39 list size **W = 2,048 = 2¹¹**.
* 4 words → **W⁴ = 2⁴⁴** codes.
* Earth area **A ≈ 5.10064472×10¹⁴ m²**.
* **Checksum policy:** reserve **b = 4** bits for **CRC‑4/ITU** (see 3.3). Effective payload **40 bits** → average cell area **≈ 463.901 m²**, equivalent square side **≈ 21.538 m**.

### 3.2 World grid (equal‑area)

* Equal‑area cylindrical mapping to keep **area constant**:

  * `u = (λ + 180) / 360` ∈ \[0,1)
  * `v = (sin φ + 1) / 2` ∈ \[0,1]
  * Grid: **Nₓ = 2²⁰**, **Nᵧ = 2²⁰** (total **2⁴⁰** cells)
  * Indices: `iₓ = ⌊u·Nₓ⌋`, `iᵧ = ⌊v·Nᵧ⌋`
  * Linear index (row‑major): `P40 = iᵧ·Nₓ + iₓ`

### 3.3 Integrity (checksum — final policy)

* Prepend **CRC‑4/ITU** to `P40`: `I44 = (CRC4 << 40) | P40`.
* **On decode:** if checksum does not match → **reject** (no best‑guess placement).

### 3.4 Word mapping (per language)

* Convert `I44` to 4 base‑2048 digits `(d1,d2,d3,d4)`.
* Map digits to words via the selected **BIP‑39 language list**.
* Reverse: words → digits → `I44` → verify CRC → recover the cell center.
* **Shared format:** `lang:word1.word2.word3.word4` (e.g., `en:...`, `ja:...`). Language tag is required for decoding.

### 3.5 UI (stand‑alone page)

* **Encode panel:** inputs for **lat** and **lon**, language selector, “Encode” button. Outputs: 4‑word code, digits, CRC‑4, `ix`, `iy`.
* **Decode panel:** input for **4 words** and language; on submit, shows **lat/lon** of the decoded cell center.
* **Utilities:** copy button for the 4‑word code; optional permalink `?w=...&lang=...`.


![Sample design](/assets/BIP-39%20Geocoding.png)
---

## Install (library)

```bash
npm install bip39-geocoding
```

## CLI

After building (or installing globally), run:

```bash
# Encode latitude/longitude → 4 words
b39geo encode 37.7749 -122.4194

# Decode 4 words → coordinates (cell center)
b39geo decode word1 word2 word3 word4

# Show quantization step size in degrees
b39geo size
```

Decoding accepts:
- exact BIP‑39 words
- unique prefixes of length ≥ 4
- single‑typo corrections when unambiguous

Tip: without global install you can run the compiled CLI:

```bash
node dist/cli.js encode 37.7749 -122.4194
```

## API (TypeScript)

```ts
import { encode, decode, cellSize } from 'bip39-geocoding';

const words = encode(37.7749, -122.4194); // [w1, w2, w3, w4]
const { lat, lon } = decode(words);      // center of the cell
const size = cellSize();                  // { latDegrees, lonDegrees }
```

---

## Web app

Dev server:

```bash
npm run web:dev
# open the printed URL (e.g., http://localhost:5173)
```

Production build:

```bash
npm run web:build
npm run web:preview
# open the printed URL
```

Browser UI includes:
- Location helper: type a place and press Enter → fetches coordinates via a dev‑only proxy to Nominatim (OpenStreetMap) and auto‑fills lat/lon and 4 words
- Encode: lat/lon → 4 words
- Decode: 4 words → lat/lon

Notes:
- The Nominatim proxy is Dev‑only (Vite middleware) under `/api/free-geocode`.
- Please use responsibly and in low volume for prototypes; Nominatim has a usage policy and expects an identifying User‑Agent.

---

## Development

```bash
npm install
npm run build
npm test

# web
npm run web:dev
```

## Implementation details
- English BIP‑39 wordlist is imported from `@scure/bip39/wordlists/english` (MIT).
- BigInt‑safe Morton interleaving (22 bits per axis → 44 bits total).
- Decoding clamps results to valid ranges.

## License

MIT


