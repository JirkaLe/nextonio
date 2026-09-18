// Piano keyboard pictures as inline SVG strings. Pure functions of their
// inputs, so they can be rendered and checked without a browser.

import { noteName } from './theory.js';

export const WHITE_KEY = '#E8E2D2';
export const BLACK_KEY = '#262019';
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
const BLACK_PC = [1, 3, 6, 8, 10];
const BLACK_AFTER = [0, 1, 3, 4, 5]; // white index each black key sits after

export function kbRange(semis, color) {
  const set = new Set(semis),
    maxSemi = Math.max(...semis);
  const whitePc = WHITE_PC,
    blackAfter = BLACK_AFTER,
    blackPc = BLACK_PC;
  const whites = []; // {semi,on,wi} where wi = absolute white index (oct*7+i)
  for (let oct = 0; oct < 2; oct++)
    for (let i = 0; i < 7; i++) {
      const semi = oct * 12 + whitePc[i];
      if (oct === 1 && semi > maxSemi) continue; // trim unused part of the 2nd octave
      whites.push({ semi, on: set.has(semi), wi: oct * 7 + i });
    }
  const n = whites.length,
    W = Math.min(18, Math.floor(126 / n)),
    H = 64,
    BW = Math.round(W * 0.6),
    BH = 40;
  const xByWi = {};
  whites.forEach((w, idx) => (xByWi[w.wi] = idx * W));
  let s = `<svg class="kb" width="${n * W}" height="${H}" viewBox="0 0 ${n * W} ${H}" role="img" aria-label="keys">`;
  whites.forEach((w, idx) => {
    s += `<rect x="${idx * W}" y="0" width="${W - 1}" height="${H}" rx="3" fill="${w.on ? color : WHITE_KEY}" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>`;
  });
  for (let oct = 0; oct < 2; oct++)
    for (let k = 0; k < 5; k++) {
      const semi = oct * 12 + blackPc[k];
      if (oct === 1 && semi > maxSemi) continue;
      const prevWi = oct * 7 + blackAfter[k];
      if (!(prevWi in xByWi)) continue;
      s += `<rect x="${xByWi[prevWi] + W - BW / 2}" y="0" width="${BW}" height="${BH}" rx="2.5" fill="${set.has(semi) ? color : BLACK_KEY}" stroke="rgba(0,0,0,.4)" stroke-width=".5"/>`;
    }
  return s + `</svg>`;
}

export function kbWide(marks) {
  // marks: Map midi -> colour
  const START = 36,
    OCTS = 4;
  const whitePc = WHITE_PC,
    blackAfter = BLACK_AFTER,
    blackPc = BLACK_PC;
  const W = 14,
    H = 56,
    BW = 9,
    BH = 36;
  const whites = [];
  for (let o = 0; o < OCTS; o++)
    for (let i = 0; i < 7; i++) whites.push({ midi: START + o * 12 + whitePc[i], wi: o * 7 + i });
  const xByWi = {};
  whites.forEach((w, idx) => (xByWi[w.wi] = idx * W));
  let s = `<svg class="kbwide" viewBox="0 0 ${whites.length * W} ${H}" role="img" aria-label="keyboard">`;
  whites.forEach((w, idx) => {
    const c = marks.get(w.midi);
    s += `<rect x="${idx * W}" y="0" width="${W - 1}" height="${H}" rx="3" fill="${c || WHITE_KEY}" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>`;
    if (w.midi % 12 === 0) {
      const mid = w.midi === 60; // middle C, where the hands divide
      s += `<text x="${idx * W + (W - 1) / 2}" y="${H - 4.5}" text-anchor="middle" font-size="8.5" font-family="monospace" font-weight="${mid ? 700 : 400}" fill="rgba(0,0,0,${mid ? 0.8 : 0.45})">${noteName(w.midi)}</text>`;
      if (mid)
        s += `<line x1="${idx * W - 0.5}" y1="0" x2="${idx * W - 0.5}" y2="${H}" stroke="rgba(0,0,0,.45)" stroke-width="1" stroke-dasharray="3 2.5"/>`;
    }
  });
  for (let o = 0; o < OCTS; o++)
    for (let k = 0; k < 5; k++) {
      const midi = START + o * 12 + blackPc[k],
        prevWi = o * 7 + blackAfter[k];
      s += `<rect x="${xByWi[prevWi] + W - BW / 2}" y="0" width="${BW}" height="${BH}" rx="2.5" fill="${marks.get(midi) || BLACK_KEY}" stroke="rgba(0,0,0,.4)" stroke-width=".5"/>`;
    }
  return s + `</svg>`;
}
