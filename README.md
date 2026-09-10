# Priama

A local-first desktop writing application for authors. Built with Electron, React, TypeScript, TipTap, and a file-based `.tomes` project format.

## Features

- **Book Projects** — Each project is a portable folder with a `project.tomes` entry file
- **Manuscript** — Chapters and scenes with drag-and-drop reordering
- **Wiki** — Characters, locations, and lore entries with rich metadata
- **Rich Text Editor** — TipTap with entity mentions, autosave, and export
- **Disaster recovery** — Automatic zip copies in `backups/`; restore from File → Backups
- **100% Offline** — No accounts, no cloud, no telemetry

## Project Format

```
MyBook/
├── project.tomes       # Project index and metadata
├── manuscript/         # Chapters and scenes (.txd files)
├── wiki/               # Characters, locations, lore, notes
└── backups/            # Local zip backups
```

## Download

macOS installers are on [GitHub Releases](https://github.com/andyrpr/texteditor/releases/latest). There is also a [download page](https://andyrpr.github.io/texteditor/).

Open the `.dmg`, drag Priama to Applications, then right-click the app and choose **Open** the first time. Builds are not Apple-signed yet.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist:mac
npm run dist:win
```

## License

MIT
