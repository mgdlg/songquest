/**
 * Map configuration for the distribution plate.
 *
 * Two raster sources, both free and both carrying attribution obligations that
 * are rendered in-product (see RangeMap's attribution control):
 *   - CARTO `light_nolabels` over OpenStreetMap data — label-free, so the plate
 *     reads as a printed range map rather than a navigation map.
 *   - GBIF occurrence density — hex-binned OCCURRENCE RECORDS, not a curated
 *     seasonal range polygon. See RANGE_LEGEND below.
 */

/**
 * `{r}` resolves to `@2x` on retina displays; Leaflet fills it from
 * `Browser.retina` regardless of the `detectRetina` option, so the layer keeps
 * a 256px tile grid and simply serves a sharper image where one exists.
 */
export const BASE_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

/**
 * ODbL requires the OpenStreetMap credit; the CARTO credit is a term of their
 * free basemap service. This string is a licence obligation, not decoration —
 * do not shorten it to fit the frame.
 */
export const BASE_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, ' +
  '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

/**
 * Atlantic-centred world view. Species dossiers carry their own `rangeCenter`
 * when iNaturalist knows one; this is the fallback for the ones that don't, and
 * it shows both American flyways plus western Eurasia and Africa.
 *
 * `maxZoom` stops well short of street level: GBIF density bins stop being
 * meaningful long before then, and a range plate has no business showing roads.
 */
export const MAP_DEFAULTS: {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
} = {
  center: [24, -30],
  zoom: 2,
  minZoom: 1,
  maxZoom: 8,
};

/**
 * The four seasonal classes of a printed field-guide range plate, bound to the
 * map palette tokens.
 *
 * HONEST CAVEAT: we do not have per-season data. GBIF density tiles aggregate
 * occurrence *records* across all months, and no free source gives us Cornell's
 * curated breeding/wintering polygons. So this legend documents the palette
 * convention an ornithologist expects to see on a plate — it deliberately does
 * not claim that the rendered overlay is split by season. Do not fabricate
 * seasonal layers to make the legend "true"; fix the data source or leave it.
 */
export const RANGE_LEGEND: readonly { label: string; cssVar: string }[] = [
  { label: 'Resident', cssVar: '--map-resident' },
  { label: 'Breeding', cssVar: '--map-breeding' },
  { label: 'Wintering', cssVar: '--map-wintering' },
  { label: 'Migration', cssVar: '--map-migration' },
];

/**
 * GBIF v2 occurrence-density tile template, ready for `L.tileLayer`.
 *
 * `bin=hex` + `hexPerTile=42` gives a coarse, plate-like stipple instead of
 * pixel confetti; `style=classic.poly` is the warmest of the built-in ramps and
 * so needs the least correction from the CSS filter in RangeMap.module.css.
 *
 * Returns an empty string for a missing or nonsensical key — the dossier's
 * `gbifTaxonKey` is nullable, and an empty URL tells RangeMap to render the
 * base plate alone rather than requesting `taxonKey=null` tiles forever.
 */
export function gbifDensityTileUrl(taxonKey: number): string {
  if (!Number.isFinite(taxonKey)) return '';

  const key = Math.trunc(taxonKey);
  if (key <= 0) return '';

  return (
    'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png' +
    `?taxonKey=${key}&bin=hex&hexPerTile=42&style=classic.poly`
  );
}
