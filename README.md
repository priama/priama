# Priama

A local-first desktop writing application for authors. Built with Electron, React,
TypeScript, TipTap, and a file-based `.tomes` project format.

## Features

- **Book projects** — each project is a portable folder with a `project.tomes` entry file
- **Manuscript** — chapters and scenes with drag-and-drop reordering
- **Wiki** — characters, locations and lore entries with rich metadata
- **Rich text editor** — TipTap with entity mentions, autosave and export
- **Export** — DOCX, EPUB and PDF; imports DOCX back in
- **Spell check** — offline dictionaries for English, Spanish and Russian
- **Disaster recovery** — automatic zip copies in `backups/`; restore from File → Backups
- **Works offline** — no account, no sign-in, no analytics, no telemetry

## Privacy

Priama stores everything on your own disk and needs no account. It makes exactly
two network requests, both of which you control:

| Request | When | Default |
|---|---|---|
| `api.github.com` — latest release lookup | only when you choose **Check for Updates** | manual |
| `api.languagetool.org` — grammar suggestions | only while *online spell check* is enabled in Settings | **off** |

With online spell check off — which is how it ships — your writing never leaves
the machine. Turning it on sends the text you are editing to LanguageTool's
public API, so it is opt-in and falls back to the offline dictionaries whenever
the request fails. See [`src/renderer/lib/spellCheck.ts`](src/renderer/lib/spellCheck.ts).

## Project format

```
MyBook/
├── project.tomes       # project index and metadata
├── manuscript/         # chapters and scenes (.txd files)
├── wiki/               # characters, locations, lore, notes
└── backups/            # local zip backups
```

## Download

Installers are on [GitHub Releases](https://github.com/priama/priama/releases/latest),
or from [priama.app](https://priama.app).

| Platform | File |
|---|---|
| macOS, Apple Silicon | `Priama-<version>-mac-arm64.dmg` |
| Windows, 64-bit | `Priama-<version>-win-x64-setup.exe` |

Builds are **not** code-signed yet. On macOS, right-click the app and choose
**Open** the first time. On Windows, SmartScreen will warn you — choose **More
info → Run anyway**. There is no Intel Mac or Linux build published yet.

## Development

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run typecheck     # tsc on both the main and renderer projects
npm run lint          # eslint
npm test              # vitest
npm run dist:mac      # build a .dmg
npm run dist:win      # build a Windows installer
npm run dist:linux    # build an AppImage and .deb
```

`src/main` is the Electron main process, `src/preload` the context bridge,
`src/renderer` the React app, and `src/shared` the code both sides use.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through
[SECURITY.md](SECURITY.md) — please don't open a public issue for those.

## License

MIT — see [LICENSE](LICENSE). Bundled third-party components and their licenses
are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
