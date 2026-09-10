# Releasing Priama for macOS

The application source stays in the private `andyrpr/texteditor` repository. Public installers and the download site live in `andyrpr/priama`.

## One-time release credential

Create a fine-grained GitHub personal access token with:

- Repository access: only `andyrpr/priama`
- Repository permission: Contents — Read and write
- An expiration date

Save it as an Actions repository secret named `PRIAMA_RELEASE_TOKEN` in the private `andyrpr/texteditor` repository. Never put the token in this repository, `package.json`, an `.env` file, logs, or the built application.

## Publish a later version

1. Update the version in `package.json` and `package-lock.json`.
2. Run `npm test` and `npm run build`.
3. Commit and push the source change.
4. Create a tag matching the package version exactly, such as `v0.0.2`.
5. Push the tag to `andyrpr/texteditor`.

The private repository's Release workflow builds an ad-hoc-signed Apple Silicon `.dmg` and publishes it as a GitHub Release in `andyrpr/priama`. The ad-hoc signature seals the bundle so macOS does not report it as damaged; until Developer ID signing and notarization are added, users must still approve Priama on first launch.
