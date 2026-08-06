/**
 * iNATURALIST v1 — wire types.
 *
 * Modelled on the documented `/v1/taxa` response. Almost everything below the
 * top level is optional in practice: iNaturalist omits `ancestors` on some
 * endpoints, omits `wikipedia_summary` for most taxa, and returns `null` for
 * `license_code` on all-rights-reserved photos. Treat every optional field as
 * genuinely absent rather than assuming the shape from one lucky response.
 */

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/**
 * `license_code` is lowercase and hyphenated ("cc0", "cc-by", "cc-by-nc-sa"),
 * or `null` for "(c) all rights reserved" — which Song Quest must not display.
 */
export interface InatPhoto {
  id: number;
  license_code: string | null;
  /** Pre-composed credit line, e.g. "(c) Jane Doe, some rights reserved (CC BY)". */
  attribution: string;
  /** Usually the square thumbnail; other sizes are derived by URL rewriting. */
  url: string;
  square_url?: string;
  small_url?: string;
  medium_url?: string;
  large_url?: string;
  original_url?: string;
  original_dimensions?: { height: number; width: number };
  flags?: unknown[];
  attribution_name?: string;
}

export interface InatTaxonPhoto {
  taxon_id: number;
  photo: InatPhoto;
}

/* ------------------------------------------------------------------ */
/* Conservation                                                        */
/* ------------------------------------------------------------------ */

export interface InatConservationStatus {
  /** IUCN-style code, e.g. "LC", "NT", "EN". */
  status: string;
  /** Spelled-out form, e.g. "least concern". Absent on some authorities. */
  status_name?: string;
  authority?: string;
  iucn?: number;
  geoprivacy?: string | null;
  place_id?: number | null;
}

/* ------------------------------------------------------------------ */
/* Taxa                                                                */
/* ------------------------------------------------------------------ */

export interface InatTaxon {
  id: number;
  /** "species", "genus", "family", "order", "class", … — always lowercase. */
  rank: string;
  /** Numeric depth; 10 = species, 20 = genus, 30 = family, 40 = order. */
  rank_level?: number;
  /** Scientific name. For a species this is the full binomial. */
  name: string;
  preferred_common_name?: string;
  english_common_name?: string;
  iconic_taxon_name?: string;
  iconic_taxon_id?: number;
  is_active: boolean;
  /** Always present; ordered root → parent. */
  ancestor_ids?: number[];
  /** Present on `/taxa/{id}` and most search responses, but not guaranteed. */
  ancestors?: InatTaxon[];
  children?: InatTaxon[];
  default_photo?: InatPhoto | null;
  taxon_photos?: InatTaxonPhoto[];
  wikipedia_url?: string | null;
  /** HTML, not plain text — contains `<p>`, `<a>`, and entity references. */
  wikipedia_summary?: string | null;
  conservation_status?: InatConservationStatus | null;
  observations_count?: number;
  extinct?: boolean;
  /** Only present on `q=` searches: the string that produced the hit. */
  matched_term?: string;
  taxon_schemes_count?: number;
  complete_species_count?: number | null;
}

export interface InatPagedResponse<T> {
  total_results: number;
  page: number;
  per_page: number;
  results: T[];
}

export type InatTaxaResponse = InatPagedResponse<InatTaxon>;

/* ------------------------------------------------------------------ */
/* Licensing                                                           */
/* ------------------------------------------------------------------ */

/**
 * Photo licences Song Quest may render, mapped to their display label.
 *
 * NC and ND are excluded: the species card is shareable and the product sits
 * inside a game, so neither term can be honoured. A `null` `license_code`
 * means all rights reserved and is rejected outright.
 *
 * iNaturalist does not report a licence *version*, so no version is asserted.
 */
export const INAT_DISPLAYABLE_PHOTO_LICENSES: Readonly<Record<string, string>> = {
  cc0: 'CC0',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
};

export function isDisplayablePhotoLicense(code: string | null | undefined): boolean {
  if (typeof code !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(
    INAT_DISPLAYABLE_PHOTO_LICENSES,
    code.trim().toLowerCase(),
  );
}

export function photoLicenseLabel(code: string | null | undefined): string {
  if (typeof code !== 'string') return '';
  return INAT_DISPLAYABLE_PHOTO_LICENSES[code.trim().toLowerCase()] ?? '';
}
