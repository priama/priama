const { execFileSync } = require('node:child_process')
const {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync
} = require('node:fs')
const { join, resolve } = require('node:path')

const projectRoot = resolve(__dirname, '..')
// /tmp avoids Desktop/iCloud file-provider metadata and a macOS hdiutil failure
// seen when both its source and scratch image live under $TMPDIR in /var/folders.
const temporaryOutput = mkdtempSync('/tmp/priama-builder-')
const releaseOutput = join(projectRoot, 'release')
const electronBuilder = join(projectRoot, 'node_modules', 'electron-builder', 'cli.js')

try {
  execFileSync(
    process.execPath,
    [
      electronBuilder,
      '--mac',
      `--config.directories.output=${temporaryOutput}`,
      ...process.argv.slice(2)
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit'
    }
  )

  mkdirSync(releaseOutput, { recursive: true })
  const installers = readdirSync(temporaryOutput).filter((name) => name.endsWith('.dmg'))
  if (installers.length === 0) {
    throw new Error('electron-builder did not produce a DMG')
  }

  for (const installer of installers) {
    copyFileSync(join(temporaryOutput, installer), join(releaseOutput, installer))
    console.log(`Copied ${installer} to release/`)
  }
} finally {
  rmSync(temporaryOutput, { recursive: true, force: true })
}
