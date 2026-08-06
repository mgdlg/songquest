/**
 * GBIF client — range-map tiles and a rough map focus.
 *
 * GBIF is the least essential of the three upstreams: a species without a
 * taxon key still plays perfectly well, it just has no distribution plate.
 * Every function here therefore degrades to `null` rather than throwing.
 * Server-only.
 */

import { cached, fetchJson, TTL } from '../cache';

const SPECIES_BASE = 'https://api.gbif.org/v1/species';
const OCCURRENCE_BASE = 'https://api.gbif.org/v1/occurrence';

const USER_AGENT =
  'SongQuest/1.0 (bird-song identification game; non-commercial; GBIF occurrence density under CC BY)';

/** GBIF caps `limit` at 300 for occurrence search. */
const CENTROID_SAMPLE_SIZE = 300;

/* ------------------------------------------------------------------ */
/* Wire shapes                                                         */
/* ------------------------------------------------------------------ */

export interface GbifSpeciesMatch {
  usageKey?: number;
  acceptedUsageKey?: number;
  speciesKey?: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  status?: string;
  confidence?: number;
  /** "EXACT" | "FUZZY" | "HIGHERRANK" | "NONE". */
  matchType?: string;
  synonym?: boolean;
}

export interface GbifOccurrence {
  key?: number;
  decimalLatitude?: number;
  decimalLongitude?: number;
  country?: string;
  year?: number;
}

export interface GbifOccurrenceSearchResponse {
  offset?: number;
  limit?: number;
  endOfRecords?: boolean;
  count?: number;
  results?: GbifOccurrence[];
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** Rejects so `cached` does not memoise a transient failure for six hours. */
async function getJson<T>(url: string): Promise<T> {
  const outcome = await fetchJson<T>(url, { headers: { 'user-agent': USER_AGENT } });
  if (!outcome.ok) throw new Error(`GBIF ${url}: ${outcome.error}`);
  return outcome.data;
}

function warn(context: string, err: unknown): void {
  console.warn(`[gbif] ${context}: ${err instanceof Error ? err.message : String(err)}`);
}

/* ------------------------------------------------------------------ */
/* Taxon key                                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolves a binomial to a GBIF taxon key via the fuzzy matching service.
 *
 * `class=Aves` narrows the backbone search: several bird binomials collide with
 * insect and plant names, and a moth's range map would be a memorable bug.
 * A `speciesKey` is preferred over the raw `usageKey` so a subspecies match
 * still yields the full species range.
 */
export async function gbifTaxonKey(scientificName: string): Promise<number | null> {
  const name = scientificName.trim();
  if (name === '') return null;

  const params = new URLSearchParams({
    name,
    kingdom: 'Animalia',
    class: 'Aves',
    strict: 'false',
    verbose: 'false',
  });

  return cached(`gbif:match:${name.toLowerCase()}`, TTL.SPECIES, async () => {
    const match = await getJson<GbifSpeciesMatch>(`${SPECIES_BASE}/match?${params.toString()}`);

    const matchType = typeof match.matchType === 'string' ? match.matchType.toUpperCase() : 'NONE';
    if (matchType === 'NONE') return null;

    const key =
      typeof match.speciesKey === 'number'
        ? match.speciesKey
        : typeof match.usageKey === 'number'
          ? match.usageKey
          : null;

    return key !== null && Number.isInteger(key) && key > 0 ? key : null;
  }).catch((err: unknown) => {
    warn(`match "${name}"`, err);
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

/**
 * Leaflet tile template for the occurrence-density overlay. The `{z}/{x}/{y}`
 * placeholders are substituted by Leaflet, not here, so this is a template
 * string rather than a resolved URL.
 */
export function densityTileUrl(taxonKey: number): string {
  const key = Number.isInteger(taxonKey) && taxonKey > 0 ? taxonKey : 0;
  return (
    'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png' +
    `?taxonKey=${key}&bin=hex&hexPerTile=42&style=classic.poly`
  );
}

/* ------------------------------------------------------------------ */
/* Centroid                                                            */
/* ------------------------------------------------------------------ */

function usablePoint(lat: unknown, lng: unknown): [number, number] | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // GBIF's zero-coordinate flag catches most of these, but not all.
  if (lat === 0 && lng === 0) return null;
  return [lat, lng];
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Mean direction on the unit sphere rather than a mean of the raw degrees.
 *
 * Averaging longitudes arithmetically puts a species that winters in Kamchatka
 * and summers in Alaska somewhere in the Atlantic; the vector mean does not.
 */
function sphericalCentroid(points: readonly (readonly [number, number])[]): [number, number] | null {
  if (points.length === 0) return null;

  let x = 0;
  let y = 0;
  let z = 0;

  for (const [lat, lng] of points) {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }

  const n = points.length;
  x /= n;
  y /= n;
  z /= n;

  const horizontal = Math.hypot(x, y);
  // A near-zero resultant means the occurrences are spread symmetrically over
  // the globe; there is no meaningful centre to report.
  if (horizontal < 1e-9 && Math.abs(z) < 1e-9) return null;

  const lat = (Math.atan2(z, horizontal) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [round4(lat), round4(lng)];
}

/**
 * Rough map focus, derived from a bounded sample of georeferenced occurrences.
 *
 * This is a *centre for the camera*, not a statistic: a 300-record sample is
 * biased toward observer density, which for a range map is acceptable — it puts
 * the plate where the bird is actually seen. Returns `null` rather than
 * throwing so a dossier survives a GBIF outage.
 */
export async function occurrenceCentroid(taxonKey: number): Promise<[number, number] | null> {
  if (!Number.isInteger(taxonKey) || taxonKey <= 0) return null;

  const params = new URLSearchParams({
    taxonKey: String(taxonKey),
    hasCoordinate: 'true',
    hasGeospatialIssue: 'false',
    occurrenceStatus: 'PRESENT',
    limit: String(CENTROID_SAMPLE_SIZE),
  });

  return cached(`gbif:centroid:${taxonKey}`, TTL.SPECIES, async () => {
    const body = await getJson<GbifOccurrenceSearchResponse>(
      `${OCCURRENCE_BASE}/search?${params.toString()}`,
    );

    const results: unknown[] = Array.isArray(body.results) ? body.results : [];
    const points: [number, number][] = [];

    for (const record of results) {
      if (typeof record !== 'object' || record === null) continue;
      const { decimalLatitude, decimalLongitude } = record as GbifOccurrence;
      const point = usablePoint(decimalLatitude, decimalLongitude);
      if (point !== null) points.push(point);
    }

    return sphericalCentroid(points);
  }).catch((err: unknown) => {
    warn(`centroid for taxonKey ${taxonKey}`, err);
    return null;
  });
}
