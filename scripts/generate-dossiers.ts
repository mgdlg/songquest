/**
 * Pre-generates every bird's dossier as static JSON, so the game can be served
 * from GitHub Pages with no server at all.
 *
 * Run with:  npx tsx scripts/generate-dossiers.ts [--force | --audio-only] [--only=id,id]
 *
 * Why this exists. A static host cannot keep a secret: anything shipped to the
 * browser is readable in devtools, and the Xeno-canto API key would be lifted
 * and abused. So the catalogue is queried here, once, on a machine that holds
 * the key in `.env.local`, and the site ships only the results. The key never
 * leaves this machine.
 *
 * Output
 *   public/data/species/<id>.json      one dossier per playable species
 *   src/data/generated/playable.ts     the ids that have a dossier, bundled so
 *                                      pool filtering stays synchronous
 *
 * Resumable: a species whose JSON already exists is skipped, so an interrupted
 * run picks up where it stopped. `--force` regenerates everything.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SpeciesDossier } from '@/types/domain'
import type { SpeciesSeed } from '@/data/curated-500'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'public', 'data', 'species')
const PLAYABLE_FILE = join(ROOT, 'src', 'data', 'generated', 'playable.ts')

const CONCURRENCY = 4
const RETRY_DELAY_MS = 5_000

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

function loadEnvLocal(): void {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (match && !line.trimStart().startsWith('#') && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2]
    }
  }
}

/* ------------------------------------------------------------------ */
/* Per-host throttle                                                   */
/* ------------------------------------------------------------------ */

/**
 * Minimum spacing between requests to each upstream, enforced by wrapping
 * `fetch` rather than threading a limiter through the service layer.
 *
 * iNaturalist asks for about one request a second and hard-limits at 100 a
 * minute; a burst above that returns 429s that would silently strip photos
 * and taxonomy out of the dossiers. Xeno-canto and GBIF publish no limit, and
 * get a polite spacing anyway.
 */
const SPACING_MS: Record<string, number> = {
  'api.inaturalist.org': 1_100,
  'xeno-canto.org': 250,
  'api.gbif.org': 120,
}

const nextSlot = new Map<string, number>()

function installThrottle(): void {
  const realFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let host = ''
    try {
      host = new URL(url).hostname
    } catch {
      return realFetch(input, init)
    }

    const spacing = SPACING_MS[host] ?? 0
    if (spacing > 0) {
      const now = Date.now()
      const slot = Math.max(now, nextSlot.get(host) ?? 0)
      nextSlot.set(host, slot + spacing)
      if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now))
    }
    return realFetch(input, init)
  }
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

type Outcome = 'ok' | 'skipped' | 'no-audio' | 'failed'

interface Tally {
  ok: number
  skipped: number
  noAudio: string[]
  failed: string[]
  renamed: string[]
}

function parseArgs(): { force: boolean; audioOnly: boolean; only: Set<string> | null } {
  const force = process.argv.includes('--force')
  // Refresh recordings on existing dossiers without re-querying iNaturalist or
  // GBIF. Only species that already have a dossier are touched.
  const audioOnly = process.argv.includes('--audio-only')
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null
  return { force, audioOnly, only }
}

