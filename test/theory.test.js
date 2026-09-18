import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nm,
  triadPCs,
  chordLabel,
  midiToFreq,
  noteName,
  spreadSemis,
  triadMidis,
  suggest,
  chordPCs,
  baseQual,
  parseChord,
  stackUp,
  rhVoicing,
  lhVoicing,
  rhFingers,
  lhFingers,
  voiceSong,
  bestTriad,
} from '../src/theory.js';

test('nm wraps pitch classes in both directions', () => {
  assert.equal(nm(0), 'C');
  assert.equal(nm(12), 'C');
  assert.equal(nm(-1), 'B');
  assert.equal(nm(13), 'C#');
});

test('triadPCs builds major and minor triads', () => {
  assert.deepEqual(triadPCs(0, 'maj'), [0, 4, 7]); // C E G
  assert.deepEqual(triadPCs(9, 'min'), [9, 0, 4]); // A C E
  assert.deepEqual(triadPCs(11, 'maj'), [11, 3, 6]); // B D# F#
});

test('chordLabel adds m only for minor', () => {
  assert.equal(chordLabel(0, 'maj'), 'C');
  assert.equal(chordLabel(9, 'min'), 'Am');
});

test('midiToFreq puts A4 at 440 Hz and octaves double it', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9);
  assert.ok(Math.abs(midiToFreq(60) - 261.6256) < 1e-3);
});

test('noteName carries the octave, with C4 as middle C', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(59), 'B3');
  assert.equal(noteName(36), 'C2');
  assert.equal(noteName(61), 'C#4');
});

test('spreadSemis lifts tones that would fall below the root', () => {
  assert.deepEqual(spreadSemis(0, 'maj'), [0, 4, 7]); // C major fits in one octave
  assert.deepEqual(spreadSemis(9, 'min'), [9, 12, 16]); // A minor: C and E wrap up
  assert.deepEqual(spreadSemis(7, 'maj'), [7, 11, 14]); // G major: D wraps up
});

test('triadMidis: close voicing sits on octave 4, spread follows spreadSemis', () => {
  assert.deepEqual(triadMidis(0, 'maj', 1), [60, 64, 67]);
  assert.deepEqual(triadMidis(9, 'min', 1), [69, 72, 76]);
  assert.deepEqual(triadMidis(9, 'min', 2), [69, 72, 76]);
  assert.deepEqual(triadMidis(7, 'maj', 2), [67, 71, 74]);
});

test('suggest gives four next chords with roots inside 0..11', () => {
  for (const q of ['maj', 'min']) {
    for (let root = 0; root < 12; root++) {
      const s = suggest(root, q);
      assert.equal(s.length, 4);
      for (const x of s) {
        assert.ok(x.root >= 0 && x.root < 12);
        assert.ok(['maj', 'min'].includes(x.q));
        assert.ok(x.feel && x.why);
      }
    }
  }
});

test('suggest: C major offers F, G, Am and Dm', () => {
  const labels = suggest(0, 'maj').map((s) => chordLabel(s.root, s.q));
  assert.deepEqual(labels, ['F', 'G', 'Am', 'Dm']);
});

test('suggest: A minor offers C, Dm, F and E', () => {
  const labels = suggest(9, 'min').map((s) => chordLabel(s.root, s.q));
  assert.deepEqual(labels, ['C', 'Dm', 'F', 'E']);
});

test('parseChord reads roots, accidentals and qualities', () => {
  assert.deepEqual(parseChord('C'), { sym: 'C', root: 0, q: 'maj' });
  assert.deepEqual(parseChord('Am'), { sym: 'Am', root: 9, q: 'min' });
  assert.deepEqual(parseChord('F#'), { sym: 'F#', root: 6, q: 'maj' });
  assert.deepEqual(parseChord('Bb'), { sym: 'Bb', root: 10, q: 'maj' });
  assert.deepEqual(parseChord('Cb'), { sym: 'Cb', root: 11, q: 'maj' });
  assert.deepEqual(parseChord('G7'), { sym: 'G7', root: 7, q: 'dom7' });
  assert.deepEqual(parseChord('Dm7'), { sym: 'Dm7', root: 2, q: 'min7' });
  assert.deepEqual(parseChord('Cmaj7'), { sym: 'Cmaj7', root: 0, q: 'maj7' });
});

test('parseChord rejects anything it does not understand', () => {
  for (const bad of ['', 'H', 'c', 'Cx', 'C9', 'Csus4', 'C m']) {
    assert.throws(() => parseChord(bad), /bad chord symbol/);
  }
});

test('chordPCs: sevenths are four notes, unknown qualities fall back to major', () => {
  assert.deepEqual(chordPCs(7, 'dom7'), [7, 11, 2, 5]); // G B D F
  assert.deepEqual(chordPCs(0, 'maj7'), [0, 4, 7, 11]);
  assert.deepEqual(chordPCs(2, 'min7'), [2, 5, 9, 0]);
  assert.deepEqual(chordPCs(0, 'nonsense'), [0, 4, 7]);
});

