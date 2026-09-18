// The page: DOM wiring, microphone detection and song playback. The music
// theory lives in theory.js, the songs in songs.js, the sound in audio.js.

import {
  NAMES,
  nm,
  triadPCs,
  chordLabel,
  spreadSemis,
  triadMidis,
  suggest,
  baseQual,
  noteName,
  rhFingers,
  lhFingers,
  voiceSong,
  bestTriad,
} from './theory.js';
import { SONGS } from './songs.js';
import { kbRange, kbWide } from './keyboard.js';
import { audio, master, playNotes } from './audio.js';

const LEFT_HAND = '#E6A93C';
const RIGHT_HAND = '#67CBA6';
const $ = (id) => document.getElementById(id);

// Anything typed by the user (the words box) goes through here before it is
// put into innerHTML, so a stray "<" in a lyric cannot become markup.
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- voicing: close (1 oct) keeps notes tight; spread (2 oct) lifts upper tones an octave
let octMode = 1; // 1 = close (pitch classes); 2 = root position, spilling to a 2nd octave only when needed
function kbFor(root, q, color) {
  return kbRange(octMode === 2 ? spreadSemis(root, q) : triadPCs(root, q), color);
}
function playTriad(root, q) {
  playNotes(triadMidis(root, q, octMode), audio().currentTime, 4, 0.5);
}

// ---- state + render
let cur = null; // {root,q}
function setChord(root, q, conf, fromMic) {
  cur = { root, q };
  $('nowName').textContent = chordLabel(root, q);
  $('nowName').classList.remove('idle');
  $('nowNotes').textContent = triadPCs(root, q).map(nm).join('  ');
  $('nowConf').textContent = fromMic && conf != null ? 'match ' + Math.round(conf * 100) + '%' : '';
  $('nowKb').innerHTML = kbFor(root, q, LEFT_HAND);
  // sync hand-picker
  document.querySelectorAll('.root').forEach((b) => b.classList.toggle('sel', +b.dataset.pc === root));
  document.querySelectorAll('#qual button').forEach((b) => b.classList.toggle('sel', b.dataset.q === q));
  renderSuggest(root, q);
}
function renderSuggest(root, q) {
  const g = $('sgrid');
  g.innerHTML = '';
  suggest(root, q).forEach((s) => {
    const notes = triadPCs(s.root, s.q);
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="feel">${s.feel}</div>
      <div class="cn">${chordLabel(s.root, s.q)}</div>
      <div class="cnotes">${notes.map(nm).join('  ')}</div>
      <div class="why">${s.why}</div>
      <div class="row">${kbFor(s.root, s.q, RIGHT_HAND)}
        <button class="hear" aria-label="hear ${chordLabel(s.root, s.q)}">&#9658; hear</button></div>`;
    el.querySelector('.hear').onclick = () => playTriad(s.root, s.q);
    g.appendChild(el);
  });
}

// hand-picker
(function () {
  const r = $('roots');
  NAMES.forEach((n, pc) => {
    const b = document.createElement('button');
    b.className = 'root';
    b.dataset.pc = pc;
    b.textContent = n;
    b.onclick = () => setChord(pc, cur ? cur.q : 'maj', null, false);
    r.appendChild(b);
  });
  document.querySelectorAll('#qual button').forEach((b) => {
    b.onclick = () => {
      const q = b.dataset.q;
      if (cur) setChord(cur.root, q, null, false);
      else document.querySelectorAll('#qual button').forEach((x) => x.classList.toggle('sel', x === b));
    };
  });
  document.querySelectorAll('#oct button').forEach((b) => {
    b.onclick = () => {
      octMode = +b.dataset.oct;
      document.querySelectorAll('#oct button').forEach((x) => x.classList.toggle('sel', x === b));
      if (cur) {
        $('nowKb').innerHTML = kbFor(cur.root, cur.q, LEFT_HAND);
        renderSuggest(cur.root, cur.q);
      }
    };
  });
})();

// tap the now-playing keyboard to hear the current chord
$('nowKb').addEventListener('click', () => {
  if (cur) playTriad(cur.root, cur.q);
});

// ---- microphone + detection
let stream, an, buf, timeBuf, raf;
let running = false,
  sr = 44100;
let pending = null,
  pendCount = 0,
  committed = '';
