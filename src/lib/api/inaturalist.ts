/**
 * iNATURALIST v1 client — taxonomy, plates, and the Wikipedia blurb.
 *
 * No API key is required, but iNaturalist asks every consumer to identify
 * itself and rate-limits anonymous floods, so a descriptive User-Agent goes on
 * every request. Server-only.
 */

import {
  isDisplayablePhotoLicense,
  photoLicenseLabel,
  type InatPhoto,
  type InatTaxaResponse,
  type InatTaxon,
} from '../../types/inaturalist';
import { cached, fetchJson, TTL } from '../cache';

const BASE = 'https://api.inaturalist.org/v1';

const USER_AGENT =
  'SongQuest/1.0 (bird-song identification game; non-commercial; displays CC0 / CC BY / CC BY-SA media with attribution)';

const DEFAULT_SEARCH_LIMIT = 12;
/** iNaturalist caps `per_page` at 200; nothing here needs more than a page. */
const MAX_SEARCH_LIMIT = 30;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Rejects so `cached` does not memoise a transient upstream failure. */
async function getJson<T>(path: string): Promise<T> {
  const outcome = await fetchJson<T>(`${BASE}${path}`, {
    headers: { 'user-agent': USER_AGENT },
  });
  if (!outcome.ok) throw new Error(`iNaturalist ${path}: ${outcome.error}`);
  return outcome.data;
}

function warn(context: string, err: unknown): void {
  console.warn(`[inaturalist] ${context}: ${err instanceof Error ? err.message : String(err)}`);
}

function isUsableTaxon(taxon: unknown): taxon is InatTaxon {
  if (typeof taxon !== 'object' || taxon === null) return false;
  const candidate = taxon as Partial<InatTaxon>;
  return typeof candidate.id === 'number' && typeof candidate.name === 'string';
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

/**
 * Free-text species search. Returns an empty array — never throws — so a
 * typeahead keystroke can never break the route handler behind it.
 */
export async function searchTaxa(q: string, limit: number = DEFAULT_SEARCH_LIMIT): Promise<InatTaxon[]> {
  const term = q.trim();
  if (term === '') return [];

  const perPage = clamp(limit, 1, MAX_SEARCH_LIMIT);
  const params = new URLSearchParams({
    q: term,
    rank: 'species',
    is_active: 'true',
    per_page: String(perPage),
    locale: 'en',
  });

  return cached(`inat:search:${term.toLowerCase()}:${perPage}`, TTL.SEARCH, async () => {
    const body = await getJson<InatTaxaResponse>(`/taxa?${params.toString()}`);
    const results = Array.isArray(body.results) ? body.results : [];
    return results.filter(isUsableTaxon).filter((taxon) => taxon.is_active !== false);
  }).catch((err: unknown) => {
    warn(`search "${term}"`, err);
    return [] as InatTaxon[];
  });
}

/** Single taxon by id, with ancestors. `null` on a bad id, a 404, or a failure. */
export async function getTaxon(id: number): Promise<InatTaxon | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  return cached(`inat:taxon:${id}`, TTL.SPECIES, async () => {
    const body = await getJson<InatTaxaResponse>(`/taxa/${id}`);
    const first = Array.isArray(body.results) ? body.results[0] : undefined;
    return isUsableTaxon(first) ? first : null;
  }).catch((err: unknown) => {
    warn(`taxon ${id}`, err);
    return null;
  });
}

/**
 * Resolves a binomial to its taxon record.
 *
 * iNaturalist's `q=` is fuzzy, so an exact case-insensitive match on `name` is
 * preferred over the first hit — "Turdus migratorius" must not silently
 * resolve to a congener because relevance ranking had a bad day.
 */
export async function taxonByName(scientificName: string): Promise<InatTaxon | null> {
  const name = scientificName.trim();
  if (name === '') return null;

  const params = new URLSearchParams({
    q: name,
    rank: 'species',
    is_active: 'true',
    per_page: '10',
    locale: 'en',
  });

  const resolved = await cached(`inat:name:${name.toLowerCase()}`, TTL.SPECIES, async () => {
    const body = await getJson<InatTaxaResponse>(`/taxa?${params.toString()}`);
    const results = (Array.isArray(body.results) ? body.results : []).filter(isUsableTaxon);
    if (results.length === 0) return null;

    const wanted = name.toLowerCase();
    const exact = results.find((taxon) => taxon.name.trim().toLowerCase() === wanted);
    if (exact !== undefined) return exact;

    const species = results.find((taxon) => (taxon.rank ?? '').toLowerCase() === 'species');
    return species ?? results[0] ?? null;
  }).catch((err: unknown) => {
    warn(`name "${name}"`, err);
    return null;
  });

  if (resolved === null) return null;

  // The search endpoint often omits `ancestors`; the dossier needs order and
  // family, so re-read the full record when the chain is missing.
  if (!Array.isArray(resolved.ancestors) || resolved.ancestors.length === 0) {
    const full = await getTaxon(resolved.id);
    if (full !== null) return full;
  }

  return resolved;
}

