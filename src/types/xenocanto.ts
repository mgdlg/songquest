/**
 * XENO-CANTO — wire types, parsers, and the normalised recording record.
 *
 * Two layers live here on purpose:
 *
 *   `XcRawRecording` / `XcRawResponse` document the payload exactly as
 *   xeno-canto.org sends it — including the hyphenated `file-name` key, the
 *   `"m:ss"` string duration, the protocol-relative licence URL, and the
 *   counts that arrive as strings.
 *
 *   `XcRecording` is what the rest of Song Quest consumes: absolute URLs,
 *   numeric duration, a parsed licence, and a pre-built proxy URL.
 *
 * Nothing downstream should ever touch the raw shape.
 */

/* ------------------------------------------------------------------ */
/* Wire shape                                                          */
/* ------------------------------------------------------------------ */

export interface XcSonogramUrls {
  small: string;
  med: string;
  large: string;
  full: string;
}

export interface XcOscillogramUrls {
  small: string;
  med: string;
  large: string;
}

/** One recording exactly as the API returns it. Every value arrives as text. */
export interface XcRawRecording {
  /** Catalogue number without the "XC" prefix, e.g. "512345". */
  id: string;
  /** Genus. */
  gen: string;
  /** Specific epithet. */
  sp: string;
  /** Subspecific epithet; empty string when unknown. */
  ssp: string;
  /** English common name. */
  en: string;
  /** Recordist, as they wish to be credited. */
  rec: string;
  /** Country. */
  cnt: string;
  /** Locality free text. */
  loc: string;
  /** Decimal degrees as a string, or null when the recordist withheld them. */
  lat: string | null;
  lng: string | null;
  /** Comma-separated vocalisation types, e.g. "song, alarm call". */
  type: string;
  sex: string;
  stage: string;
  /** Audio URL — commonly protocol-relative ("//xeno-canto.org/512345/download"). */
  file: string;
  /** Hyphenated key; not a valid identifier, so it must be quoted. */
  'file-name': string;
  sono: XcSonogramUrls;
  osci?: XcOscillogramUrls;
  /** Other species audible in the background. */
  also: string[];
  /** Protocol-relative licence deed, e.g. "//creativecommons.org/licenses/by/4.0/". */
  lic: string;
  /** Quality grade "A"–"E", or "no score". */
  q: string;
  /** Duration as "m:ss" (occasionally "h:mm:ss"). Never a number. */
  length: string;
  /** Local time of day, "HH:mm" or "?". */
  time: string;
  /** Recording date, "YYYY-MM-DD" (day or month may be "00"). */
  date: string;
  /** Human-facing page for this recording. */
  url: string;
  /** Recordist's remarks. */
  rmk: string;
  /** Taxonomic group: "birds", "grasshoppers", "bats". v2.6+ only. */
  grp?: string;
  /** Uploaded timestamp; present on v3. */
  uploaded?: string;
  /** Recording device / microphone; present on recent versions. */
  dvc?: string;
  mic?: string;
  /** Sampling rate and bitrate; present on recent versions. */
  smp?: string;
  bitrate?: string;
}

/**
 * The v3 (and v2) envelope. `numRecordings` and `numSpecies` are strings —
 * they are rendered counts, not numbers — while `page` and `numPages` are not.
 */
export interface XcRawResponse {
  numRecordings: string;
  numSpecies: string;
  page: number;
  numPages: number;
  recordings: XcRawRecording[];
}

/* ------------------------------------------------------------------ */
/* Licence                                                             */
/* ------------------------------------------------------------------ */

export type XcLicenseCode =
  | 'cc0'
  | 'by'
  | 'by-sa'
  | 'by-nd'
  | 'by-nc'
  | 'by-nc-sa'
  | 'by-nc-nd'
  | 'unknown';

export interface XcLicense {
  code: XcLicenseCode;
  /** Display form for the attribution line, e.g. "CC BY 4.0". */
  label: string;
  /** Absolute https URL of the deed; empty string when unparseable. */
  url: string;
  /** Version segment when the deed carries one, e.g. "4.0". */
  version: string | null;
  /**
   * True for every licence Song Quest is allowed to play: CC0 and any CC BY
   * variant **except** those carrying NoDerivatives.
   *
   * The original spec asked for unqualified CC BY only, on the theory that it
   * left commercial use open. Measured against the live catalogue that policy
   * is unusable: of ~25,000 song recordings surveyed across twelve species,
   * 25 were plain CC BY and none of those were North American. Xeno-canto is
   * overwhelmingly BY-NC-SA. Song Quest is therefore a non-commercial project.
   *
   * ND is the one exclusion that remains. Playing a recording whole is not a
   * derivative, but a guessing game plausibly wants to trim or excerpt clips
   * later, and NoDerivatives forecloses that — so those recordings are refused
   * up front rather than becoming a trap for a future feature.
   */
  permissive: boolean;
}

