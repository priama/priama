# Contributing to Priama

Thanks for taking a look. Priama is a small project, so the process is light.

## Before you build something big

Open an issue first and describe what you have in mind. A large pull request that
arrives unannounced may not fit the direction of the app, and it is better to
find that out before you write it than after.

Small things — a bug fix, a typo, a clearer error message — just send them.

## Setup

Needs Node 20 or newer.

```bash
git clone https://github.com/andyrpr/priama.git
cd priama
npm install
npm run dev
```

`npm run dev` sets `PRIAMA_DEV=1`, which gives the dev build its own user-data
directory, so you cannot damage projects made with an installed copy.

There is also `python3 rundev.py`, which does the same thing and prints which
checkout and commit it launched. Useful when several copies are around.

## Before you open a pull request

All three must pass — CI runs the same three:

```bash
npm run typecheck
npm run lint
npm test
```

Add tests for anything with logic in it. The suite is Vitest, and tests sit next
to what they cover (`foo.ts` → `foo.test.ts`).

## Layout

| Path | What lives there |
|---|---|
| `src/main` | Electron main process: windows, IPC, file system, export |
| `src/preload` | The context bridge — the only path from renderer to Node |
| `src/renderer` | The React app: components, hooks, editor extensions, store |
| `src/shared` | Types and pure logic used by both sides |
| `src/main/tomes` | The `.tomes` project format: reading, writing, backups, recovery |

Two rules worth knowing before you start:

- **Never widen the preload bridge** without a reason. Renderer code has no Node
  access by design; new capability means a new narrow IPC handler, not a broader one.
- **Project writes go through `writeFileAtomic`.** People's manuscripts live in
  these files and a half-written save is data loss.

## Style

ESLint and the existing code are the spec — there is no separate style guide.
Match the file you are editing: its naming, its comment density, its idioms.

Comments should explain *why*, not restate the code. If a line only makes sense
because of a platform quirk or a past bug, say so.

## Commit messages

Write what the change does, in plain language, as a sentence:

```
Give Windows an in-app menu instead of the menu bar.
Stop redrawing the whole window on every keystroke.
```

Not `fix: menu` or `wip`.

## Dependencies

Be conservative. The app is Electron + React + TipTap 2 + Zustand with
file-backed projects, and it is meant to stay that way. Keep all `@tiptap/*`
packages on the same 2.x version. Don't bring in a new runtime, database or
framework as part of an unrelated fix.

## Security

Don't report vulnerabilities in a public issue — see [SECURITY.md](SECURITY.md).
