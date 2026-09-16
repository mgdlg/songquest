/**
 * XENO-CANTO client — the source of every sound in the game.
 *
 * Build-time only, run by scripts/generate-dossiers.ts. The browser never
 * calls the Xeno-canto API: the key would be public on a static site. It does
 * play the recordings directly, which the catalogue permits cross-origin.
 */

import type { AudioCredit, ClipKind } from '../../types/domain';
import { parseXcResponse, type XcRecording } from '../../types/xenocanto';
import { cached, fetchJson, TTL } from '../cache';

export interface ClipQuery {
  scientificName: string;
  kind: ClipKind;
}

const V3_ENDPOINT = 'https://xeno-canto.org/api/3/recordings';

const USER_AGENT =
  'SongQuest/1.0 (bird-song identification game; non-commercial; plays CC BY / CC0 recordings with in-product attribution)';

/**
 * There is no keyless fallback. The v2 API was retired and now answers 404 to
 * every query regardless of syntax; v3 answers 401 without a key. Verified
 * against the live service — a fallback path here would only produce a storm of
 * 404s and an empty dossier, which reads like a bug in this code rather than a
 * missing credential.
 */
export const XC_API_KEY_ENV = 'XENO_CANTO_API_KEY';

/** Worth exactly one line per process, not one per query. */
let missingKeyNoticeLogged = false;

/** Empty string when unset; callers treat that as "no recordings obtainable". */
export function xenoCantoApiKey(): string {
  return (process.env[XC_API_KEY_ENV] ?? '').trim();
}

function noteMissingKey(): void {
  if (missingKeyNoticeLogged) return;
  missingKeyNoticeLogged = true;
  console.error(
    `[xeno-canto] ${XC_API_KEY_ENV} is not set, so no recordings can be fetched and ` +
      'no round can start. The v2 API was retired (404) and v3 requires a key (401). ' +
      'Register free at https://xeno-canto.org/ and add the key to .env.local.',
  );
}

/* ------------------------------------------------------------------ */
/* Query construction                                                  */
/* ------------------------------------------------------------------ */

/**
 * "Alarm" accepts a genuine alarm or a territorial call, and nothing else.
 *
 * It used to fall through to a plain call so that every bird had three clips.
 * In practice that relabelled an ordinary call as "Alarm · Territorial" — and
 * because it took the top-ranked call, usually the very recording already
 * playing as the call clip. A missing voice is now simply omitted; the board
 * renders whichever voices a species genuinely has.
 */
const TYPE_CLAUSES: Readonly<Record<ClipKind, readonly string[]>> = {
  song: ['type:song'],
  call: ['type:call'],
  alarm: ['type:alarm', 'type:"territorial call"'],
};

