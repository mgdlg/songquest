/**
 * XENO-CANTO client — the source of every sound in the game.
 *
 * Server-only. The browser must never call xeno-canto.org directly: there is no
 * CORS header on the audio, and the API key would be public.
 */

import type { AudioCredit, ClipKind } from '../../types/domain';
import {
  parseXcResponse,
  proxiedAudioUrl,
  type XcRecording,
} from '../../types/xenocanto';
import { cached, fetchJson, TTL } from '../cache';

export interface ClipQuery {
  scientificName: string;
  kind: ClipKind;
}

/** Re-exported so the dossier builder does not need a second import path. */
export { proxiedAudioUrl };

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
 * The alarm chain exists because "alarm" is a sparsely-tagged type. Falling
 * through to a territorial call and then to a plain call means a clip exists
 * wherever one plausibly can, which matters more than tag purity for hint 1.
 */
const TYPE_CLAUSES: Readonly<Record<ClipKind, readonly string[]>> = {
  song: ['type:song'],
  call: ['type:call'],
  alarm: ['type:alarm', 'type:"territorial call"', 'type:call'],
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
  const [genus = '', ...rest] = scientificName.split(' ').filter((part) => part.length > 0);
  const epithet = rest.join(' ');
  const name = epithet.length > 0 ? `gen:"${genus}" sp:"${epithet}"` : `gen:"${genus}"`;

  // No `lic:` clause. The field matches one exact code, so filtering upstream
  // would mean issuing a query per acceptable licence, and `lic:"BY"` silently
  // matched nothing at all — plain CC BY barely exists in this catalogue.
  // `permissive` is re-checked on every parsed record instead, which is where
  // the licence rule belongs anyway: one place, applied to what we actually got.
  return `${name} ${typeClause}${quality}`;
}

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
 * The `lic:"BY"` clause is sent upstream, but the survivors are re-checked
 * against the parsed `lic` field before anything is returned. Upstream filters
 * drift; a licence breach in a shipped product does not get to depend on that.
 */
export async function fetchClip(q: ClipQuery): Promise<XcRecording | null> {
  const name = sanitiseName(q.scientificName);
  if (name === '') return null;

  const clauses = TYPE_CLAUSES[q.kind] ?? TYPE_CLAUSES.call;

  // Pass one keeps the quality floor; pass two drops it, because a C-grade clip
  // of the right vocalisation beats no clip at all for a scarce species.
  for (const strictQuality of [true, false]) {
    for (const clause of clauses) {
      const recordings = await requestRecordings(buildQuery(name, clause, strictQuality));

      const usable = recordings.filter(
        (rec) => rec.license.permissive && rec.fileUrl !== '',
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

/**
 * All three vocalisation types at once. A failure or a miss on any one kind
 * degrades to `null` for that kind only — hint stages handle absence, and only
 * a missing *song* is fatal (which is the dossier builder's judgement, not
 * this module's).
 */
export async function fetchClipSet(
  scientificName: string,
): Promise<Record<ClipKind, XcRecording | null>> {
  const [song, call, alarm] = await Promise.allSettled([
    fetchClip({ scientificName, kind: 'song' }),
    fetchClip({ scientificName, kind: 'call' }),
    fetchClip({ scientificName, kind: 'alarm' }),
  ]);

  return {
    song: settledClip(song, 'song', scientificName),
    call: settledClip(call, 'call', scientificName),
    alarm: settledClip(alarm, 'alarm', scientificName),
  };
}

function settledClip(
  outcome: PromiseSettledResult<XcRecording | null> | undefined,
  kind: ClipKind,
  scientificName: string,
): XcRecording | null {
  if (outcome === undefined) return null;
  if (outcome.status === 'fulfilled') return outcome.value;
  console.warn(
    `[xeno-canto] ${kind} clip for ${scientificName} failed: ${String(outcome.reason)}`,
  );
  return null;
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
