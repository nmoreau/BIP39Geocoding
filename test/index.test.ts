import { describe, it, expect } from 'vitest';
import { encode, decode, cellSize } from '../src/index';

describe('bip39 geocoding', () => {
  it('roundtrips SF coordinates', () => {
    const lat = 37.7749;
    const lon = -122.4194;
    const words = encode(lat, lon);
    expect(words).toHaveLength(4);
    // Introduce slight typos and prefixes
    const typoWords = [
      words[0].slice(0, 4),
      words[1],
      words[2].slice(0, words[2].length - 1),
      words[3]
    ];
    const decoded = decode(typoWords);
    // Should be within one cell
    const size = cellSize();
    expect(Math.abs(decoded.lat - lat)).toBeLessThanOrEqual(size.latDegrees);
    expect(Math.abs(decoded.lon - lon)).toBeLessThanOrEqual(size.lonDegrees);
  });

  it('handles extremes', () => {
    const wordsMin = encode(-90, -180);
    const wordsMax = encode(90, 180);
    expect(wordsMin).toHaveLength(4);
    expect(wordsMax).toHaveLength(4);
    const dMin = decode(wordsMin);
    const dMax = decode(wordsMax);
    expect(dMin.lat).toBeGreaterThanOrEqual(-90);
    expect(dMin.lon).toBeGreaterThanOrEqual(-180);
    expect(dMax.lat).toBeLessThanOrEqual(90);
    expect(dMax.lon).toBeLessThanOrEqual(180);
  });
});