async function main(): Promise<void> {
  loadEnvLocal()
  if (!(process.env.XENO_CANTO_API_KEY ?? '').trim()) {
    console.error('XENO_CANTO_API_KEY is not set in .env.local — no recordings can be fetched.')
    process.exit(1)
  }

  installThrottle()

  // Imported after the environment and the throttle are in place.
  const { buildDossier, rebuildAudio, SpeciesServiceError } = await import('@/lib/api/speciesService')
  const { MASTER_SPECIES } = await import('@/data/master-list')
  const { redactDescription } = await import('@/lib/game/redact')

  const { force, audioOnly, only } = parseArgs()
  mkdirSync(OUT_DIR, { recursive: true })

  const queue: SpeciesSeed[] = MASTER_SPECIES.filter((s) => !only || only.has(s.id))
  const tally: Tally = { ok: 0, skipped: 0, noAudio: [], failed: [], renamed: [] }
  const started = Date.now()
  let done = 0

  /**
   * The roster is authoritative for names and falls back for taxonomy.
   *
   * Autocomplete offers the roster's names and the guess is checked against
   * the dossier's, so the two must agree. iNaturalist's preferred common name
   * often does not — "European Herring Gull" where the roster says otherwise —
   * and a player who picked the bird correctly from the suggestion list would
   * have been marked wrong. The description is re-redacted with the roster's
   * names too, so neither spelling survives in the attempt-IV text.
   */
  function reconcile(seed: SpeciesSeed, dossier: SpeciesDossier): SpeciesDossier {
    const genus = seed.scientificName.split(' ')[0] ?? ''
    if (dossier.commonName.toLowerCase() !== seed.commonName.toLowerCase()) {
      tally.renamed.push(`${seed.commonName}  (iNaturalist: ${dossier.commonName})`)
    }
    return {
      ...dossier,
      id: seed.id,
      commonName: seed.commonName,
      scientificName: seed.scientificName,
      taxonomy: {
        order: dossier.taxonomy.order || seed.order,
        family: dossier.taxonomy.family || seed.family,
        // The roster's genus, always. When iNaturalist resolved the species
        // through a synonym its genus has moved on, and the attempt-III clue
        // would say Anarhynchus while the species card reveals Charadrius.
        genus: genus || dossier.taxonomy.genus,
      },
      descriptionSnippet: redactDescription(dossier.descriptionSnippet, {
        commonName: seed.commonName,
        scientificName: seed.scientificName,
      }),
    }
  }

  async function refreshAudio(seed: SpeciesSeed, file: string): Promise<Outcome> {
    if (!existsSync(file)) return 'skipped'
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const audio = await rebuildAudio(seed.scientificName)
        if (audio === null) {
          // Nothing usable any more: without a recording the bird cannot be
          // played, so its dossier goes and it drops out of the pools.
          unlinkSync(file)
          return 'no-audio'
        }
        const dossier = JSON.parse(readFileSync(file, 'utf8')) as SpeciesDossier
        writeFileSync(file, JSON.stringify({ ...dossier, ...audio }), 'utf8')
        return 'ok'
      } catch {
        if (attempt === 2) return 'failed'
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
    return 'failed'
  }

  async function generate(seed: SpeciesSeed): Promise<Outcome> {
    const file = join(OUT_DIR, `${seed.id}.json`)
    if (audioOnly) return refreshAudio(seed, file)
    if (!force && existsSync(file)) return 'skipped'

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const dossier = await buildDossier({ scientificName: seed.scientificName })
        writeFileSync(file, JSON.stringify(reconcile(seed, dossier)), 'utf8')
        return 'ok'
      } catch (error) {
        const noAudio = error instanceof SpeciesServiceError && error.code === 'no-audio'
        // "No audio" is retried too. The Xeno-canto client reports a failed
        // query as zero results, so a network blip reads exactly like a silent
        // species — Spotted Owl was dropped that way with 92 usable recordings.
        // A genuinely silent bird costs nothing to retry: its empty results are
        // cached, while failed queries are not.
        if (attempt === 2) return noAudio ? 'no-audio' : 'failed'
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
    return 'failed'
  }

  async function worker(): Promise<void> {
    for (;;) {
      const seed = queue.shift()
      if (!seed) return
      const outcome = await generate(seed)
      done += 1

      if (outcome === 'ok') tally.ok += 1
      else if (outcome === 'skipped') tally.skipped += 1
      else if (outcome === 'no-audio') tally.noAudio.push(seed.scientificName)
      else tally.failed.push(seed.scientificName)

      if (outcome !== 'skipped') {
        const mins = ((Date.now() - started) / 60_000).toFixed(1)
        console.log(`[${String(done).padStart(3)}] ${outcome.padEnd(8)} ${seed.id}  (${mins} min)`)
      }
    }
  }

  const total = queue.length
  console.log(`${audioOnly ? 'Refreshing audio on' : 'Generating'} ${total} dossiers (${audioOnly ? 'audio only' : force ? 'forced' : 'resuming'})…`)
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  // Built from what is on disk, not from this run's tally, so a resumed run
  // still lists every dossier the site can actually serve.
  const ids = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort()

  writeFileSync(
    PLAYABLE_FILE,
    `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:  npx tsx scripts/generate-dossiers.ts
 * Last generated:   ${new Date().toISOString().slice(0, 10)}
 *
 * The species that have a pre-built dossier in public/data/species/, and so can
 * actually be served. A species on the roster but missing here had no openly
 * licensed recording when the catalogue was last queried.
 */

export const PLAYABLE_IDS: ReadonlySet<string> = new Set([
${ids.map((id) => `  '${id}',`).join('\n')}
])
`,
    'utf8',
  )

  console.log('\n──────────────────────────────────────────')
  console.log(`generated this run : ${tally.ok}`)
  console.log(`already present    : ${tally.skipped}`)
  console.log(`no usable audio    : ${tally.noAudio.length}`)
  console.log(`failed             : ${tally.failed.length}`)
  console.log(`playable total     : ${ids.length} of ${MASTER_SPECIES.length}`)
  console.log(`names reconciled   : ${tally.renamed.length}`)
  if (tally.noAudio.length) console.log(`\nno audio:\n  ${tally.noAudio.join('\n  ')}`)
  if (tally.failed.length) console.log(`\nfailed (re-run to retry):\n  ${tally.failed.join('\n  ')}`)
  if (tally.renamed.length) console.log(`\nroster name kept over iNaturalist's:\n  ${tally.renamed.slice(0, 40).join('\n  ')}`)
}

// Not top-level `await`: package.json declares no "type": "module", so tsx
// compiles this file as CommonJS, where top-level await is a syntax error.
main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