const SILENCE_RMS = 0.012; // below this the room is quiet and nothing is scored
const STABLE_FRAMES = 4; // a chord has to win this many frames in a row to be shown
const lamp = $('lamp'),
  lampIcon = $('lampIcon');
const st = $('st'),
  hint = $('hint'),
  meter = $('meter');

function chroma() {
  an.getFloatFrequencyData(buf);
  const C = new Array(12).fill(0);
  let tot = 0;
  for (let i = 1; i < buf.length; i++) {
    const f = (i * sr) / an.fftSize;
    if (f < 55 || f > 2100) continue;
    if (buf[i] < -95) continue;
    const amp = Math.pow(10, buf[i] / 20);
    const midi = 69 + 12 * Math.log2(f / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    C[pc] += amp;
    tot += amp;
  }
  return { C, tot };
}
function detect() {
  const { C, tot } = chroma();
  // level meter (time domain RMS)
  an.getFloatTimeDomainData(timeBuf);
  let rms = 0;
  for (let i = 0; i < timeBuf.length; i++) rms += timeBuf[i] * timeBuf[i];
  rms = Math.sqrt(rms / timeBuf.length);
  meter.style.width = Math.min(100, rms * 420) + '%';

  const cand = tot > 0 && rms > SILENCE_RMS ? bestTriad(C) : null;
  // stability gate
  const key = cand ? cand.root + cand.q : '';
  if (key === (pending ? pending.root + pending.q : '')) pendCount++;
  else {
    pending = cand;
    pendCount = 1;
  }
  if (cand && pendCount >= STABLE_FRAMES && key !== committed) {
    committed = key;
    setChord(cand.root, cand.q, cand.conf, true);
  }
  if (!cand) {
    st.textContent = 'Listening…';
    hint.textContent = rms <= SILENCE_RMS ? 'Play and hold a chord.' : 'Hold it steady a moment.';
  } else {
    st.textContent = 'Heard it';
    hint.textContent = 'Keep going, or play the next chord.';
  }
  raf = requestAnimationFrame(detect);
}

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    st.textContent = 'Mic blocked';
    st.style.color = 'var(--warn)';
    hint.textContent =
      'Allow microphone for this page. If you are inside a chat, download the file and open it in Chrome, or serve it over localhost.';
    return;
  }
  st.style.color = '';
  const ac = audio();
  sr = ac.sampleRate;
  const src = ac.createMediaStreamSource(stream);
  an = ac.createAnalyser();
  an.fftSize = 32768;
  an.smoothingTimeConstant = 0.6;
  buf = new Float32Array(an.frequencyBinCount);
  timeBuf = new Float32Array(an.fftSize);
  src.connect(an);
  running = true;
  lamp.classList.add('on', 'live');
  lampIcon.textContent = '■';
  committed = '';
  pending = null;
  detect();
}
function stop() {
  running = false;
  cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  lamp.classList.remove('on', 'live');
  lampIcon.textContent = '●';
  meter.style.width = '0';
  st.textContent = 'Mic off';
  hint.textContent = 'Tap the dot to listen again.';
}
lamp.onclick = () => (running ? stop() : start());

// =========================================================================
//  SONGS: simple pieces written out for two hands
// =========================================================================

let songIdx = 0,
  bpm = 76,
  steps = [],
  songBus = null,
  songTimers = [];
let lhMode = 'oct'; // root | oct | fifth
let viewMode = 'keys'; // keys | chart

// Your own words for a song, kept in this browser and nowhere else. They are
// never part of the page's source, so nothing you type here is published.
const wordsKey = (name) => 'nextchord.words.' + name;
function loadWords(name) {
  try {
    return localStorage.getItem(wordsKey(name)) || '';
  } catch {
    return '';
  }
}
function saveWords(name, v) {
  try {
    if (v.trim()) localStorage.setItem(wordsKey(name), v);
    else localStorage.removeItem(wordsKey(name));
  } catch {
    /* private window, or storage blocked: the words just will not stick */
  }
}

function renderSong() {
  const song = SONGS[songIdx];
  steps = voiceSong(song, lhMode);
  applyWords(song);
  $('songMeta').innerHTML =
    `<b>${song.name}</b> &middot; ${song.key} &middot; ${song.beats} beats a bar &middot; ${song.bars.length} bars`;
  $('songTip').textContent = song.tip;
  const box = $('bars');
  box.className = viewMode === 'chart' ? 'chartwrap' : 'bars';
  box.innerHTML = '';
  (viewMode === 'chart' ? renderChart : renderCards)(box);
}

