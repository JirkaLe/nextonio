# Next Chord

Play a chord on a piano, and the page listens through the microphone and suggests good ways to keep going. It also writes out simple songs and chord loops for both hands, with a piano-ish synth so you can hear every bar.

Live at the Vercel deployment of this repository. Everything is static: no build step, no server code, no dependencies at runtime.

## Run it locally

The microphone is only allowed on `https` or `localhost`, and the page is split into ES modules, so it has to be served rather than opened as a file:

```sh
npm start          # python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Layout

| File              | What it is                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`      | The page markup. Loads `styles.css` and `src/app.js`.                                                                                             |
| `styles.css`      | All styling.                                                                                                                                      |
| `src/theory.js`   | Pure music theory: pitch classes, chord parsing, voicings, fingerings, the "what next" engine, and the chroma-to-triad matcher. No DOM, no audio. |
| `src/songs.js`    | The song list. Each song is `{name, kind, group, key, beats, tip, bars}`; each bar is `[chord, cue]`.                                             |
| `src/keyboard.js` | The two keyboard pictures, rendered as SVG strings.                                                                                               |
| `src/audio.js`    | The synth on top of the Web Audio API.                                                                                                            |
| `src/app.js`      | Wires the above to the page: microphone detection, rendering, playback, the words box.                                                            |
| `test/`           | Tests for the pure modules, run with Node's built-in test runner.                                                                                 |

The split follows one rule: anything that can be computed without a browser lives outside `app.js`, so it can be tested under plain Node and reasoned about on its own.

## Development

```sh
npm install        # once, dev tooling only
npm test           # unit tests (node --test)
npm run lint       # eslint
npm run format     # prettier, JavaScript only
npm run check      # everything CI runs
```

CI runs `npm run check` on every pull request and on pushes to `main` (see `.github/workflows/ci.yml`).

### Adding a song

Add an entry to `SONGS` in `src/songs.js`. Chord symbols accept a root `A`..`G`, an optional `#` or `b`, and an optional quality `m`, `7`, `m7` or `maj7`. The tests check that every symbol parses and that every bar can be voiced, so `npm test` catches a typo before it reaches the page.

Only put lyrics in `bars` for songs whose words are in the public domain. For everything else, use the cue to mark sections, and let people paste their own words into the words box (which stays in their browser's `localStorage` and never enters the source).

## Conventions

- Vanilla HTML, CSS and JavaScript. No framework and no bundler, on purpose: the whole thing should stay readable as source.
- Keep `app.js` thin. Logic that does not need the DOM goes in `theory.js` or a new pure module, with a test.
- Anything typed by a user goes through `esc()` before it is placed into `innerHTML`.
- Commit messages: one line saying what changed and why, in the imperative, as in the existing history.
