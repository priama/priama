# Third-party notices

Priama itself is MIT licensed (see [LICENSE](LICENSE)). A distributed build also
contains the components below. Nothing here restricts your use of Priama, but
these are the licenses whose notices travel with the binaries.

Full license text for every bundled package is in that package's directory under
`node_modules/` after `npm install`.

## Runtime

**Electron** — MIT, bundling **Chromium** (BSD-3-Clause and others) and **Node.js**
(MIT). Each ships its own full notices inside the packaged app; on macOS, see
`Priama.app/Contents/Frameworks/Electron Framework.framework/Resources/LICENSES.chromium.html`.

## Bundled npm packages

367 packages ship inside the app. By license:

| License | Packages |
|---|---|
| MIT | 290 |
| ISC | 24 |
| Apache-2.0 | 18 |
| BSD-2-Clause | 13 |
| BlueOak-1.0.0 | 5 |
| OFL-1.1 | 4 |
| BSD-3-Clause | 4 |
| Other (see below) | 9 |

## Components needing specific mention

### Fonts — SIL Open Font License 1.1

`@fontsource/inter`, `@fontsource/literata`, `@fontsource/lora`,
`@fontsource/merriweather`.

The OFL permits bundling and redistribution. The fonts are shipped unmodified and
under their original names, as the license requires. Reserved Font Names must not
be used for modified versions.

### Spell-check dictionaries

| Package | License | Notes |
|---|---|---|
| `dictionary-en` | MIT **and** BSD | Both apply together |
| `dictionary-ru` | BSD-3-Clause | — |
| `dictionary-es` | GPL-3.0 **or** LGPL-3.0 **or** MPL-1.1 | See below |

`dictionary-es` is offered under any one of three licenses, at the recipient's
choice. **For distribution with Priama we take the MPL-1.1 option.** The GPL-3.0
option is deliberately not exercised, since it would impose terms the rest of
this project does not carry. The dictionary data ships unmodified; under MPL-1.1
its own terms continue to govern that file, and the choice changes nothing for
you as a user or as a contributor to Priama.

### Dual-licensed libraries

| Package | License | Option taken |
|---|---|---|
| `jszip` | MIT **or** GPL-3.0-or-later | MIT |

### Other

| Package | License |
|---|---|
| `pako` | MIT and Zlib |
| `argparse` | Python-2.0 |
| `duck` | BSD |

## Development-only

Tooling that does **not** ship in a build, and so carries no notice obligation
for distributed binaries: `axe-core` (MPL-2.0, reached through
`eslint-plugin-jsx-a11y`), plus TypeScript, Vite, ESLint, Vitest and
electron-builder.

## Regenerating this list

```bash
npm ls --omit=dev --all --parseable | sed 's|.*/node_modules/||' | sort -u
```

Then read each package's `license` field. Re-check after any dependency change
that adds a package, and especially after a major version bump, since licenses
do occasionally change between releases.
