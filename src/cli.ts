#!/usr/bin/env node
import { encode, decode, cellSize } from './index.js';

function printHelp(): void {
  console.log(`b39geo - BIP-39 4-word geocoding

Usage:
  b39geo encode <lat> <lon>
  b39geo decode <word1> <word2> <word3> <word4>
  b39geo size
  b39geo help

Examples:
  b39geo encode 37.7749 -122.4194
  b39geo decode bonus cereal olive turtle
`);
}

function main(argv: string[]): void {
  const [,, cmd, ...rest] = argv;
  switch ((cmd || '').toLowerCase()) {
    case 'encode': {
      if (rest.length < 2) { printHelp(); process.exit(1); }
      const lat = Number(rest[0]);
      const lon = Number(rest[1]);
      const words = encode(lat, lon);
      console.log(words.join(' '));
      return;
    }
    case 'decode': {
      if (rest.length !== 4) { printHelp(); process.exit(1); }
      const coord = decode(rest);
      console.log(JSON.stringify(coord));
      return;
    }
    case 'size': {
      const s = cellSize();
      console.log(JSON.stringify(s));
      return;
    }
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      return;
  }
}

main(process.argv);


