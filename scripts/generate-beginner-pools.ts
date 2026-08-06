/**
 * Generates the beginner pools: the most-observed birds in each region,
 * according to iNaturalist.
 *
 * Run with:  node --experimental-strip-types scripts/generate-beginner-pools.ts
 *
 * Observation count is a far better commonness signal than a hand-written
 * difficulty rating: it is real data, it is per-region, and it updates itself.
 * A bird that a hundred thousand people have photographed in the north-east is,
 * by definition, one a beginner there has a chance of knowing.
 *
 * The region bounds are imported from `src/lib/regions.ts` rather than copied,
 * so the pools cannot drift away from the map the player actually clicks.
 */

import { REGIONS, type RegionId } from '../src/lib/regions.ts'

const INAT = 'https://api.inaturalist.org/v1/observations/species_counts'
const AVES_TAXON_ID = 3
const POOL_SIZE = 250
const PER_PAGE = 200

/** iNaturalist asks for courtesy on an anonymous key; this stays well under it. */
const DELAY_MS = 1100

const USER_AGENT =
  'SongQuest/1.0 (birdsong identification game; generating regional common-species lists)'

interface CountRow {
  count: number
  taxon?: { name?: string; preferred_common_name?: string; rank?: string }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPage(
  bounds: readonly [readonly [number, number], readonly [number, number]],
  page: number,
): Promise<CountRow[]> {
  const [[south, west], [north, east]] = bounds
  const url =
    `${INAT}?taxon_id=${AVES_TAXON_ID}&rank=species&per_page=${PER_PAGE}&page=${page}` +
    `&swlat=${south}&swlng=${west}&nelat=${north}&nelng=${east}`

  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`iNaturalist returned ${response.status} for page ${page}`)
  }
  const body = (await response.json()) as { results?: CountRow[] }
  return Array.isArray(body.results) ? body.results : []
}

async function poolFor(id: RegionId): Promise<string[]> {
  const region = REGIONS[id]
  const names: string[] = []

  for (let page = 1; names.length < POOL_SIZE; page += 1) {
    const rows = await fetchPage(region.bounds, page)
    if (rows.length === 0) break

    for (const row of rows) {
      const name = row.taxon?.name?.trim()
      // Species rank only: iNaturalist happily returns subspecies and hybrids,
      // and neither is a thing the guess input can accept.
      if (!name || row.taxon?.rank !== 'species') continue
      if (name.split(' ').length !== 2) continue
      if (!names.includes(name)) names.push(name)
      if (names.length >= POOL_SIZE) break
    }

    if (rows.length < PER_PAGE) break
    await sleep(DELAY_MS)
  }

  return names
}

function tsLiteral(pools: Record<string, string[]>): string {
  const entries = Object.entries(pools)
    .map(([id, names]) => {
      const body = names.map((n) => `    '${n}',`).join('\n')
      return `  '${id}': [\n${body}\n  ],`
    })
    .join('\n')

  // Best rank across every region: a species that is 3rd most-observed
  // somewhere is a common bird, even if it is absent from most of the map.
  // This is the single commonness scale that replaces hand-written difficulty.
  const best = new Map<string, number>()
  for (const names of Object.values(pools)) {
    names.forEach((name, index) => {
      const current = best.get(name)
      if (current === undefined || index < current) best.set(name, index)
    })
  }
  const ranked = [...best.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name, rank]) => `  '${name}': ${rank},`)
    .join('\n')

  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:
 *   node --experimental-strip-types scripts/generate-beginner-pools.ts
 *
 * The most-observed bird species in each region on iNaturalist, in descending
 * order of observation count. Beginner mode draws only from these, so a new
 * player meets the birds they are actually likely to have heard.
 *
 * Order is meaningful: index 0 is the most-observed species in the region, and
 * that ranking is what seeds a puzzle's Elo now that per-species difficulty
 * ratings are gone.
 */

import type { RegionId } from '@/lib/regions'

export const BEGINNER_POOLS: Readonly<Partial<Record<RegionId, readonly string[]>>> = {
${entries}
}

/**
 * Best observation rank a species reaches in any region — 0 is the most-observed
 * bird somewhere on the map. Absent means it is in no region's top ${POOL_SIZE},
 * which is the game's definition of "not a common bird".
 */
export const COMMONNESS_RANK: Readonly<Record<string, number>> = {
${ranked}
}

/** Rank of a species within a region, or -1 when it is not a beginner bird. */
export function beginnerRank(region: RegionId, scientificName: string): number {
  const pool = BEGINNER_POOLS[region]
  if (!pool) return -1
  return pool.indexOf(scientificName)
}

/** True when the species is among the region's most-observed birds. */
export function isBeginnerSpecies(region: RegionId, scientificName: string): boolean {
  return beginnerRank(region, scientificName) >= 0
}
`
}

async function main(): Promise<void> {
  const ids = Object.keys(REGIONS) as RegionId[]
  const pools: Record<string, string[]> = {}

  for (const id of ids) {
    process.stdout.write(`${id.padEnd(16)} `)
    try {
      const names = await poolFor(id)
      pools[id] = names
      process.stdout.write(`${String(names.length).padStart(3)} species\n`)
    } catch (error) {
      process.stdout.write(`FAILED (${error instanceof Error ? error.message : error})\n`)
    }
    await sleep(DELAY_MS)
  }

  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('src/data/generated', { recursive: true })
  writeFileSync('src/data/generated/beginner-pools.ts', tsLiteral(pools), 'utf8')

  const total = new Set(Object.values(pools).flat()).size
  console.log(`\nwrote src/data/generated/beginner-pools.ts`)
  console.log(`${Object.keys(pools).length} regions, ${total} distinct species`)
}

await main()
