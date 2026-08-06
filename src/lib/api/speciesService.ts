/**
 * SPECIES SERVICE — server-side dossier assembly.
 *
 * Fans out to iNaturalist (taxonomy, plate photo, Wikipedia summary),
 * Xeno-canto (song / call / alarm), and GBIF (occurrence-density tile key)
 * and folds the results into a single `SpeciesDossier`.
 *
 * Degradation policy, per ARCHITECTURE §3.4:
 *   - a missing photo, alarm clip, call clip, or range tile is survivable;
 *   - a missing SONG clip is fatal, because there is no game without audio.
 *
 * Runs only on the server. Every browser-facing audio URL is rewritten through
 * `/api/audio` so the client never talks to Xeno-canto directly (CORS, and one
 * cache to rule them).
 */

import type { AudioCredit, SpeciesDossier } from '../../types/domain';
import type { InatTaxon } from '../../types/inaturalist';
import type { XcRecording } from '../../types/xenocanto';
import { cached, TTL } from '../cache';
import { redactDescription } from '../game/redact';
import { fetchClip, toAudioCredit } from './xenocanto';

/* ------------------------------------------------------------------ */
/* Failure model                                                       */
/* ------------------------------------------------------------------ */

export type SpeciesServiceErrorCode =
  | 'bad-request'
  | 'not-found'
  /** The species resolved, but no licence-clean song recording exists. */
  | 'no-audio'
  | 'upstream';

/**
 * The only error type this module throws. Messages are authored here and are
 * safe to show a client; raw upstream bodies never reach one.
 */
export class SpeciesServiceError extends Error {
  readonly code: SpeciesServiceErrorCode;
  readonly status: number;

