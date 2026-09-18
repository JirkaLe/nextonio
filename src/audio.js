// The piano-ish synth on top of the Web Audio API. Everything that makes a
// sound lives here; the page decides what to play and when.

import { midiToFreq } from './theory.js';

let actx;
export function audio() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
// ---- piano-ish synth -----------------------------------------------------
// A real piano string is stiff, so its partials sit slightly sharp of exact
// multiples of the fundamental, and the high ones die away long before the low
// ones do. Those two facts do most of the work: one oscillator on a single
// decay envelope, which is what this used to be, always reads as an organ.

let masterBus = null;
export function master() {
  const ac = audio();
  if (!masterBus) {
    masterBus = ac.createGain();
    masterBus.gain.value = 0.85;
    // a chord is a lot of partials at once; the compressor keeps the sum in hand
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    // A piano attack is faster than any compressor can react, and chords overlap
    // at the bar line, so peaks get through and the output hard-clips. This tanh
    // curve is the backstop: it cannot output more than ~0.83 whatever goes in.
    const shaper = ac.createWaveShaper(),
      N = 2048,
      curve = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.5) * 0.92;
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    masterBus.connect(comp);
    comp.connect(shaper);
    shaper.connect(ac.destination);
  }
  return masterBus;
}

let noiseBuf = null;
function hammerNoise(ac) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.15), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const STIFF = 0.0007; // string stiffness: how far the partials stretch sharp
function pianoNote(midi, when, dur, vel, dest) {
  const ac = audio(),
    f0 = midiToFreq(midi),
    nyq = ac.sampleRate / 2;
  // bass strings ring for many seconds, the top octave barely at all
  const ring = 4.6 * Math.pow(2, (64 - midi) / 26);
  for (let n = 1; n <= 8; n++) {
    const f = f0 * n * Math.sqrt(1 + STIFF * n * n);
    if (f > nyq * 0.9) break;
    const amp = vel * Math.pow(n, -1.4) * (n % 2 ? 1 : 0.72);
    if (amp < 0.0006) break;
    // The crucial bit, and it has to be steep: on a real piano the top partials
    // are gone in a fraction of a second while the fundamental is still ringing.
    // 1.25 is a taste call: lower leaves the highs ringing and it drifts back
    // toward an organ, higher strips the tail to a near-pure sine.
    const dec = Math.max(0.08, Math.min(12, ring / Math.pow(n, 1.25)));
    // two strings a hair apart, like a real note, which gives the slow shimmer
    const strings = n <= 3 ? [-0.8, 0.8] : [0];
    for (const det of strings) {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = det;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(amp / strings.length, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.00006, when + dec);
      // the damper: let the string decay at its own rate, then stop it when the
      // note's time is up. Capping the decay itself instead flattens every
      // register to the same length, which is what a piano never does.
      g.gain.setTargetAtTime(0.000001, when + dur, 0.05);
      o.connect(g);
      g.connect(dest);
      o.start(when);
      o.stop(when + Math.min(dec, dur) + 0.3);
    }
  }
  // the hammer itself: a click of filtered noise, gone in about 30ms
  const src = ac.createBufferSource();
  src.buffer = hammerNoise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(nyq * 0.85, f0 * 4);
  bp.Q.value = 0.7;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(vel * 0.14, when);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(dest);
  src.start(when);
  src.stop(when + 0.14);
}

// one struck chord: any notes, at any time, for any length
export function playNotes(midis, when, dur, vel, dest) {
  const ac = audio();
  if (ac.state === 'suspended') ac.resume();
  const bus = ac.createGain();
  bus.gain.value = 0.8 / Math.sqrt(midis.length || 1);
  bus.connect(dest || master());
  // the lowest note carries the chord, the rest sit slightly back
  midis.forEach((mi, i) => pianoNote(mi, when, dur, vel * (i === 0 ? 1 : 0.78), bus));
}