// One line per bar and each line rides along with its bar; any other number of
// lines and there is no sane mapping, so it goes under the music as a block.
function applyWords(song) {
  const raw = loadWords(song.name);
  const lines = raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  const block = $('wordBlock'),
    wordsHint = $('wordsHint');
  const perBar = lines.length === steps.length && lines.length > 0;
  if (perBar) steps.forEach((s, i) => (s.cue = lines[i]));
  block.hidden = !(raw.trim() && !perBar);
  block.textContent = block.hidden ? '' : raw.trim();
  wordsHint.textContent = !raw.trim()
    ? `${song.bars.length} bars in this song. Saved in this browser only — never uploaded, never part of the page.`
    : perBar
      ? `✓ ${lines.length} lines for ${steps.length} bars — each line is showing on its own bar.`
      : `${lines.length} lines for ${steps.length} bars, so it is showing as a block under the music. Match the counts to put a line on each bar.`;
}

// wire a step element up to hear-on-click and the "what comes next" hand-off
function bindStep(el, s, i) {
  el.dataset.i = i;
  el.classList.add('step');
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `bar ${i + 1}, ${s.sym}, hear it`);
  const nxt = el.querySelector('.nxt');
  if (nxt)
    nxt.onclick = (e) => {
      e.stopPropagation();
      setChord(s.root, baseQual(s.q), null, false);
      document.querySelector('.now').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  const hit = () => {
    stopSong();
    playNotes(s.lh.concat(s.rh), audio().currentTime, 4, 0.45);
    flash(i);
  };
  el.onclick = hit;
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hit();
    }
  };
}

// full cards, with the keyboard picture
function renderCards(box) {
  steps.forEach((s, i) => {
    const marks = new Map();
    s.lh.forEach((m) => marks.set(m, LEFT_HAND));
    s.rh.forEach((m) => marks.set(m, RIGHT_HAND));
    const el = document.createElement('div');
    el.className = 'bar';
    el.innerHTML = `
      <div class="top">
        <span class="no">BAR ${i + 1}</span>
        <button class="nxt" title="Show chords that could come next" aria-label="use ${s.sym} as the current chord">&#8599;</button>
        ${s.cue ? `<span class="cue">${esc(s.cue)}</span>` : ''}
      </div>
      <div class="cn">${s.sym}</div>
      <div class="hands">
        <div class="hand l"><span class="h">left</span><br>
          <span class="n">${s.lh.map(noteName).join(' ')}</span><br>
          <span class="f">${lhFingers(lhMode)}</span></div>
        <div class="hand r"><span class="h">right</span><br>
          <span class="n">${s.rh.map(noteName).join(' ')}</span><br>
          <span class="f">${rhFingers(s.rh, s.root)}</span></div>
      </div>
      ${kbWide(marks)}`;
    bindStep(el, s, i);
    box.appendChild(el);
  });
}

// text only: everything written down, nothing to decode from a picture
function renderChart(box) {
  const t = document.createElement('table');
  t.className = 'chart';
  t.innerHTML = `<thead><tr><th>Bar</th><th>Chord</th><th>Left hand</th><th>Right hand</th><th></th></tr></thead>`;
  const body = document.createElement('tbody');
  steps.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.className = 'bar-row';
    tr.innerHTML = `
      <td class="c-no">${i + 1}</td>
      <td class="c-ch">${s.sym}<button class="nxt" title="Show chords that could come next" aria-label="use ${s.sym} as the current chord">&#8599;</button></td>
      <td><span class="c-l">${s.lh.map(noteName).join(' ')}</span><br><span class="c-f">${lhFingers(lhMode)}</span></td>
      <td><span class="c-r">${s.rh.map(noteName).join(' ')}</span><br><span class="c-f">${rhFingers(s.rh, s.root)}</span></td>
      <td class="c-cue">${esc(s.cue || '')}</td>`;
    bindStep(tr, s, i);
    body.appendChild(tr);
  });
  t.appendChild(body);
  box.appendChild(t);
}