/* ------------------------------------------------------------------ */
/* Derivations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Walks the ancestor chain by rank name. Ranks are read from the chain *and*
 * from the taxon itself, since a genus-level record carries its own rank and a
 * species record's ancestors stop one level above it.
 */
export function extractTaxonomy(t: InatTaxon): { order: string; family: string; genus: string } {
  const byRank = new Map<string, string>();

  const chain: InatTaxon[] = [...(Array.isArray(t.ancestors) ? t.ancestors : []), t];
  for (const node of chain) {
    if (!isUsableTaxon(node)) continue;
    const rank = typeof node.rank === 'string' ? node.rank.trim().toLowerCase() : '';
    const name = node.name.trim();
    if (rank !== '' && name !== '') byRank.set(rank, name);
  }

  const order = byRank.get('order') ?? '';
  const family = byRank.get('family') ?? '';

  let genus = byRank.get('genus') ?? '';
  if (genus === '' && typeof t.rank === 'string' && t.rank.trim().toLowerCase() === 'species') {
    // A binomial carries its genus even when the ancestor chain was omitted.
    genus = t.name.trim().split(/\s+/)[0] ?? '';
  }

  return { order, family, genus };
}

/** Bumps a photo URL up to the largest standard rendition iNaturalist serves. */
function toLargeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '') return '';
  return trimmed.replace(
    /\/(square|small|medium|thumb)\.(jpe?g|png|gif|webp)(\?.*)?$/i,
    (_match, _size: string, ext: string, query: string | undefined) =>
      `/large.${ext}${query ?? ''}`,
  );
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

function photoUrl(photo: InatPhoto): string {
  return toLargeUrl(firstNonEmpty(photo.large_url, photo.medium_url, photo.url));
}

function isPhoto(value: unknown): value is InatPhoto {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<InatPhoto>;
  return (
    typeof candidate.url === 'string' ||
    typeof candidate.medium_url === 'string' ||
    typeof candidate.large_url === 'string'
  );
}

/**
 * First photo whose licence permits display, preferring the default plate.
 *
 * Rejecting `null` licence codes is the important half: those are "(c) all
 * rights reserved", and iNaturalist serves them from the same field as the
 * CC-licensed ones.
 */
export function bestPhoto(
  t: InatTaxon,
): { url: string; attribution: string; license: string } | null {
  const candidates: unknown[] = [t.default_photo];

  if (Array.isArray(t.taxon_photos)) {
    for (const entry of t.taxon_photos as unknown[]) {
      if (typeof entry === 'object' && entry !== null) {
        candidates.push((entry as { photo?: unknown }).photo);
      }
    }
  }

  for (const candidate of candidates) {
    if (!isPhoto(candidate)) continue;
    if (!isDisplayablePhotoLicense(candidate.license_code)) continue;

    const url = photoUrl(candidate);
    if (url === '') continue;

    const license = photoLicenseLabel(candidate.license_code);
    const credited = firstNonEmpty(candidate.attribution);
    const photographer = firstNonEmpty(candidate.attribution_name);
    const attribution =
      credited !== ''
        ? credited
        : `${photographer === '' ? 'Unknown photographer' : photographer} via iNaturalist (${license})`;

    return { url, attribution, license };
  }

  return null;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  times: '×',
  deg: '°',
};

/**
 * Single pass so a decoded `&amp;` cannot be re-decoded into another entity.
 */
function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Plain-text Wikipedia lead paragraph. iNaturalist returns this field as HTML
 * fragments, and it is the text the redactor later censors — leaving tags in
 * would let a `<a title="Turdus migratorius">` leak the answer.
 */
export function wikipediaSummary(t: InatTaxon): string {
  const raw = t.wikipedia_summary;
  if (typeof raw !== 'string' || raw.trim() === '') return '';

  return decodeEntities(raw.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
