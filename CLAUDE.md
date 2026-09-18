# Working in this repo

Next Chord is a static web app: vanilla HTML, CSS and ES modules, no build step, no runtime dependencies. Read `README.md` first; the layout table there says where things live.

## Before you finish a change

Run `npm run check` (lint, format check, unit tests). CI runs the same on every pull request. If you touched `src/app.js`, also serve the page (`npm start`) and click through what you changed: the DOM wiring has no automated tests.

## Rules that matter here

- Logic that does not need the DOM goes in `src/theory.js` (or another pure module) with a test in `test/`, not in `src/app.js`.
- Anything a user typed goes through `esc()` before it is placed into `innerHTML`.
- New songs go in `src/songs.js`; `npm test` checks every chord symbol parses and voices. Lyrics only for public-domain songs.
- Keep the code style as is: Prettier formats JavaScript; `index.html` and `styles.css` are hand-formatted and excluded from it.
- Commit messages: one imperative line saying what changed and why, matching the existing history.
