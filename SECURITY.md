# Security policy

## Supported versions

Only the latest release gets fixes. Please upgrade before reporting.

## Reporting a vulnerability

**Please do not open a public issue.**

Use GitHub's private reporting instead:
[Report a vulnerability](https://github.com/priama/priama/security/advisories/new).
It is private between you and the maintainer until a fix ships.

What helps:

- what an attacker can do, and what they need in order to do it
- the version, your OS, and whether the build came from Releases or a local build
- a file, project or sequence of steps that reproduces it

You will get a first reply within about a week. Fixes go out in the next release,
with credit in the release notes unless you would rather stay anonymous.

## Where the risk actually is

Priama is an offline desktop app with no server and no account, so the
interesting surface is the files it opens:

- **`.tomes` projects and `.txd` documents** — JSON and HTML parsed from disk,
  including projects shared by other people
- **DOCX import** — `src/main/import/parseDocx.ts`, parsing untrusted zip and XML
- **Cover images and assets** — loaded through a custom protocol handler,
  `src/main/assetProtocol.ts`
- **Rendered document HTML** — sanitised in `src/shared/import/sanitizeImportedHtml.ts`

Renderer windows run with `contextIsolation: true` and `nodeIntegration: false`;
all privileged work goes through the preload bridge in `src/preload/index.ts`.
Anything that escapes that boundary — arbitrary file read or write outside the
project folder, or code execution from opening a document — is in scope.

Out of scope: the unsigned installers (a known gap, tracked separately), and
anything that needs an attacker to already have access to your machine.
