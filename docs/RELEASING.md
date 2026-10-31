# How we publish Priama releases

**Read this before every release.** Agents: do not invent a different process.

Everything lives in one repo now — `andyrpr/priama` holds the source, the
workflows and the published installers. The website is separate
(`andyrpr/priamaweb`, deployed to [priama.app](https://priama.app) by Vercel) and
reads releases from this repo over the public GitHub API.

## Which path to take

There are two, and the first question every release is which one applies:

```bash
gh run list --repo andyrpr/priama --limit 3
```

- Runs **complete** → use [path A, the workflow](#path-a-let-the-workflow-do-it).
- Runs show **`startup_failure`** → use [path B, by hand](#path-b-build-by-hand).

Actions used to fail account-wide on the old private repo because private-repo
minutes are billed. This repo is public, and public repos get GitHub-hosted
runners for free, so path A is expected to work. Confirm rather than assume.

## What a release contains

| File | Platform |
|---|---|
| `Priama-<version>-mac-arm64.dmg` | macOS, Apple Silicon |
| `Priama-<version>-win-x64-setup.exe` | Windows, 64-bit Intel/AMD |

The Windows build also emits a portable `.exe`. **We do not publish it** — the
installer is what we ship.

One Windows build is enough: x64 covers every Intel/AMD machine, and Windows on
ARM runs it under emulation. There is no Intel Mac build; `build.mac.target` is
`arm64` only. The workflow also builds Linux (AppImage + `.deb`), which the
manual path cannot produce.

Builds are unsigned — ad-hoc signed on macOS, not notarised.

---

## Steps 1–3 are the same either way

### 1. Bump the version

```bash
npm version 0.0.11 --no-git-tag-version
```

Updates `package.json` and `package-lock.json`. The tag must match: `v0.0.11`.

### 2. Run the checks

```bash
npm run typecheck && npm run lint && npm test
```

All three must pass. On path B nothing else will check them for you.

### 3. Commit and push

```bash
git add package.json package-lock.json
git commit -m "Ship Priama 0.0.11."
git push origin main
```

---

## Path A — let the workflow do it

Push the tag:

```bash
git tag v0.0.11 && git push origin v0.0.11
```

`.github/workflows/release.yml` then builds macOS, Windows and Linux in parallel
and publishes them to this repo's Releases using the built-in `GITHUB_TOKEN`. No
personal access token is involved.

Watch it:

```bash
gh run watch --repo andyrpr/priama
```

Then go to [verifying](#verifying).

> **Older tags point at the wrong commits.** `v0.0.1`, `v0.0.2`, `v0.0.5`,
> `v0.0.9` and `v0.0.10` were created before the repos merged and all point at
> the old website commit. Leave them alone — they anchor published releases.
> Tags from `v0.0.11` on are normal.

---

## Path B — build by hand

Needed only while Actions is failing. Two machines: a Mac for the DMG, a Windows
machine for the installer.

### What you need

- **A Mac** — builds the DMG.
- **A Windows machine** — builds the `.exe`. Powered on, reachable over SSH on
  the local network, with any VPN kill switch off, since that blocks inbound SSH.
  It needs Node, an SSH server, and a checkout whose `node_modules` is installed.
- `gh` logged in with write access to `andyrpr/priama`.

Host, user, key path and directories are in `docs/RELEASING.local.md`, which is
deliberately untracked. Export them first:

```bash
export PRIAMA_WIN_HOST=...
export PRIAMA_WIN_KEY=...
```

Tag the release so the history matches path A:

```bash
git tag v0.0.11 && git push origin v0.0.11
```

### 4. Build the macOS DMG

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
```

Lands in `release/Priama-0.0.11-mac-arm64.dmg`.

> **If this hangs at `packaging platform=darwin` with no CPU use**, the cached
> Electron archive is corrupt — electron-builder hangs instead of failing:
> ```bash
> rm -rf ~/Library/Caches/electron
> ```

### 5. Build the Windows installer

Copy the source over (excluding `node_modules`, already there), build, copy back:

```bash
COPYFILE_DISABLE=1 tar --exclude='./node_modules' --exclude='./release' \
  --exclude='./.git' --exclude='./out' --exclude='.DS_Store' \
  -czf /tmp/priama-src.tgz .

scp -i "$PRIAMA_WIN_KEY" /tmp/priama-src.tgz "$PRIAMA_WIN_HOST:priama-src.tgz"
```

Then on that machine over SSH, extract into its checkout directory keeping
`node_modules`, and run:

```
npm run dist:win -- --x64
```

`--x64` matters: without it electron-builder targets the host architecture, and
`build.win` pins none, so an ARM machine silently produces an arm64 installer
that will not run on a normal PC. Copy the resulting
`Priama-0.0.11-win-x64-setup.exe` back into `release/`.

`COPYFILE_DISABLE=1` stops macOS writing `._*` files into the tarball.

### 6. Publish

```bash
shasum -a 256 release/Priama-0.0.11-mac-arm64.dmg \
              release/Priama-0.0.11-win-x64-setup.exe

gh release create v0.0.11 \
  release/Priama-0.0.11-win-x64-setup.exe \
  release/Priama-0.0.11-mac-arm64.dmg \
  --repo andyrpr/priama \
  --title "Priama 0.0.11" \
  --latest \
  --notes-file notes.md
```

Include a short changelog and the SHA-256 hashes in the notes.

---

## Verifying

```bash
gh api repos/andyrpr/priama/releases/latest --jq '.tag_name'
gh release view v0.0.11 --repo andyrpr/priama \
  --json assets --jq '.assets[] | "\(.name) \(.size) \(.state)"'
```

Every asset must show `state=uploaded`, and `releases/latest` must return the new
tag. A release is **only** finished when that page has the installers and is
marked Latest. Bumping the version and pushing a tag is not a release.

## Then update the website

The download page falls back to hardcoded URLs when the GitHub API is slow or
unreachable. In `andyrpr/priamaweb`, bump `FALLBACK_ASSETS` in `js/main.js` to
the new version and push — Vercel redeploys on its own.

The live buttons read the API, so they work the moment the release is published;
this only keeps the fallback honest.

## Checklist

- [ ] Version bumped in `package.json` and the lockfile
- [ ] `typecheck`, `lint` and `test` all pass
- [ ] Version commit and `vX.Y.Z` tag pushed
- [ ] macOS DMG built (CI or locally)
- [ ] Windows `-x64-setup.exe` built (CI or on the Windows machine)
- [ ] Both attached to the release, with hashes in the notes
- [ ] That release is **Latest**
- [ ] `FALLBACK_ASSETS` bumped in `priamaweb`

## Install notes for users

**macOS** — open the `.dmg`, drag Priama to Applications. Not notarised, so on
first launch right-click the app and choose **Open**.

**Windows** — run the setup `.exe`. SmartScreen warns because the build is
unsigned: **More info → Run anyway**.