/** Double quotes and backslashes would break out of the `sp:"…"` clause. */
function sanitiseName(scientificName: string): string {
  return scientificName
    .replace(/["\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * In Xeno-canto's grammar `sp:` is the *specific epithet*, not the binomial —
 * `sp:"Colinus virginianus"` matches nothing. Genus and epithet go in separate
 * clauses. A name with no epithet (a genus-level seed) searches the genus alone
 * rather than emitting an empty `sp:""`, which the parser rejects.
 */
function buildQuery(scientificName: string, typeClause: string, strictQuality: boolean): string {
  const quality = strictQuality ? ' q:">C"' : '';
  const alias = XC_NAME_ALIASES[scientificName];
  const catalogueName = alias?.name ?? scientificName;
  const [genus = '', ...rest] = catalogueName.split(' ').filter((part) => part.length > 0);
  const epithet = rest.join(' ');
  const name = epithet.length > 0 ? `gen:"${genus}" sp:"${epithet}"` : `gen:"${genus}"`;
  const extra = alias?.extra ? ` ${alias.extra}` : '';

  // No `lic:` clause. The field matches one exact code, so filtering upstream
  // would mean issuing a query per acceptable licence, and `lic:"BY"` silently
  // matched nothing at all — plain CC BY barely exists in this catalogue.
  // `permissive` is re-checked on every parsed record instead, which is where
  // the licence rule belongs anyway: one place, applied to what we actually got.
  return `${name} ${typeClause}${quality}${extra}`;
}

/**
 * Where Xeno-canto files a species under a different name than the roster.
 *
 * The roster follows current AOS/IOC taxonomy; the catalogue lags or diverges,
 * and a query under the roster's genus returns nothing at all. Without these,
 * some of the most-recorded birds in North America — Cooper's Hawk, Hairy
 * Woodpecker — were dropped as having no audio. Keyed by the roster binomial;
 * iNaturalist and GBIF still receive the roster name.
 *
 * American Goshawk needs more than a rename. AOS split it from the Eurasian bird
 * in 2023, but Xeno-canto still lumps both under `Accipiter gentilis`, so the
 * query is confined to the Americas rather than borrowing European recordings.
 *
 * Checked against the live catalogue on 2026-09-16.
 */
const XC_NAME_ALIASES: Readonly<Record<string, { name: string; extra?: string }>> = {
  'Astur cooperii': { name: 'Accipiter cooperii' },
  'Astur atricapillus': { name: 'Accipiter gentilis', extra: 'area:america' },
  'Dryobates villosus': { name: 'Leuconotopicus villosus' },
  'Dryobates borealis': { name: 'Leuconotopicus borealis' },
  'Dryobates albolarvatus': { name: 'Leuconotopicus albolarvatus' },
  'Amphispiza quinquestriata': { name: 'Amphispizopsis quinquestriata' },
};

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/**
 * Issues one catalogue query. Successful results (including legitimately empty
 * ones) are cached; failures reject inside `cached` so they are not, and are
 * then swallowed here — a search miss and a 503 both mean "no clip from this
 * query", and neither should take down a dossier.
 */
async function requestRecordings(query: string): Promise<XcRecording[]> {
  const key = xenoCantoApiKey();
  // Short-circuited rather than attempted: without a key every request is a
  // guaranteed 401, and ten of those per dossier bury the one line that says why.
  if (key === '') {
    noteMissingKey();
    return [];
  }

  const params = new URLSearchParams({ query, key });

  // The key is deliberately absent from the cache key: it is constant per
  // process, and keeping secrets out of map keys is cheap hygiene.
  const cacheKey = `xc:v3:${query}`;

  return cached(cacheKey, TTL.SPECIES, async () => {
    const outcome = await fetchJson<unknown>(`${V3_ENDPOINT}?${params.toString()}`, {
      headers: { 'user-agent': USER_AGENT },
    });
    if (!outcome.ok) throw new Error(outcome.error);
    return parseXcResponse(outcome.data).recordings;
  }).catch((err: unknown) => {
    console.warn(
      `[xeno-canto] query failed (${query}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return [] as XcRecording[];
  });
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

const QUALITY_ORDER: Readonly<Record<string, number>> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

/** Long enough to carry a full phrase, short enough not to give the game away. */
const IDEAL_MIN_SECONDS = 5;
const IDEAL_MAX_SECONDS = 35;

function qualityRank(rec: XcRecording): number {
  if (rec.quality === null) return 5;
  return QUALITY_ORDER[rec.quality] ?? 5;
}

function durationRank(rec: XcRecording): number {
  const seconds = rec.durationSeconds;
  if (seconds === 0) return 3; // unparseable length — least predictable
  if (seconds >= IDEAL_MIN_SECONDS && seconds <= IDEAL_MAX_SECONDS) return 0;
  // An over-long cut is still playable; a two-second fragment often is not.
  return seconds > IDEAL_MAX_SECONDS ? 1 : 2;
}

function isXenoCantoHosted(fileUrl: string): boolean {
  try {
    const host = new URL(fileUrl).hostname.toLowerCase();
    return host === 'xeno-canto.org' || host.endsWith('.xeno-canto.org');
  } catch {
    return false;
  }
}

function downloadRank(rec: XcRecording): number {
  return isXenoCantoHosted(rec.fileUrl) ? 0 : 1;
}

function compareRecordings(a: XcRecording, b: XcRecording): number {
  const byQuality = qualityRank(a) - qualityRank(b);
  if (byQuality !== 0) return byQuality;

  const byDuration = durationRank(a) - durationRank(b);
  if (byDuration !== 0) return byDuration;

  const byDownload = downloadRank(a) - downloadRank(b);
  if (byDownload !== 0) return byDownload;

  // Stable tail-breaker so an identical query yields an identical clip.
  return a.id.localeCompare(b.id, 'en');
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Best permissively-licensed recording for a species and vocalisation type.
 *
 * Licence is checked on every parsed record rather than trusted to the query:
 * upstream filters drift, and a licence breach in a shipped product should not
 * depend on one behaving.
 *
 * `exclude` holds catalogue ids already chosen for another voice. Xeno-canto
 * tags one recording with several types — "call, song" is common — so the
 * song and call queries can each rank the same file first. Excluding it makes
 * the next query fall to a genuinely different recording, or to none.
 */
export async function fetchClip(
  q: ClipQuery,
  exclude: ReadonlySet<string> = new Set(),
): Promise<XcRecording | null> {
  const name = sanitiseName(q.scientificName);
  if (name === '') return null;

  const clauses = TYPE_CLAUSES[q.kind] ?? TYPE_CLAUSES.call;

  // Pass one keeps the quality floor; pass two drops it, because a C-grade clip
  // of the right vocalisation beats no clip at all for a scarce species.
  for (const strictQuality of [true, false]) {
    for (const clause of clauses) {
      const recordings = await requestRecordings(buildQuery(name, clause, strictQuality));

      const usable = recordings.filter(
        (rec) => rec.license.permissive && rec.fileUrl !== '' && !exclude.has(rec.id),
      );
      if (usable.length === 0) continue;

      // Sorting a filtered copy — the array inside the cache is shared and must
      // not be reordered under another caller.
      const ranked = [...usable].sort(compareRecordings);
      return ranked[0] ?? null;
    }
  }

  return null;
}

/** Voices in the order they claim a recording: song first, then call, then alarm. */
const CLIP_PRIORITY: readonly ClipKind[] = ['song', 'call', 'alarm'];

/**
 * One recording per voice, never the same recording twice.
 *
 * The kinds are chosen in sequence rather than in parallel so each can exclude
 * what the previous ones took. A voice with no distinct recording left comes
 * back `null` and is simply not shown. A failure on one kind degrades that kind
 * only; whether a species with no audio at all is playable is the dossier
 * builder's decision, not this module's.
 */
export async function fetchDistinctClips(
  scientificName: string,
): Promise<Record<ClipKind, XcRecording | null>> {
  const chosen: Record<ClipKind, XcRecording | null> = { song: null, call: null, alarm: null };
  const taken = new Set<string>();

  for (const kind of CLIP_PRIORITY) {
    try {
      const rec = await fetchClip({ scientificName, kind }, taken);
      chosen[kind] = rec;
      if (rec) taken.add(rec.id);
    } catch (err) {
      console.warn(`[xeno-canto] ${kind} clip for ${scientificName} failed: ${String(err)}`);
    }
  }

  return chosen;
}

/**
 * Builds the attribution record CC BY obliges us to render alongside playback.
 * Every field here ends up on screen, so none of them may be silently dropped.
 */
export function toAudioCredit(rec: XcRecording): AudioCredit {
  return {
    catalogueId: rec.catalogueId,
    recordist: rec.recordist === '' ? 'Unknown recordist' : rec.recordist,
    license: rec.license.label,
    licenseUrl: rec.license.url,
    sourceUrl: rec.pageUrl,
    locality: rec.locality,
    country: rec.country,
    duration: rec.durationSeconds,
    quality: rec.quality,
  };
}
