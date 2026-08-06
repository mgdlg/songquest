/**
 * Where you are birding.
 *
 * Three levels, and not the same depth on both continents — because the game's
 * data is not the same depth on both continents. North America drills to
 * country and then to the four US census regions; Europe drills once, to the
 * cultural regions used by the German Ständiger Ausschuss für geographische
 * Namen (StAGN): Nord-, West-, Mittel-, Ost-, Südost-, Süd- and Südwesteuropa.
 *
 * The polygons here are deliberately schematic. They are selection zones drawn
 * over a real basemap, not a claim about borders — a coastline accurate enough
 * to argue with would be a megabyte of GeoJSON and would still be wrong at the
 * edges. Each is a handful of points that makes the region unmistakable.
 */

export type RegionId =
  | 'north-america'
  | 'na-canada'
  | 'na-usa'
  | 'na-mexico'
  | 'us-west'
  | 'us-midwest'
  | 'us-south'
  | 'us-northeast'
  | 'europe'
  | 'eu-north'
  | 'eu-west'
  | 'eu-central'
  | 'eu-east'
  | 'eu-southeast'
  | 'eu-south'
  | 'eu-southwest'

/** Continent bucket used to split the species pool. */
export type Continent = 'na' | 'eu'

export interface Region {
  id: RegionId
  label: string
  /** One short line. Never a paragraph — this sits under a map, not in a guide. */
  blurb: string
  parent: RegionId | null
  continent: Continent
  /** 0 continent, 1 country / cultural region, 2 US census region. */
  level: 0 | 1 | 2
  /** CSS custom property carrying this region's pastel fill. */
  tone: string
  /** Outline ring as [lat, lng] pairs. Schematic; see the note above. */
  shape: readonly (readonly [number, number])[]
  /** `[[south, west], [north, east]]` for framing the map on this region. */
  bounds: readonly [readonly [number, number], readonly [number, number]]
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

const CANADA: readonly (readonly [number, number])[] = [
  [70, -141], [70, -122], [69, -100], [68, -82], [63, -64], [58, -62],
  [52, -55], [47, -52], [45, -61], [45, -67], [45, -74], [42, -79],
  [42, -83], [46, -84], [48, -89], [49, -95], [49, -123], [54, -130], [60, -141],
]

const USA_LOWER: readonly (readonly [number, number])[] = [
  [49, -124], [49, -95], [49, -87], [46, -84], [42, -83], [42, -79],
  [45, -74], [45, -67], [41, -70], [35, -75], [30, -81], [25, -80],
  [26, -97], [29, -101], [31, -106], [32, -114], [33, -118], [40, -124],
]

const MEXICO: readonly (readonly [number, number])[] = [
  [32, -117], [31, -106], [29, -101], [26, -97], [21, -97], [18, -94],
  [18, -88], [21, -87], [17, -89], [15, -92], [16, -96], [20, -105],
  [23, -110], [27, -114], [32, -117],
]

const US_WEST: readonly (readonly [number, number])[] = [
  [49, -124], [49, -104], [37, -102], [31, -103], [31, -108], [31, -114],
  [33, -118], [40, -124],
]

const US_MIDWEST: readonly (readonly [number, number])[] = [
  [49, -104], [49, -95], [48, -89], [46, -84], [42, -83], [39, -80],
  [37, -89], [36, -94], [37, -102],
]

const US_SOUTH: readonly (readonly [number, number])[] = [
  [37, -102], [36, -94], [37, -89], [39, -80], [39, -75], [35, -75],
  [30, -81], [25, -80], [26, -97], [29, -101], [31, -103],
]

const US_NORTHEAST: readonly (readonly [number, number])[] = [
  [45, -80], [47, -68], [45, -67], [41, -70], [39, -74], [39, -80], [42, -80],
]

const EU_NORTH: readonly (readonly [number, number])[] = [
  [71, -25], [71, 31], [60, 31], [57, 28], [54, 21], [55, 10],
  [58, 5], [62, 4], [65, -15], [66, -25],
]

const EU_WEST: readonly (readonly [number, number])[] = [
  [59, -11], [59, 6], [51, 7], [49, 8], [47, 8], [43, 7], [43, -2],
  [48, -5], [51, -6], [55, -11],
]

const EU_CENTRAL: readonly (readonly [number, number])[] = [
  [55, 8], [55, 24], [49, 24], [46, 23], [45, 19], [46, 13],
  [47, 9], [51, 7],
]

const EU_EAST: readonly (readonly [number, number])[] = [
  [60, 24], [60, 45], [50, 47], [45, 40], [45, 29], [48, 24], [55, 24],
]

const EU_SOUTHEAST: readonly (readonly [number, number])[] = [
  [48, 22], [48, 29], [45, 29], [44, 29], [41, 29], [35, 26],
  [36, 20], [40, 19], [43, 13], [46, 13], [46, 19],
]

const EU_SOUTH: readonly (readonly [number, number])[] = [
  [47, 7], [47, 13], [43, 13], [40, 18], [37, 16], [36, 15],
  [38, 8], [41, 9], [44, 7],
]

const EU_SOUTHWEST: readonly (readonly [number, number])[] = [
  [44, -10], [44, 3], [42, 3], [39, 0], [37, -2], [36, -6],
  [37, -9], [42, -9],
]

/* ------------------------------------------------------------------ */
/* The tree                                                            */
/* ------------------------------------------------------------------ */

function boundsOf(
  shape: readonly (readonly [number, number])[],
  pad = 2,
): readonly [readonly [number, number], readonly [number, number]] {
  const lats = shape.map((p) => p[0])
  const lngs = shape.map((p) => p[1])
  return [
    [Math.max(-85, Math.min(...lats) - pad), Math.max(-180, Math.min(...lngs) - pad)],
    [Math.min(85, Math.max(...lats) + pad), Math.min(180, Math.max(...lngs) + pad)],
  ]
}

const ENTRIES: readonly Omit<Region, 'bounds'>[] = [
  {
    id: 'north-america',
    label: 'North America',
    blurb: 'Canada, the United States and Mexico',
    parent: null,
    continent: 'na',
    level: 0,
    tone: '--region-a',
    shape: [...CANADA, ...USA_LOWER.slice(10), ...MEXICO.slice(3)],
  },
  {
    id: 'europe',
    label: 'Europe',
    blurb: 'Iceland to the Urals',
    parent: null,
    continent: 'eu',
    level: 0,
    tone: '--region-b',
    shape: [
      [71, -25], [71, 45], [55, 47], [45, 42], [35, 27], [35, 14],
      [36, -6], [43, -10], [51, -11], [60, -15], [66, -25],
    ],
  },

  { id: 'na-canada', label: 'Canada', blurb: 'Boreal forest, tundra and the Maritimes', parent: 'north-america', continent: 'na', level: 1, tone: '--region-a', shape: CANADA },
  { id: 'na-usa', label: 'United States', blurb: 'The lower forty-eight', parent: 'north-america', continent: 'na', level: 1, tone: '--region-b', shape: USA_LOWER },
  { id: 'na-mexico', label: 'Mexico', blurb: 'Sierra Madre, Yucatán and the dry north', parent: 'north-america', continent: 'na', level: 1, tone: '--region-c', shape: MEXICO },

  { id: 'us-west', label: 'West', blurb: 'Pacific coast, Rockies and the desert southwest', parent: 'na-usa', continent: 'na', level: 2, tone: '--region-a', shape: US_WEST },
  { id: 'us-midwest', label: 'Midwest', blurb: 'Prairie, Great Lakes and the northern woods', parent: 'na-usa', continent: 'na', level: 2, tone: '--region-b', shape: US_MIDWEST },
  { id: 'us-south', label: 'South', blurb: 'Gulf coast, Appalachians and the Texas brush', parent: 'na-usa', continent: 'na', level: 2, tone: '--region-c', shape: US_SOUTH },
  { id: 'us-northeast', label: 'Northeast', blurb: 'New England and the mid-Atlantic', parent: 'na-usa', continent: 'na', level: 2, tone: '--region-d', shape: US_NORTHEAST },

  { id: 'eu-north', label: 'Northern Europe', blurb: 'Fennoscandia, the Baltics and Iceland', parent: 'europe', continent: 'eu', level: 1, tone: '--region-a', shape: EU_NORTH },
  { id: 'eu-west', label: 'Western Europe', blurb: 'Britain, Ireland, France and the Low Countries', parent: 'europe', continent: 'eu', level: 1, tone: '--region-b', shape: EU_WEST },
  { id: 'eu-central', label: 'Central Europe', blurb: 'Germany, Poland, the Alps and the Carpathian basin', parent: 'europe', continent: 'eu', level: 1, tone: '--region-c', shape: EU_CENTRAL },
  { id: 'eu-east', label: 'Eastern Europe', blurb: 'Belarus, Ukraine and European Russia', parent: 'europe', continent: 'eu', level: 1, tone: '--region-d', shape: EU_EAST },
  { id: 'eu-southeast', label: 'South-eastern Europe', blurb: 'The Balkans and Greece', parent: 'europe', continent: 'eu', level: 1, tone: '--region-e', shape: EU_SOUTHEAST },
  { id: 'eu-south', label: 'Southern Europe', blurb: 'Italy and the central Mediterranean', parent: 'europe', continent: 'eu', level: 1, tone: '--region-f', shape: EU_SOUTH },
  { id: 'eu-southwest', label: 'South-western Europe', blurb: 'Iberia', parent: 'europe', continent: 'eu', level: 1, tone: '--region-g', shape: EU_SOUTHWEST },
]

export const REGIONS: Readonly<Record<RegionId, Region>> = Object.freeze(
  Object.fromEntries(
    ENTRIES.map((entry) => [entry.id, { ...entry, bounds: boundsOf(entry.shape) }]),
  ) as Record<RegionId, Region>,
)

export const ROOT_REGIONS: readonly RegionId[] = ['north-america', 'europe']

export function isRegionId(value: string): value is RegionId {
  return Object.prototype.hasOwnProperty.call(REGIONS, value)
}

export function getRegion(id: string): Region | null {
  return isRegionId(id) ? REGIONS[id] : null
}

/** Direct children, in the order they should be offered. */
export function childrenOf(id: RegionId): Region[] {
  return Object.values(REGIONS).filter((r) => r.parent === id)
}

/** The region and every ancestor, root first. */
export function lineageOf(id: RegionId): Region[] {
  const chain: Region[] = []
  let current: Region | undefined = REGIONS[id]
  while (current) {
    chain.unshift(current)
    current = current.parent ? REGIONS[current.parent] : undefined
  }
  return chain
}

/** Every descendant id, including the region itself. */
export function subtreeOf(id: RegionId): RegionId[] {
  const out: RegionId[] = [id]
  for (const child of childrenOf(id)) out.push(...subtreeOf(child.id))
  return out
}

/**
 * True when `candidate` is `ancestor` or sits beneath it. Used to decide
 * whether a species tagged to one region should appear in another.
 */
export function isWithin(candidate: RegionId, ancestor: RegionId): boolean {
  let current: Region | undefined = REGIONS[candidate]
  while (current) {
    if (current.id === ancestor) return true
    current = current.parent ? REGIONS[current.parent] : undefined
  }
  return false
}

export const DEFAULT_REGION: RegionId = 'north-america'
