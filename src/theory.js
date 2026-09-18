// Pure music theory: pitch classes, chord symbols, voicings and the
// "what could come next" engine. Nothing in here touches the DOM or the
// audio graph, so all of it runs (and is tested) under plain Node.

export const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const nm = (pc) => NAMES[((pc % 12) + 12) % 12];
export const triadPCs = (root, q) => [root % 12, (root + (q === 'min' ? 3 : 4)) % 12, (root + 7) % 12];
export const chordLabel = (root, q) => nm(root) + (q === 'min' ? 'm' : '');
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const noteName = (m) => nm(m) + (Math.floor(m / 12) - 1); // MIDI 60 -> "C4"

// ---- voicing for the "now playing" / suggestion keyboards ----------------
// close (1 oct) keeps notes tight; spread (2 oct) is root position, spilling
// into a second octave only when the triad does not fit in one.
export function spreadSemis(root, q) {
  // root position: each tone at its pitch class, lifted an octave only if it would fall below the root
  const rootPc = ((root % 12) + 12) % 12;
  return triadPCs(root, q).map((pc) => (pc < rootPc ? pc + 12 : pc));
}
export function spreadMidis(root, q) {
  return spreadSemis(root, q).map((s) => 60 + s);
}
export function triadMidis(root, q, octMode) {
  const third = q === 'min' ? 3 : 4;
  return octMode === 2 ? spreadMidis(root, q) : [60 + root, 60 + root + third, 60 + root + 7];
}

// ---- suggestion engine (functional harmony) -------------------------------
const MAJ_NEXT = [
  { off: 5, q: 'maj', feel: 'Resolve', why: 'Lands home. Down a fifth is the strongest landing.' },
  { off: 7, q: 'maj', feel: 'Brighten', why: 'Up a fifth. Lifts and pushes the music forward.' },
  { off: 9, q: 'min', feel: 'Wistful', why: 'Relative minor. Shares two of three notes, so it slips in softly.' },
  { off: 2, q: 'min', feel: 'Gentle lift', why: 'A step up. Sets up a return back home.' },
];
const MIN_NEXT = [
  { off: 3, q: 'maj', feel: 'Open up', why: 'Relative major. Shares two notes and brightens the mood.' },
  { off: 5, q: 'min', feel: 'Deepen', why: 'Up a fourth. Darker, keeps the introspective feel.' },
  { off: 8, q: 'maj', feel: 'Warm lift', why: 'A bright major a minor sixth up. Lovely contrast.' },
  { off: 7, q: 'maj', feel: 'Tension', why: 'Its dominant. Pulls strongly back to the home minor.' },
];
export function suggest(root, q) {
  return (q === 'min' ? MIN_NEXT : MAJ_NEXT).map((s) => ({ ...s, root: (root + s.off) % 12 }));
}

// ---- chord symbols -> {root,q} --------------------------------------------
const PCLET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': 'maj', m: 'min', 7: 'dom7', m7: 'min7', maj7: 'maj7' };
// intervals above the root; sevenths are four notes, so anything downstream
// has to work off the length rather than assume three
export const CHORD_INT = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
};
export const chordPCs = (root, q) => (CHORD_INT[q] || CHORD_INT.maj).map((i) => (root + i) % 12);
// the mic detector and the suggestion engine only ever deal in plain triads
export const baseQual = (q) => (q === 'min' || q === 'min7' ? 'min' : 'maj');
export function parseChord(sym) {
  const m = /^([A-G])([#b]?)(maj7|m7|m|7)?$/.exec(sym);
  if (!m) throw new Error('bad chord symbol: ' + sym);
  const root = PCLET[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { sym, root: ((root % 12) + 12) % 12, q: QUAL[m[3] || ''] };
}

// ---- two-hand voicing for the song charts --------------------------------
// Stack an ordered set of pitch classes upward from a bottom note.
export function stackUp(order, bottom) {
  const out = [bottom];
  for (let i = 1; i < order.length; i++) {
    let n = out[i - 1] + ((((order[i] - out[i - 1]) % 12) + 12) % 12);
    if (n <= out[i - 1]) n += 12;
    out.push(n);
  }
  return out;
}
// Right hand: try all inversions and keep the one that moves least from
// the previous chord. That is what stops the hand jumping around the keyboard.
export function rhVoicing(root, q, prev) {
  const pcs = chordPCs(root, q),
    N = pcs.length;
  let best = null,
    bestCost = Infinity;
  for (let inv = 0; inv < N; inv++) {
    const order = pcs.map((_, k) => pcs[(inv + k) % N]);
    for (const b of [48 + order[0], 60 + order[0], 72 + order[0]]) {
      if (b < 57 || b > 72) continue;
      const v = stackUp(order, b);
      if (v[v.length - 1] > 84) continue;
      const centre = (v[0] + v[v.length - 1]) / 2;
      let cost;
      if (prev) {
        // chords can differ in size (a triad next to a seventh), so compare the
        // notes that pair up and charge a flat amount for the leftovers
        const n = Math.min(v.length, prev.length);
        cost = Math.abs(v.length - prev.length) * 2 + Math.abs(centre - 66) * 0.12;
        for (let i = 0; i < n; i++) cost += Math.abs(v[i] - prev[i]);
      } else {
        // no previous chord: start in root position, comfortably around middle C
        cost = (inv === 0 ? 0 : 9) + Math.abs(centre - 64) * 0.5;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
    }
  }
  return best;
}
// Left hand, C2..B2. mode: root | oct | fifth
export function lhVoicing(root, mode) {
  const b = 36 + root;
  if (mode === 'root') return [b];
  if (mode === 'fifth') return [b, b + 7];
  return [b, b + 12];
}
// Conventional fingerings.
export function rhFingers(v, root) {
  if (v.length > 3) return '1 2 3 5'; // a seventh: one finger per note
  const bottomIsThird = v[0] % 12 !== root % 12 && (((v[0] - root) % 12) + 12) % 12 <= 4;
  return bottomIsThird ? '1 2 5' : '1 3 5';
}
export const lhFingers = (mode) => (mode === 'root' ? '5' : '5 1');

// Voice a whole song: one step per bar, each right hand chosen relative to
// the previous one. A loop comes round again, so it is voiced a second time
// seeded from its own last chord, which makes the join from the final bar
// back to bar 1 as smooth as every other change.
export function voiceSong(song, lhMode) {
  const voice = (seed) => {
    let prev = seed;
    return song.bars.map(([sym, cue]) => {
      const c = parseChord(sym);
      const rh = rhVoicing(c.root, c.q, prev);
      prev = rh;
      return { ...c, cue, rh, lh: lhVoicing(c.root, lhMode), beats: song.beats };
    });
  };
  let out = voice(null);
  if (song.group === 'loop') out = voice(out[out.length - 1].rh);
  return out;
}

// Chroma vector (12 pitch-class energies) -> best-matching major/minor triad,
// or null when nothing scores above the confidence floor.
export function bestTriad(C, minConf = 0.45) {
  const sum = C.reduce((a, b) => a + b, 0) || 1;
  let best = -1,
    cand = null;
  for (let root = 0; root < 12; root++) {
    for (const q of ['maj', 'min']) {
      const t = triadPCs(root, q);
      const score = (C[t[0]] + C[t[1]] + C[t[2]]) / sum;
      if (score > best) {
        best = score;
        cand = { root, q, conf: score };
      }
    }
  }
  return cand && cand.conf >= minConf ? cand : null;
}
