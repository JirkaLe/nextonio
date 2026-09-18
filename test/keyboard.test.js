import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kbRange, kbWide, WHITE_KEY, BLACK_KEY } from '../src/keyboard.js';

const count = (s, re) => (s.match(re) || []).length;

test('kbRange: a chord inside one octave draws exactly one octave', () => {
  const svg = kbRange([0, 4, 7], '#abc');
  assert.ok(svg.startsWith('<svg class="kb"') && svg.endsWith('</svg>'));
  assert.equal(count(svg, /<rect /g), 12); // 7 white + 5 black
  assert.equal(count(svg, /fill="#abc"/g), 3); // C, E, G lit
});

test('kbRange: only as much of the second octave as the top note needs', () => {
  const svg = kbRange([9, 12, 16], '#abc'); // A minor spread: up to E of the 2nd octave
  assert.equal(count(svg, /<rect /g), 12 + 3 + 2); // whites C D E, blacks C# D#
  assert.equal(count(svg, /fill="#abc"/g), 3);
});

test('kbRange: black keys light up too', () => {
  const svg = kbRange([1, 5, 8], '#abc'); // C# major
  const black = svg.match(/height="40"[^>]*fill="#abc"/g) || [];
  assert.equal(black.length, 2); // C# and G#
  assert.ok(svg.includes(WHITE_KEY) && svg.includes(BLACK_KEY));
});

test('kbWide: four octaves from C2, labels on every C, middle C marked', () => {
  const svg = kbWide(
    new Map([
      [36, '#l'],
      [60, '#r'],
    ]),
  );
  assert.equal(count(svg, /<rect /g), 4 * 12);
  assert.deepEqual(svg.match(/>(C\d)<\/text>/g), ['>C2</text>', '>C3</text>', '>C4</text>', '>C5</text>']);
  assert.equal(count(svg, /<line /g), 1); // the divider at middle C
  assert.equal(count(svg, /fill="#l"/g), 1);
  assert.equal(count(svg, /fill="#r"/g), 1);
});
