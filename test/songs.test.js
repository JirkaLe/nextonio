import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../src/songs.js';
import { parseChord, voiceSong } from '../src/theory.js';

// The song list is data typed by hand, so these tests are the spell-checker:
// a typo in a chord symbol would otherwise only show up as a blank page.

test('every song has the fields the page relies on', () => {
  for (const s of SONGS) {
    assert.ok(s.name, 'song without a name');
    assert.ok(s.kind, `${s.name}: no kind`);
    assert.ok(['song', 'pop', 'loop'].includes(s.group), `${s.name}: bad group ${s.group}`);
    assert.ok(s.key, `${s.name}: no key`);
    assert.ok([3, 4].includes(s.beats), `${s.name}: beats must be 3 or 4`);
    assert.ok(s.tip, `${s.name}: no tip`);
    assert.ok(Array.isArray(s.bars) && s.bars.length > 0, `${s.name}: no bars`);
  }
});

test('song names are unique (they key the saved words in localStorage)', () => {
  const names = SONGS.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
});

test('every bar is a [chord, cue] pair with a chord that parses', () => {
  for (const s of SONGS) {
    for (const [i, bar] of s.bars.entries()) {
      assert.ok(Array.isArray(bar) && bar.length === 2, `${s.name} bar ${i + 1}: expected [chord, cue]`);
      assert.equal(typeof bar[1], 'string', `${s.name} bar ${i + 1}: cue must be a string`);
      assert.doesNotThrow(() => parseChord(bar[0]), `${s.name} bar ${i + 1}: ${bar[0]}`);
    }
  }
});

test('every song can be voiced for both hands in every left-hand mode', () => {
  for (const s of SONGS) {
    for (const mode of ['root', 'oct', 'fifth']) {
      const steps = voiceSong(s, mode);
      assert.equal(steps.length, s.bars.length);
      for (const st of steps) {
        assert.ok(st.rh && st.rh.length >= 3, `${s.name}: no right hand for ${st.sym}`);
        assert.ok(
          st.lh.every((m) => m >= 36 && m < 60),
          `${s.name}: left hand above middle C for ${st.sym}`,
        );
        assert.ok(
          st.rh.every((m) => m >= 57 && m <= 84),
          `${s.name}: right hand out of range for ${st.sym}`,
        );
      }
    }
  }
});

test('the first song is in the first picker group, so it is selected on load', () => {
  assert.equal(SONGS[0].group, 'song');
});