  constructor(code: SpeciesServiceErrorCode, message: string) {
    super(message);
    this.name = 'SpeciesServiceError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

const STATUS_BY_CODE: Readonly<Record<SpeciesServiceErrorCode, number>> = {
  'bad-request': 400,
  'not-found': 404,
  'no-audio': 502,
  upstream: 502,
};

/**
 * Maps any thrown value onto a client-safe HTTP shape. Anything that is not a
 * `SpeciesServiceError` is assumed to carry upstream detail or a stack and is
 * flattened to a generic 502 — route handlers must never echo it.
 */
export function toErrorResponse(err: unknown): {
  status: number;
  body: { error: string };
} {
  if (err instanceof SpeciesServiceError) {
    return { status: err.status, body: { error: err.message } };
  }
  return {
    status: 502,
    body: { error: 'Upstream data source is unavailable. Try again shortly.' },
  };
}

/* ------------------------------------------------------------------ */
/* Upstream endpoints                                                  */
/* ------------------------------------------------------------------ */

const INAT_BASE = 'https://api.inaturalist.org/v1';
const GBIF_MATCH = 'https://api.gbif.org/v1/species/match';
const GBIF_OCCURRENCE = 'https://api.gbif.org/v1/occurrence/search';

/**
 * GBIF asks for an identifying User-Agent and Xeno-canto rate-limits anonymous
 * traffic harder. One string for every outbound call.
 */
const USER_AGENT = 'SongQuest/1.0 (bird-song identification game; CC-licensed data)';

const UPSTREAM_TIMEOUT_MS = 8_000;

/**
 * GBIF v2 density tiles, per ARCHITECTURE §3.16. Built here rather than
 * imported from `components/map/mapConfig` so a server route never depends on
 * a module that may sit behind a client boundary.
 */
function gbifTileUrl(taxonKey: number): string {
  return (
    `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png` +
    `?taxonKey=${taxonKey}&bin=hex&hexPerTile=42&style=classic.poly`
  );
}

/* ------------------------------------------------------------------ */
/* Read-views over types owned by other modules                        */
/* ------------------------------------------------------------------ */

/**
 * `InatTaxon` and `XcRecording` are declared in files this module does not own
 * (`src/types/*`), and ARCHITECTURE only guarantees their *names* plus
 * Xeno-canto's `file` field. Everything else is read through these
 * all-optional views so a differently-modelled payload cannot break the build
 * or throw at runtime; every access is null-checked below.
 */
interface InatPhotoView {
  medium_url?: string | null;
  url?: string | null;
  square_url?: string | null;
  original_url?: string | null;
  attribution?: string | null;
  license_code?: string | null;
}

interface InatAncestorView {
  rank?: string | null;
  name?: string | null;
}

interface InatTaxonView {
  id?: number | null;
  name?: string | null;
  rank?: string | null;
  preferred_common_name?: string | null;
  english_common_name?: string | null;
  wikipedia_url?: string | null;
  wikipedia_summary?: string | null;
  conservation_status?: {
    status?: string | null;
    status_name?: string | null;
  } | null;
  default_photo?: InatPhotoView | null;
  taxon_photos?: { photo?: InatPhotoView | null }[] | null;
  ancestors?: InatAncestorView[] | null;
}

function inatView(taxon: InatTaxon): InatTaxonView {
  return taxon as unknown as InatTaxonView;
}

/* `XcRecordingView` and `xcView` used to live here, casting an XcRecording to a
   guess at the wire shape. The guess was wrong and the double cast stopped the
   compiler from saying so. `XcRecording` is a declared type — read it directly;
   there is nothing here worth a cast. */

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Settled-result unwrap; a rejection degrades to the caller's fallback. */
function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/** Stable slug matching the `SpeciesSeed.id` convention, e.g. `tyrannus-forficatus`. */
function slugify(scientificName: string): string {
  return scientificName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * iNaturalist returns `wikipedia_summary` as HTML. Only a handful of entities
 * appear in practice; anything unmatched is left as-is rather than mangled.
 */
function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d{1,7});/g, (_match, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const SNIPPET_MIN = 220;
const SNIPPET_MAX = 460;

/**
 * First whole sentences up to roughly `SNIPPET_MAX`, never mid-word.
 * Sentence splitting is done by index rather than a lookbehind regex, which
 * would require an ES2018 compile target this module cannot assume.
 */
function toSnippet(full: string): string {
  if (full.length <= SNIPPET_MAX) return full;

  let cut = 0;
  let from = 0;
  while (from < full.length) {
    const dot = full.indexOf('. ', from);
    if (dot === -1) break;
    const end = dot + 1;
    if (end > SNIPPET_MAX) break;
    cut = end;
    if (cut >= SNIPPET_MIN) break;
    from = dot + 2;
  }
  if (cut > 0) return full.slice(0, cut).trim();

  const clipped = full.slice(0, SNIPPET_MAX);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${lastSpace > SNIPPET_MIN ? clipped.slice(0, lastSpace) : clipped}…`;
}

/** `cc-by-nc` → `CC BY-NC`; unknown or absent codes degrade to an empty string. */
function formatLicenseCode(code: string): string {
  if (!code) return '';
  if (/^cc0$/i.test(code)) return 'CC0';
  const match = /^cc-(.+)$/i.exec(code);
  if (!match) return code.toUpperCase();
  return `CC ${match[1].toUpperCase()}`;
}

/* ------------------------------------------------------------------ */
/* Audio proxying                                                      */
/* ------------------------------------------------------------------ */

const XC_HOST = 'xeno-canto.org';

/**
 * Rewrites a Xeno-canto file URL through `/api/audio`. Anything that is not an
 * https Xeno-canto URL is dropped here rather than handed to the client, so the
 * proxy's allow-list is never the first line of defence. Protocol-relative
 * URLs (`//xeno-canto.org/...`) are still common in the v2 payload.
 */
function proxiedAudioUrl(raw: string): string {
  const candidate = raw.startsWith('//') ? `https:${raw}` : raw;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:') return '';

  const host = parsed.hostname.toLowerCase();
  if (host !== XC_HOST && !host.endsWith(`.${XC_HOST}`)) return '';

  return `/api/audio?src=${encodeURIComponent(parsed.toString())}`;
}

/* ------------------------------------------------------------------ */
/* Upstream fetches                                                    */
/* ------------------------------------------------------------------ */

/**
 * `AbortSignal.timeout` is avoided so this compiles against any lib target the
 * scaffold picks; the controller is cleared in `finally` either way.
 */
async function fetchJson(url: string, label: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new SpeciesServiceError(
        response.status === 404 ? 'not-found' : 'upstream',
        `${label} did not return a usable record.`,
      );
    }
    return (await response.json()) as unknown;
  } catch (err) {
    if (err instanceof SpeciesServiceError) throw err;
    throw new SpeciesServiceError('upstream', `${label} is unreachable.`);
  } finally {
    clearTimeout(timer);
  }
}

function firstResult(payload: unknown): InatTaxon | null {
  if (!isRecord(payload)) return null;
  const results = payload['results'];
  if (!Array.isArray(results) || results.length === 0) return null;
  const first: unknown = results[0];
  return isRecord(first) ? (first as unknown as InatTaxon) : null;
}

async function fetchTaxonById(inatTaxonId: number): Promise<InatTaxon | null> {
  return cached(`inat:id:${inatTaxonId}`, TTL.SPECIES, async () => {
    const payload = await fetchJson(`${INAT_BASE}/taxa/${inatTaxonId}`, 'iNaturalist');
    return firstResult(payload);
  });
}

/**
 * Name → taxon. iNaturalist's search is fuzzy, so the exact binomial is
 * re-checked here; a near-miss is worse than a null because it would poison the
 * photo, the description, and the GBIF key all at once.
 *
 * The match is then re-read from `/taxa/{id}`. The search endpoint returns
 * `ancestor_ids` but not the `ancestors` objects, and the taxonomy hint is
 * built by walking `ancestors` for rank names — without the second read, order
 * and family come back as empty strings and attempt III renders blank. The
 * second read is cached under the id, so it costs one request per species per
 * TTL, not one per round.
 */
export async function resolveTaxon(scientificName: string): Promise<InatTaxon | null> {
  const name = scientificName.trim();
  if (!name) return null;

  return cached(`inat:name:${name.toLowerCase()}`, TTL.SPECIES, async () => {
    const url =
      `${INAT_BASE}/taxa?per_page=10&is_active=true&rank=species&q=` +
      encodeURIComponent(name);
    const payload = await fetchJson(url, 'iNaturalist');
    if (!isRecord(payload)) return null;

    const results = payload['results'];
    if (!Array.isArray(results)) return null;

    const wanted = name.toLowerCase();
    for (const entry of results) {
      if (!isRecord(entry)) continue;
      if (text(entry['name']).toLowerCase() !== wanted) continue;

      const hit = entry as unknown as InatTaxon;
      const id = inatView(hit).id;
      if (typeof id !== 'number' || !Number.isFinite(id)) return hit;

      // Falls back to the search hit: a detail fetch that fails costs the
      // taxonomy hint, which is survivable. Losing the species is not.
      const detailed = await fetchTaxonById(id).catch(() => null);
      return detailed ?? hit;
    }
    return null;
  });
}

export interface RangeExtent {
  center: [number, number]
  bounds: [[number, number], [number, number]]
}

/** Value at a fractional position in an already-sorted array. */
function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))
  return sorted[index] as number
}