/** Every licence code Song Quest is allowed to play. Anything with `nd` is out. */
export const XC_PERMISSIVE_LICENSES: readonly XcLicenseCode[] = [
  'cc0',
  'by',
  'by-sa',
  'by-nc',
  'by-nc-sa',
];

const KNOWN_LICENSE_CODES: readonly string[] = [
  'by',
  'by-sa',
  'by-nd',
  'by-nc',
  'by-nc-sa',
  'by-nc-nd',
];

/** Route through our own handler so the browser never hits xeno-canto directly. */
export const XC_AUDIO_PROXY_PATH = '/api/audio';

/* ------------------------------------------------------------------ */
/* Normalised record                                                   */
/* ------------------------------------------------------------------ */

export interface XcRecording {
  /** Catalogue number without a prefix, e.g. "512345". */
  id: string;
  /** Catalogue number with the prefix, e.g. "XC512345" — the citable form. */
  catalogueId: string;
  genus: string;
  species: string;
  subspecies: string | null;
  /** "Genus species" as reported by the catalogue. */
  scientificName: string;
  commonName: string;
  recordist: string;
  country: string | null;
  locality: string | null;
  /** [lat, lng]; null when the recordist withheld or the values were unparseable. */
  coordinates: [number, number] | null;
  /** Free-text vocalisation types, e.g. "song, call". */
  type: string;
  sex: string | null;
  stage: string | null;
  /** Absolute https URL of the audio on xeno-canto. */
  fileUrl: string;
  /** `fileUrl` routed through `/api/audio`; this is what a client should play. */
  proxyUrl: string;
  fileName: string | null;
  /** Largest sonogram offered, absolute; null when the catalogue has none. */
  sonogramUrl: string | null;
  /** Other species audible in the background. */
  alsoHeard: string[];
  license: XcLicense;
  /** "A" (best) through "E"; null when ungraded. */
  quality: string | null;
  /** Parsed from the `"m:ss"` string; 0 when unparseable. */
  durationSeconds: number;
  /** "YYYY-MM-DD" as recorded; null when absent. */
  recordedAt: string | null;
  /** Local time "HH:mm"; null when the recordist wrote "?" or left it blank. */
  recordedTime: string | null;
  /** Human-facing catalogue page — the attribution link. */
  pageUrl: string;
  remarks: string | null;
}

export interface XcRecordingsPage {
  numRecordings: number;
  numSpecies: number;
  page: number;
  numPages: number;
  recordings: XcRecording[];
}

/* ------------------------------------------------------------------ */
/* Primitive coercion                                                  */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Empty string collapses to null so consumers can use `??` rather than `|| ''`. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

