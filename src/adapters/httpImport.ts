// ImportAdapter over plain HTTP GET (B8). The two source sites expose JSON (e.g.
// a file served from GitHub Pages / raw.githubusercontent.com), which we fetch and
// hand to the import mapper. CORS: GitHub Pages and raw.githubusercontent.com both
// send permissive CORS headers for anonymous GETs, so this works from the browser.

import type { ImportAdapter, Json } from './types'

export class HttpImportAdapter implements ImportAdapter {
  async fetch(siteUrl: string): Promise<Json> {
    let res: Response
    try {
      res = await fetch(siteUrl, { headers: { Accept: 'application/json' } })
    } catch {
      // A network/CORS failure throws before any Response exists.
      throw new Error('Could not reach the source (network or CORS). The site must serve JSON with CORS enabled.')
    }
    if (!res.ok) throw new Error(`Source returned ${res.status} ${res.statusText}.`)
    try {
      return (await res.json()) as Json
    } catch {
      throw new Error('Source did not return valid JSON.')
    }
  }
}

export const httpImport = new HttpImportAdapter()
