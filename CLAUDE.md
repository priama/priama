# Priama (free)

The free, open-source (MIT) Priama desktop writing app: Electron + React 19 +
TipTap 2 + Zustand, with file-based `.tomes` projects. It ships on macOS
(Apple Silicon), Windows and Linux. Repo: `priama/priama` (public).

This repo is **upstream** of Priama Extra (`../../Priama Extra`). Fixes to
shared features land here first and Priama Extra merges them. Never add Priama
Extra–only code here (the AI assistant, the native macOS app).

The workspace map and the documentation rules shared by all repos are in
`../../CLAUDE.md`.

## Commands

```bash
npm install          # Node 20+
npm run dev          # or: python3 rundev.py (clears ELECTRON_RUN_AS_NODE, separate dev userData)
npm run typecheck    # tsc, main + renderer
npm run lint         # eslint
npm test             # vitest
```

CI (`.github/workflows/test.yml`) runs typecheck, lint and test on pushes and
PRs to `main`, except docs-only changes (`*.md`, `docs/`, `LICENSE`, `.claude/`).
Release builds run only on `v*` tags or by hand. Keep CI to what is needed: don't
add workflows or triggers without asking. Run all three checks before you say a
change is done.

## Layout

- `src/main/` — Electron main process: IPC handlers in `index.ts`, the project
  store and its safety net in `tomes/` (atomic writes, backups, validate,
  recover-on-open), `import/` (DOCX, Scrivener), `export/` (DOCX, EPUB, PDF).
- `src/preload/` — the context bridge.
- `src/renderer/` — the React app (`components/`, `store/`, `lib/`, TipTap
  `extensions/`).
- `src/shared/` — types and pure logic used by both sides.
- `docs/RELEASING.md` — the release runbook. `docs/RELEASING.local.md` holds
  machine-specific details and is git-ignored.

## Releases

When asked to make, ship or publish a release, follow `docs/RELEASING.md`
step by step. Do not improvise, and do not call a release done after
"bump + tag + push": it is done when the release page lists every asset and is
marked Latest, and the website's version strings are bumped.

## Stack policy

- Do not restack (Tauri, SQLite, Markdown/CodeMirror rewrites, a native port)
  unless the user explicitly asks. The native macOS app is a Priama Extra
  project and does not belong in this repo.
- Keep every `@tiptap/*` package on the same 2.x version (2.27.2 in the
  lockfile on 2026-11-18). No TipTap 3 migration unless asked; it breaks custom
  spell check, block styles, entity marks and find/replace.
- Electron upgrades are security upgrades: bump Electron in its own change,
  never together with editor work. Keep `electron-vite` / `electron-builder`
  compatible with it.
- Leave React, Zustand, Radix and dnd-kit alone unless fixing a CVE or bug.
  Do not chase Tailwind 4.

## Keeping docs current

Follow the documentation rules in `../../CLAUDE.md`. In this repo:

| When you change… | Update |
|---|---|
| A user-visible feature, a platform, or a network request | `README.md` (Features, Privacy table, Download table) |
| Build targets, release assets, the workflow, or the release steps | `docs/RELEASING.md` |
| An npm script, the Node version, or the source layout | `README.md` (Development) and the Commands/Layout sections above |
| A dependency covered by the stack policy | The Stack policy section above |
| The `.tomes` on-disk format (`src/main/tomes/`, `src/shared/types.ts`) | Tell the user: Priama Extra's `macos/docs/LEGACY-FORMAT.md` documents this format and must be updated when the change is merged there |
| Bundled third-party code or fonts | `THIRD-PARTY-NOTICES.md` |
| Screenshots in the README after a visible UI change | `docs/screenshots/` |