/**
 * Where the species actually is, from a sample of georeferenced GBIF records.
 *
 * The frame is the 5th–95th percentile of the sample, not its extremes. Range
 * maps are ruined by outliers: introduced populations and vagrants sit
 * thousands of kilometres from the breeding range, and including them zooms the
 * map out until the range itself is a smudge. Trimming keeps the frame on the
 * part of the distribution a birder would recognise, and the tiles still render
 * every record for anyone who pans out.
 */
async function fetchRangeExtent(taxonKey: number): Promise<RangeExtent | null> {
  return cached(`gbif:extent:${taxonKey}`, TTL.SPECIES, async () => {
    const url =
      `${GBIF_OCCURRENCE}?taxonKey=${taxonKey}` +
      '&hasCoordinate=true&hasGeospatialIssue=false&limit=300'
    const payload = await fetchJson(url, 'GBIF')
    if (!isRecord(payload)) return null

    const results = payload['results']
    if (!Array.isArray(results)) return null

    const lats: number[] = []
    const lngs: number[] = []
    for (const entry of results) {
      if (!isRecord(entry)) continue
      const lat = entry['decimalLatitude']
      const lng = entry['decimalLongitude']
      if (typeof lat !== 'number' || typeof lng !== 'number') continue
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
      lats.push(lat)
      lngs.push(lng)
    }

    // Under a handful of points the percentiles are noise, and a frame drawn
    // from three records is worse than the caller's fallback.
    if (lats.length < 8) return null

    lats.sort((a, b) => a - b)
    lngs.sort((a, b) => a - b)

    const south = percentile(lats, 0.05)
    const north = percentile(lats, 0.95)
    const west = percentile(lngs, 0.05)
    const east = percentile(lngs, 0.95)

    // A pad keeps the outermost cells off the frame edge; the floor stops a
    // single-site species collapsing to a zero-area box Leaflet cannot fit.
    const padLat = Math.max(1.5, (north - south) * 0.12)
    const padLng = Math.max(1.5, (east - west) * 0.12)

    return {
      center: [(south + north) / 2, (west + east) / 2],
      bounds: [
        [Math.max(-85, south - padLat), Math.max(-180, west - padLng)],
        [Math.min(85, north + padLat), Math.min(180, east + padLng)],
      ],
    }
  })
}

