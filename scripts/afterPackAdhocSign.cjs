const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = join(context.appOutDir, appName)

  console.log(`Ad-hoc signing ${appName} so macOS can verify its bundle resources`)
  execFileSync('/usr/bin/xattr', ['-cr', appPath], {
    stdio: 'inherit'
  })
  execFileSync('/usr/bin/codesign', ['--deep', '--force', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
  execFileSync(
    '/usr/bin/codesign',
    ['--verify', '--deep', '--strict', '--verbose=2', appPath],
    { stdio: 'inherit' }
  )
}
