# How we publish Priama releases

**Read this before every release.** Agents: do not invent a different process.

## Repos

| Repo | Role |
|------|------|
| `andyrpr/texteditor` (public) | Source code and the Release workflow |
| `andyrpr/priama` (public) | GitHub Releases + download site |

Users download from: https://github.com/andyrpr/priama/releases/latest

## What GitHub builds

Pushing tag `vX.Y.Z` on `texteditor` starts `.github/workflows/release.yml`:

- **Windows** (`windows-latest`) → NSIS setup + portable `.exe`
- **Linux** (`ubuntu-latest`) → AppImage + `.deb`
- **macOS** (`macos-latest`) → arm64 DMG (may still fail; keep a local DMG as backup)

Installers are uploaded to **`andyrpr/priama`**, not this repo.

Do **not** treat “bump version + push tag” as finished. The release is done only when the public page has the files.

If the workflow never starts, build and upload locally as before.

## Publish token (one-time)

The workflow needs `PRIAMA_RELEASE_TOKEN` so it can write releases on `priama`.

### Get the token

1. GitHub → your profile picture → **Settings**
2. Bottom left: **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
4. Name it `Priama releases`
5. Resource owner: **andyrpr**
6. Repository access: **Only select repositories** → **priama**
7. Repository permissions → **Contents** → **Read and write**
8. Generate and **copy the token** (shown once)

### Save the token

Save it on **texteditor** (the source repo), not on `priama`:

1. Open https://github.com/andyrpr/texteditor
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**
4. Name: `PRIAMA_RELEASE_TOKEN` (exact spelling)
5. Value: paste the token → **Add secret**

## Correct process (every time)

Replace `0.0.9` with the new version throughout.

### 1. Bump version in source

```bash
npm version 0.0.9 --no-git-tag-version
```

That updates `package.json` and `package-lock.json`. The tag name must match: `v0.0.9`.

### 2. Test

```bash
npm test
```

### 3. Commit and push source

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
Ship Priama 0.0.9.

EOF
)"
git push origin HEAD
```

### 4. Tag source (this starts the Windows/Linux/macOS workflow)

```bash
git tag v0.0.9
git push origin v0.0.9
```

### 5. Confirm CI uploaded installers

- https://github.com/andyrpr/texteditor/actions — Release run is green
- https://github.com/andyrpr/priama/releases/tag/v0.0.9 has Windows and Linux files
- That release is marked **Latest**

### 6. Mac DMG if CI did not attach one

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
gh release upload v0.0.9 release/Priama-0.0.9-mac-arm64.dmg \
  --repo andyrpr/priama \
  --clobber
```

Ad-hoc signing is applied during pack so macOS can verify the bundle (not Developer ID / not notarized).

If Actions never started, create the public release yourself and attach whatever you built:

```bash
gh release create v0.0.9 release/Priama-0.0.9-mac-arm64.dmg \
  --repo andyrpr/priama \
  --title "Priama 0.0.9" \
  --latest \
  --notes "…"
```

Include a short changelog and SHA-256 hashes in the notes:

```bash
shasum -a 256 release/Priama-0.0.9-mac-arm64.dmg
```

## Checklist

- [ ] `package.json` version is the new number
- [ ] Tests passed
- [ ] Version commit pushed to `texteditor`
- [ ] Tag `vX.Y.Z` pushed to `texteditor`
- [ ] `PRIAMA_RELEASE_TOKEN` is set if this is the first CI release
- [ ] Public `priama` release has Windows + Linux (and Mac if available)
- [ ] That release is Latest
- [ ] Local Mac DMG uploaded if CI did not attach one

## Install notes for users

**Mac:** Open the `.dmg`, drag Priama to Applications. Not notarized yet — on first launch, right-click → Open.

**Windows:** Run the setup `.exe`, or use the portable `.exe`. Windows may warn because the build is unsigned.

**Linux:** Run the `.AppImage`, or install the `.deb` on Debian/Ubuntu.