/** GBIF usage key for the binomial, or null when GBIF has no confident match. */
async function fetchGbifTaxonKey(scientificName: string): Promise<number | null> {
  return cached(`gbif:${scientificName.toLowerCase()}`, TTL.SPECIES, async () => {
    const url = `${GBIF_MATCH}?strict=true&name=${encodeURIComponent(scientificName)}`;
    const payload = await fetchJson(url, 'GBIF');
    if (!isRecord(payload)) return null;
    if (text(payload['matchType']).toUpperCase() === 'NONE') return null;
    const key = payload['usageKey'];
    return typeof key === 'number' && Number.isFinite(key) ? key : null;
  });
}

/* ------------------------------------------------------------------ */
/* Dossier assembly                                                    */
/* ------------------------------------------------------------------ */

function rankFromAncestors(view: InatTaxonView, rank: string): string {
  const ancestors = view.ancestors;
  if (!Array.isArray(ancestors)) return '';
  for (const ancestor of ancestors) {
    if (!isRecord(ancestor)) continue;
    if (text(ancestor['rank']).toLowerCase() === rank) return text(ancestor['name']);
  }
  return '';
}

/**
 * iNaturalist encodes the size in the filename — `.../188718574/medium.jpg`.
 * The species card shows the plate at full card width and the attempt-IV hint
 * blurs and scales it up, so `medium` (500px) visibly softens. Only the known
 * size words are swapped; a URL shaped differently is left exactly as found
 * rather than guessed at.
 */
function upgradePhotoSize(url: string): string {
  return url.replace(/\/(square|small|medium|thumb)(\.[a-z0-9]+)(\?|$)/i, '/large$2$3');
}

/**
 * Photo licences Song Quest may display, matching the audio policy: Creative
 * Commons, NonCommercial permitted, NoDerivatives refused.
 *
 * iNaturalist reports `license_code: null` for an all-rights-reserved
 * photograph, and most observations are exactly that — the field is the only
 * thing separating a usable plate from someone's copyright. An unrecognised or
 * absent code is therefore a refusal, never a default.
 */
const DISPLAYABLE_PHOTO_LICENSES = new Set([
  'cc0',
  'cc-by',
  'cc-by-sa',
  'cc-by-nc',
  'cc-by-nc-sa',
]);

function isDisplayablePhoto(code: string): boolean {
  return DISPLAYABLE_PHOTO_LICENSES.has(code.trim().toLowerCase());
}