test('baseQual folds sevenths down to plain triads', () => {
  assert.equal(baseQual('maj'), 'maj');
  assert.equal(baseQual('dom7'), 'maj');
  assert.equal(baseQual('maj7'), 'maj');
  assert.equal(baseQual('min'), 'min');
  assert.equal(baseQual('min7'), 'min');
});

test('stackUp stacks pitch classes strictly upward from the bottom note', () => {
  assert.deepEqual(stackUp([0, 4, 7], 60), [60, 64, 67]);
  assert.deepEqual(stackUp([4, 7, 0], 64), [64, 67, 72]); // first inversion of C
  assert.deepEqual(stackUp([0, 0], 60), [60, 72]); // same pitch class goes up an octave
});

test('rhVoicing: first chord is root position around middle C', () => {
  assert.deepEqual(rhVoicing(0, 'maj', null), [60, 64, 67]);
});

test('rhVoicing stays within the right-hand range and covers every chord tone', () => {
  for (const q of ['maj', 'min', 'dom7', 'min7', 'maj7']) {
    for (let root = 0; root < 12; root++) {
      const v = rhVoicing(root, q, null);
      assert.ok(v, `no voicing for ${root} ${q}`);
      assert.equal(v.length, chordPCs(root, q).length);
      assert.ok(v[0] >= 57 && v[v.length - 1] <= 84, `out of range: ${v}`);
      for (let i = 1; i < v.length; i++) assert.ok(v[i] > v[i - 1], `not ascending: ${v}`);
      assert.deepEqual(new Set(v.map((m) => m % 12)), new Set(chordPCs(root, q)));
    }
  }
});

test('rhVoicing moves as little as possible from the previous chord', () => {
  const c = rhVoicing(0, 'maj', null); // C E G
  const f = rhVoicing(5, 'maj', c); // keep the C, move E->F and G->A
  assert.deepEqual(f, [60, 65, 69]);
  const g = rhVoicing(7, 'maj', c); // B D G: only one note moves by a semitone
  assert.deepEqual(g, [59, 62, 67]);
});

test('lhVoicing puts the bass in C2..B2 and shapes it by mode', () => {
  assert.deepEqual(lhVoicing(0, 'root'), [36]);
  assert.deepEqual(lhVoicing(0, 'oct'), [36, 48]);
  assert.deepEqual(lhVoicing(0, 'fifth'), [36, 43]);
  assert.deepEqual(lhVoicing(11, 'root'), [47]);
});

test('fingerings', () => {
  assert.equal(rhFingers([60, 64, 67], 0), '1 3 5'); // root position
  assert.equal(rhFingers([64, 67, 72], 0), '1 2 5'); // third on the bottom
  assert.equal(rhFingers([67, 72, 76], 0), '1 3 5'); // fifth on the bottom
  assert.equal(rhFingers([59, 62, 65, 67], 7), '1 2 3 5'); // a seventh
  assert.equal(lhFingers('root'), '5');
  assert.equal(lhFingers('oct'), '5 1');
  assert.equal(lhFingers('fifth'), '5 1');
});

test('voiceSong: one step per bar, carrying chord, cue, hands and beats', () => {
  const song = {
    group: 'song',
    beats: 3,
    bars: [
      ['C', 'one'],
      ['G', 'two'],
      ['Am', ''],
    ],
  };
  const steps = voiceSong(song, 'oct');
  assert.equal(steps.length, 3);
  assert.deepEqual(steps[0], { sym: 'C', root: 0, q: 'maj', cue: 'one', rh: [60, 64, 67], lh: [36, 48], beats: 3 });
  assert.equal(steps[1].sym, 'G');
  assert.equal(steps[1].cue, 'two');
  assert.deepEqual(steps[2].lh, [45, 57]);
});

test('voiceSong: a loop is voiced so its last bar leads smoothly back into bar 1', () => {
  const bars = [
    ['C', ''],
    ['G', ''],
    ['Am', ''],
    ['F', ''],
  ];
  const once = voiceSong({ group: 'song', beats: 4, bars }, 'oct');
  const loop = voiceSong({ group: 'loop', beats: 4, bars }, 'oct');
  // the second pass is seeded from the last chord, so bar 1 is chosen relative to bar 4
  assert.deepEqual(loop[0].rh, rhVoicing(0, 'maj', once[3].rh));
});

test('bestTriad picks the triad whose notes hold the most energy', () => {
  const C = new Array(12).fill(0);
  C[0] = C[4] = C[7] = 1; // C E G
  assert.deepEqual(bestTriad(C), { root: 0, q: 'maj', conf: 1 });
  const a = new Array(12).fill(0);
  a[9] = a[0] = a[4] = 1; // A C E
  assert.deepEqual(bestTriad(a), { root: 9, q: 'min', conf: 1 });
});

test('bestTriad returns null when the energy is spread too thin', () => {
  assert.equal(bestTriad(new Array(12).fill(1)), null); // every triad scores 3/12
  assert.equal(bestTriad(new Array(12).fill(0)), null); // silence: sum guard, no candidate above floor
});