function numberOrNull(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOr(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Xeno-canto hands out protocol-relative and occasionally root-relative URLs.
 * Everything downstream (fetch on the server, `<audio src>` in the browser)
 * needs an absolute one.
 */
export function absoluteXcUrl(raw: string): string {
  const value = raw.trim();
  if (value === '') return '';
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('http://')) return `https://${value.slice('http://'.length)}`;
  if (value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `https://xeno-canto.org${value}`;
  return `https://${value}`;
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parses the `length` field, which is a string clock reading — "0:42",
 * "1:07", and for the rare long cut "1:02:30". Returns whole seconds, or 0
 * when the value cannot be read at all.
 */
export function parseXcDuration(length: string | null | undefined): number {
  if (typeof length !== 'string') return 0;
  const value = length.trim();
  if (value === '') return 0;

  // A bare number of seconds is not documented but does appear in old records.
  if (/^\d+$/.test(value)) {
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  }

  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) return 0;

  let total = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!/^\d+$/.test(trimmed)) return 0;
    total = total * 60 + Number.parseInt(trimmed, 10);
  }
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

/**
 * Parses the Creative Commons deed URL. The v3 API returns it absolute —
 * "https://creativecommons.org/licenses/by-nc-sa/4.0/" — while older responses
 * used the protocol-relative "//creativecommons.org/..." form;
 * `absoluteXcUrl` normalises both.
 */
export function parseXcLicense(lic: string | null | undefined): XcLicense {
  const url = typeof lic === 'string' ? absoluteXcUrl(lic) : '';
  if (url === '') {
    return { code: 'unknown', label: 'Licence unknown', url: '', version: null, permissive: false };
  }

  const path = url.toLowerCase();

  const zero = /publicdomain\/(?:zero|mark)\/(\d+(?:\.\d+)?)/.exec(path);
  if (zero !== null || path.includes('/publicdomain/')) {
    const version = zero?.[1] ?? null;
    return {
      code: 'cc0',
      label: version === null ? 'CC0' : `CC0 ${version}`,
      url,
      version,
      permissive: true,
    };
  }

  const match = /licenses\/([a-z-]+)(?:\/(\d+(?:\.\d+)?))?/.exec(path);
  const rawCode = match?.[1] ?? '';
  const version = match?.[2] ?? null;

  if (!KNOWN_LICENSE_CODES.includes(rawCode)) {
    return { code: 'unknown', label: 'Licence unknown', url, version, permissive: false };
  }

  const code = rawCode as XcLicenseCode;
  const label = `CC ${rawCode.toUpperCase()}${version === null ? '' : ` ${version}`}`;
  return {
    code,
    label,
    url,
    version,
    permissive: XC_PERMISSIVE_LICENSES.includes(code),
  };
}

export function isPermissiveXcLicense(license: XcLicense): boolean {
  return XC_PERMISSIVE_LICENSES.includes(license.code);
}

/** Builds the `/api/audio` URL for an upstream xeno-canto file. */
export function proxiedAudioUrl(fileUrl: string): string {
  const absolute = absoluteXcUrl(fileUrl);
  if (absolute === '') return '';
  return `${XC_AUDIO_PROXY_PATH}?src=${encodeURIComponent(absolute)}`;
}

function parseQuality(raw: string): string | null {
  const grade = raw.trim().toUpperCase();
  return /^[A-E]$/.test(grade) ? grade : null;
}

function parseCoordinates(
  source: Record<string, unknown>,
): [number, number] | null {
  const lat = numberOrNull(text(source, 'lat'));
  const lng = numberOrNull(text(source, 'lng'));
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function pickSonogram(source: Record<string, unknown>): string | null {
  const sono = asRecord(source['sono']);
  if (sono === null) return null;
  for (const size of ['large', 'full', 'med', 'small']) {
    const url = absoluteXcUrl(text(sono, size));
    if (url !== '') return url;
  }
  return null;
}

/**
 * Normalises one wire record. Returns null when the record has no catalogue id
 * or no playable file — either makes it useless to the game.
 */
export function parseXcRecording(raw: unknown): XcRecording | null {
  const source = asRecord(raw);
  if (source === null) return null;

  const id = text(source, 'id');
  const fileUrl = absoluteXcUrl(text(source, 'file'));
  if (id === '' || fileUrl === '') return null;

  const genus = text(source, 'gen');
  const species = text(source, 'sp');
  const alsoRaw = source['also'];
  const recordedTime = text(source, 'time');
  const pageUrl = absoluteXcUrl(text(source, 'url'));

  return {
    id,
    catalogueId: id.toUpperCase().startsWith('XC') ? id.toUpperCase() : `XC${id}`,
    genus,
    species,
    subspecies: orNull(text(source, 'ssp')),
    scientificName: [genus, species].filter((part) => part !== '').join(' '),
    commonName: text(source, 'en'),
    recordist: text(source, 'rec'),
    country: orNull(text(source, 'cnt')),
    locality: orNull(text(source, 'loc')),
    coordinates: parseCoordinates(source),
    type: text(source, 'type'),
    sex: orNull(text(source, 'sex')),
    stage: orNull(text(source, 'stage')),
    fileUrl,
    proxyUrl: proxiedAudioUrl(fileUrl),
    fileName: orNull(text(source, 'file-name')),
    sonogramUrl: pickSonogram(source),
    alsoHeard: Array.isArray(alsoRaw)
      ? alsoRaw.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
      : [],
    license: parseXcLicense(text(source, 'lic')),
    quality: parseQuality(text(source, 'q')),
    durationSeconds: parseXcDuration(text(source, 'length')),
    recordedAt: orNull(text(source, 'date')),
    // The catalogue writes "?" when the recordist did not note the time.
    recordedTime: recordedTime === '?' ? null : orNull(recordedTime),
    pageUrl: pageUrl === '' ? `https://xeno-canto.org/${id}` : pageUrl,
    remarks: orNull(text(source, 'rmk')),
  };
}

/**
 * Normalises a whole page. Takes `unknown` because the value comes straight off
 * the wire: a rate-limit page or an error envelope is a perfectly ordinary
 * response here, and must degrade to an empty page rather than throw.
 */
export function parseXcResponse(raw: unknown): XcRecordingsPage {
  const empty: XcRecordingsPage = {
    numRecordings: 0,
    numSpecies: 0,
    page: 1,
    numPages: 1,
    recordings: [],
  };

  const source = asRecord(raw);
  if (source === null) return empty;

  const list = source['recordings'];
  const recordings: XcRecording[] = Array.isArray(list)
    ? list
        .map(parseXcRecording)
        .filter((record): record is XcRecording => record !== null)
    : [];

  return {
    numRecordings: intOr(text(source, 'numRecordings'), recordings.length),
    numSpecies: intOr(text(source, 'numSpecies'), 0),
    page: intOr(text(source, 'page'), 1),
    numPages: intOr(text(source, 'numPages'), 1),
    recordings,
  };
}