function flash(i) {
  highlight(i);
  songTimers.push(setTimeout(() => highlight(-1), 700));
}
let lastBar = -1;
function highlight(i, follow) {
  lastBar = i;
  document.querySelectorAll('.step').forEach((b) => {
    const on = +b.dataset.i === i;
    b.classList.toggle('on', on);
    // while the song plays, keep the current bar on screen so you can read ahead
    if (on && follow) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
function setPlayBtn(on) {
  const b = $('playSong');
  b.classList.toggle('on', on);
  b.innerHTML = on ? '&#9632; stop' : '&#9658; play song';
}
function stopSong() {
  songTimers.forEach(clearTimeout);
  songTimers = [];
  if (songBus) {
    try {
      songBus.disconnect();
    } catch {
      /* already gone */
    }
    songBus = null;
  }
  highlight(-1);
  setPlayBtn(false);
}
function playSong() {
  stopSong();
  const ac = audio();
  if (ac.state === 'suspended') ac.resume();
  songBus = ac.createGain();
  songBus.gain.value = 1;
  songBus.connect(master());
  const spb = 60 / bpm;
  let t = ac.currentTime + 0.12,
    elapsed = 0.12;
  steps.forEach((s, i) => {
    const dur = s.beats * spb;
    playNotes(s.lh, t, dur * 0.96, 0.42, songBus);
    playNotes(s.rh, t, dur * 0.96, 0.34, songBus);
    songTimers.push(setTimeout(() => highlight(i, true), elapsed * 1000));
    t += dur;
    elapsed += dur;
  });
  songTimers.push(setTimeout(stopSong, elapsed * 1000 + 400));
  setPlayBtn(true);
}

// ---- controls
(function () {
  const pick = $('songPick');
  [
    ['song', 'Songs'],
    ['pop', 'Well-known songs'],
    ['loop', 'Progressions to loop'],
  ].forEach(([g, label]) => {
    const row = document.createElement('div');
    row.className = 'pickgroup';
    row.innerHTML = `<span class="glbl">${label}</span>`;
    SONGS.forEach((s, i) => {
      if (s.group !== g) return;
      const b = document.createElement('button');
      b.className = 'song' + (i === 0 ? ' sel' : '');
      b.dataset.i = i;
      b.innerHTML = `${s.name}<span class="kind">${s.kind}</span>`;
      b.onclick = () => {
        stopSong();
        songIdx = i;
        document.querySelectorAll('.song').forEach((x) => x.classList.toggle('sel', +x.dataset.i === i));
        $('wordsBox').value = loadWords(s.name);
        renderSong();
      };
      row.appendChild(b);
    });
    pick.appendChild(row);
  });
  const wBtn = $('wordsBtn'),
    wPane = $('words'),
    wBox = $('wordsBox');
  wBtn.onclick = () => {
    const open = !wPane.classList.contains('open');
    wPane.classList.toggle('open', open);
    wBtn.classList.toggle('on', open);
    wBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      wBox.value = loadWords(SONGS[songIdx].name);
      wBox.focus();
    }
  };
  wBox.oninput = () => saveWords(SONGS[songIdx].name, wBox.value);
  // re-render on blur rather than on every keystroke, which would steal focus
  wBox.onblur = () => renderSong();

  document.querySelectorAll('#view button').forEach((b) => {
    b.onclick = () => {
      viewMode = b.dataset.view;
      document.querySelectorAll('#view button').forEach((x) => x.classList.toggle('sel', x === b));
      const playing = !!songBus;
      renderSong();
      // a re-render drops the highlight, so put it back if a song is mid-play
      if (playing) highlight(lastBar);
    };
  });
  document.querySelectorAll('#lh button').forEach((b) => {
    b.onclick = () => {
      stopSong();
      lhMode = b.dataset.lh;
      document.querySelectorAll('#lh button').forEach((x) => x.classList.toggle('sel', x === b));
      renderSong();
    };
  });
  document.querySelectorAll('#tempo button').forEach((b) => {
    b.onclick = () => {
      const wasPlaying = !!songBus;
      stopSong();
      bpm = +b.dataset.bpm;
      document.querySelectorAll('#tempo button').forEach((x) => x.classList.toggle('sel', x === b));
      if (wasPlaying) playSong();
    };
  });
  $('playSong').onclick = () => (songBus ? stopSong() : playSong());
  renderSong();
})();