function pickPhoto(view: InatTaxonView): { url: string; attribution: string; license: string } {
  const candidates: (InatPhotoView | null | undefined)[] = [view.default_photo];
  if (Array.isArray(view.taxon_photos)) {
    // Deeper than the default photo alone: the representative image is often
    // all-rights-reserved, and the first openly licensed one may be well down
    // the list.
    for (const wrapper of view.taxon_photos.slice(0, 12)) {
      candidates.push(isRecord(wrapper) ? (wrapper.photo as InatPhotoView | null) : null);
    }
  }

  for (const photo of candidates) {
    if (!isRecord(photo)) continue;

    const code = text(photo.license_code);
    if (!isDisplayablePhoto(code)) continue;

    const url =
      text(photo.medium_url) || text(photo.url) || text(photo.original_url) || text(photo.square_url);
    if (!url) continue;

    return {
      url: upgradePhotoSize(url),
      attribution: text(photo.attribution),
      license: formatLicenseCode(code),
    };
  }

  // Absence is expected and handled by the UI — never a reason to fail a round.
  // Better a species with no plate than a plate we have no right to show.
  return { url: '', attribution: '', license: '' };
}

interface ClipOutcome {
  url: string;
  credit: AudioCredit | null;
  center: [number, number] | null;
}

/**
 * `rec` is the *normalised* record, not the wire payload: the download URL is
 * `fileUrl` and the coordinates are a `[lat, lng]` tuple. An earlier revision
 * read `file`/`lat`/`lng` through a cast, which silently produced an empty URL
 * and discarded every clip — the double cast meant the compiler never saw it.
 * Read the declared fields directly so a future rename fails the build.
 */
function toClipOutcome(rec: XcRecording | null): ClipOutcome {
  if (!rec) return { url: '', credit: null, center: null };

  const url = proxiedAudioUrl(rec.fileUrl);
  if (!url) return { url: '', credit: null, center: null };

  let credit: AudioCredit | null = null;
  try {
    credit = toAudioCredit(rec);
  } catch {
    // A malformed credit must not cost us a playable clip, but the licence
    // block will then render nothing, so log it where an operator can see it.
    console.error('[songquest] failed to build audio credit for a Xeno-canto record');
    credit = null;
  }

  const [lat, lng] = rec.coordinates ?? [null, null];
  const center: [number, number] | null =
    lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? [lat, lng]
      : null;

  return { url, credit, center };
}

