import { protocol, net } from 'electron'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { getProjectRootPath } from './tomes/projectStore'

const SCHEME = 'priama-asset'

export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function registerAssetProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const root = getProjectRootPath()
    if (!root) {
      return new Response('Project not open', { status: 404 })
    }

    const url = new URL(request.url)
    const relativePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!relativePath) {
      return new Response('Missing path', { status: 400 })
    }

    const filePath = resolve(root, relativePath)
    const resolvedRoot = resolve(root)
    if (!filePath.startsWith(resolvedRoot + '/') && filePath !== resolvedRoot) {
      return new Response('Forbidden', { status: 403 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}
