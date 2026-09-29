import { useEffect, useState } from 'react';

// Lightweight QR code generator (Version 1-10, byte mode, EC level L)
// Based on the QR code specification. No external dependencies.

type BitBuffer = { bits: number[]; length: number };

function newBuffer(): BitBuffer {
  return { bits: [], length: 0 };
}

function put(buffer: BitBuffer, num: number, length: number) {
  for (let i = 0; i < length; i++) {
    buffer.bits.push((num >> (length - i - 1)) & 1);
  }
  buffer.length += length;
}

const ECC_CODEWORDS: Record<number, number[]> = {
  1: [19, 7],
  2: [34, 10],
  3: [55, 15],
  4: [80, 20],
  5: [108, 26],
  6: [136, 32],
  7: [156, 38],
  8: [194, 46],
  9: [232, 54],
  10: [274, 62],
};

function getVersion(text: string): number {
  const len = text.length;
  for (let v = 1; v <= 10; v++) {
    const cap = ECC_CODEWORDS[v][0] - ECC_CODEWORDS[v][1] - 2;
    if (len <= cap) return v;
  }
  return 10;
}

const GALOIS_EXP = new Array(512);
const GALOIS_LOG = new Array(256);
(function initGal() {
  let p = 1;
  for (let i = 0; i < 255; i++) {
    GALOIS_EXP[i] = p;
    GALOIS_LOG[p] = i;
    p <<= 1;
    if (p & 0x100) p ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GALOIS_EXP[i] = GALOIS_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GALOIS_EXP[GALOIS_LOG[a] + GALOIS_LOG[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gfMul(poly[j], GALOIS_EXP[i]);
    }
    poly = newPoly;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const result = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = result[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      result[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return result.slice(data.length);
}

function generateMatrix(text: string): boolean[][] {
  const version = getVersion(text);
  const size = version * 4 + 17;
  const totalData = ECC_CODEWORDS[version][0];
  const ecPerBlock = ECC_CODEWORDS[version][1];
  const dataPerBlock = totalData - ecPerBlock;

  const buffer = newBuffer();

  put(buffer, 0b0100, 4); // byte mode
  put(buffer, text.length, version < 10 ? 8 : 16);

  for (let i = 0; i < text.length; i++) {
    put(buffer, text.charCodeAt(i), 8);
  }

  const totalBits = (dataPerBlock * 8);
  const remaining = totalBits - buffer.length;
  put(buffer, 0, Math.min(4, remaining > 0 ? 4 : 0));
  if (remaining > 4) {
    for (let i = buffer.length; i < totalBits; i += 8) {
      buffer.bits.push(i % 16 === 0 ? 0xec : 0x11);
    }
  }

  const codewords: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (buffer.bits[i + j] || 0);
    }
    codewords.push(byte);
  }

  const ec = rsEncode(codewords, ecPerBlock);
  const fullData = codewords.concat(ec);

  const matrix: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  // Finder patterns
  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        matrix[rr][cc] = isBorder || isInner;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Reserve format areas
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Place data
  let dataIdx = 0;
  let goingUp = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = goingUp ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (!reserved[row][cc]) {
          const byte = Math.floor(dataIdx / 8);
          const bit = 7 - (dataIdx % 8);
          let val = false;
          if (byte < fullData.length) {
            val = ((fullData[byte] >> bit) & 1) === 1;
          }
          matrix[row][cc] = val;
          dataIdx++;
        }
      }
    }
    goingUp = !goingUp;
  }

  // Mask pattern 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        if ((r + c) % 2 === 0) matrix[r][c] = !matrix[r][c];
      }
    }
  }

  // Format info (EC level L, mask 0) -> hardcoded bits
  const formatBits = 0x77c4; // L, mask 0
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    if (i < 6) {
      matrix[8][i] = bit;
      matrix[i][8] = bit;
    } else if (i < 8) {
      matrix[8][i + 1] = bit;
      matrix[i + 1][8] = bit;
    } else if (i < 9) {
      matrix[8][i + 1] = bit;
      matrix[size - 15 + i][8] = bit;
    } else {
      matrix[8][i - 8] = bit;
      matrix[size - 15 + i][8] = bit;
    }
  }
  matrix[size - 8][8] = true;

  return matrix;
}

export function QRCode({ text, size = 200 }: { text: string; size?: number }) {
  const [matrix, setMatrix] = useState<boolean[][] | null>(null);

  useEffect(() => {
    try {
      setMatrix(generateMatrix(text));
    } catch {
      setMatrix(null);
    }
  }, [text]);

  if (!matrix) {
    return <div style={{ width: size, height: size }} className="bg-[#1a1a1f] rounded-xl" />;
  }

  const dims = matrix.length;
  const cell = size / dims;

  return (
    <div
      className="rounded-xl bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {matrix.map((row, r) =>
          row.map((on, c) =>
            on ? (
              <rect
                key={`${r}-${c}`}
                x={c * cell}
                y={r * cell}
                width={cell + 0.5}
                height={cell + 0.5}
                fill="#000"
              />
            ) : null,
          ),
        )}
      </svg>
    </div>
  );
}
