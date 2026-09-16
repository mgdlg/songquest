/**
 * URLs for static files.
 *
 * On GitHub Pages the site lives under `/songquest/`. Next applies that prefix
 * to <Link> and the router automatically, but not to a URL built by hand for
 * `fetch()` — a bare `/data/…` would resolve against the domain root and 404.
 * Anything fetched or referenced as a string goes through here.
 */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** `/data/x.json` → `/songquest/data/x.json` in production, unchanged locally. */
export function assetPath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${BASE_PATH}${clean}`
}

/** Where a species' pre-generated dossier is served from. */
export function dossierUrl(speciesId: string): string {
  return assetPath(`/data/species/${encodeURIComponent(speciesId)}.json`)
}