async function assembleDossier(input: {
  inatTaxonId?: number;
  scientificName?: string;
}): Promise<SpeciesDossier> {
  let scientificName = (input.scientificName ?? '').trim();
  let taxonPromise: Promise<InatTaxon | null>;

  if (scientificName) {
    taxonPromise =
      input.inatTaxonId != null
        ? fetchTaxonById(input.inatTaxonId)
        : resolveTaxon(scientificName);
  } else if (input.inatTaxonId != null) {
    // Xeno-canto and GBIF are both keyed by binomial, so when only an id is
    // supplied the taxonomy lookup cannot join the parallel fan-out.
    const taxon = await fetchTaxonById(input.inatTaxonId);
    if (!taxon) {
      throw new SpeciesServiceError('not-found', 'No such species.');
    }
    scientificName = text(inatView(taxon).name);
    if (!scientificName) {
      throw new SpeciesServiceError('upstream', 'Taxonomy record is missing a scientific name.');
    }
    taxonPromise = Promise.resolve(taxon);
  } else {
    throw new SpeciesServiceError(
      'bad-request',
      'Provide either an iNaturalist taxon id or a scientific name.',
    );
  }

  const [taxonSettled, songSettled, callSettled, alarmSettled, gbifSettled] =
    await Promise.allSettled([
      taxonPromise,
      fetchClip({ scientificName, kind: 'song' }),
      fetchClip({ scientificName, kind: 'call' }),
      fetchClip({ scientificName, kind: 'alarm' }),
      fetchGbifTaxonKey(scientificName),
    ]);

  const song = toClipOutcome(settled(songSettled, null));
  const call = toClipOutcome(settled(callSettled, null));
  const alarm = toClipOutcome(settled(alarmSettled, null));

  // One recording is enough to play. Requiring a *song* specifically excluded
  // every bird that does not really sing — raptors, herons, most shorebirds,
  // gulls, owls whose voice is catalogued as a call — even where the catalogue
  // held a perfectly good recording of it. The board renders whichever voices
  // exist, so an incomplete set costs a clue, not the round.
  if (!song.url && !call.url && !alarm.url) {
    throw new SpeciesServiceError(
      'no-audio',
      'No licence-clean recording exists for this species.',
    );
  }

  const taxon = settled(taxonSettled, null);
  const view = taxon ? inatView(taxon) : ({} as InatTaxonView);

  const inatTaxonId =
    typeof view.id === 'number' && Number.isFinite(view.id) ? view.id : input.inatTaxonId;
  if (inatTaxonId == null) {
    // Without a taxon id there is no photo, no description, and no stable key —
    // the dossier would be a shell of a species card.
    throw new SpeciesServiceError('upstream', 'Taxonomy lookup failed for this species.');
  }

  const commonName = text(view.preferred_common_name) || text(view.english_common_name) || scientificName;
  const genusFromName = scientificName.split(/\s+/)[0] ?? '';

  const descriptionFull = plainText(text(view.wikipedia_summary));
  const snippetSource = toSnippet(descriptionFull);
  const descriptionSnippet = snippetSource
    ? redactDescription(snippetSource, { commonName, scientificName })
    : '';

  const gbifTaxonKey = settled(gbifSettled, null);
  const photo = pickPhoto(view);

  // Chained rather than folded into the fan-out above: the extent query is keyed
  // by taxonKey, which that fan-out is what produces. A failure here costs the
  // map its opening frame, never the round.
  const extent =
    gbifTaxonKey !== null ? await fetchRangeExtent(gbifTaxonKey).catch(() => null) : null;

  return {
    id: slugify(scientificName) || `inat-${inatTaxonId}`,
    commonName,
    scientificName,
    taxonomy: {
      order: rankFromAncestors(view, 'order'),
      family: rankFromAncestors(view, 'family'),
      genus: rankFromAncestors(view, 'genus') || genusFromName,
    },
    audioClips: {
      songUrl: song.url,
      callUrl: call.url,
      alarmUrl: alarm.url,
    },
    photo,
    rangeMapTileUrl: gbifTaxonKey !== null ? gbifTileUrl(gbifTaxonKey) : '',
    descriptionSnippet,
    inatTaxonId,
    gbifTaxonKey,
    audioCredits: {
      song: song.credit,
      call: call.credit,
      alarm: alarm.credit,
    },
    // Tradeoff acknowledged in ARCHITECTURE §3.3: the un-redacted text ships
    // with the puzzle. Song Quest is single-player with no anti-cheat pretence,
    // and a second round-trip at resolution time would stall the reveal
    // animation. Do not "fix" this by adding a second endpoint.
    descriptionFull,
    wikipediaUrl: text(view.wikipedia_url) || null,
    conservationStatus:
      text(view.conservation_status?.status_name) ||
      text(view.conservation_status?.status) ||
      null,
    // GBIF's sample first: a recording's coordinates are where one microphone
    // happened to be, which for an introduced population is the wrong continent.
    // The clip location is only a last resort.
    rangeCenter: extent?.center ?? song.center ?? call.center ?? alarm.center,
    rangeBounds: extent?.bounds ?? null,
  };
}

function cacheKeyFor(input: { inatTaxonId?: number; scientificName?: string }): string {
  const name = (input.scientificName ?? '').trim().toLowerCase();
  if (name) return `dossier:name:${name}`;
  return `dossier:inat:${input.inatTaxonId ?? 'none'}`;
}

/**
 * Assembled dossiers are cached for `TTL.SPECIES`; the underlying iNaturalist,
 * Xeno-canto, and GBIF calls are cached independently, so a cache miss here
 * still usually resolves without touching the network.
 */
export async function buildDossier(input: {
  inatTaxonId?: number;
  scientificName?: string;
}): Promise<SpeciesDossier> {
  const name = (input.scientificName ?? '').trim();
  if (!name && input.inatTaxonId == null) {
    throw new SpeciesServiceError(
      'bad-request',
      'Provide either an iNaturalist taxon id or a scientific name.',
    );
  }
  return cached(cacheKeyFor(input), TTL.SPECIES, () =>
    assembleDossier({ inatTaxonId: input.inatTaxonId, scientificName: name || undefined }),
  );
}
