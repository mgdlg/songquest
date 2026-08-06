/**
 * CURATED POOL — the standard game's species list.
 *
 * Scope: common, widespread North American breeders with vocalisations a
 * competent birder can name by ear. Taxonomy follows current AOS/IOC placement
 * (Setophaga, not Dendroica; Spinus tristis; Dryobates pubescens; Corthylio
 * calendula; Antrostomus vociferus).
 *
 * There is no difficulty column. It used to seed the puzzle's Elo, and it was
 * one person's opinion frozen at authoring time; that job now belongs to
 * iNaturalist observation rank, which is real data, varies by region, and keeps
 * itself current. See `puzzleEloFor` in `master-list.ts`.
 *
 * `id` is derived from the binomial rather than written by hand — a hand-typed
 * slug is the one field that can silently disagree with the name it identifies.
 * `inatTaxonId` is deliberately absent from every entry: a wrong taxon id
 * fetches a different bird's photograph and range map, which is far worse than
 * null. The species service resolves by scientific name when it is null.
 */

import type { Continent, RegionId } from '@/lib/regions';

export interface SpeciesSeed {
  id: string; // stable slug, e.g. "tyrannus-forficatus"
  commonName: string;
  scientificName: string;
  family: string;
  order: string;
  /** iNaturalist taxon id when known, else null — the service resolves by name. */
  inatTaxonId: number | null;
  /** Which continental pool the species belongs to. */
  continent: Continent;
  /**
   * Sub-regions the species is genuinely restricted to, or `null` for a bird
   * that turns up throughout its continent.
   *
   * Tagging restrictions rather than presence is deliberate. Most of these
   * species are widespread — a Song Sparrow is in every US region — so listing
   * every region for every bird would be hundreds of entries that all say the
   * same thing, and one omission would silently delete a common bird from a
   * region's pool. Listing only the exceptions means the default is "available"
   * and the data stays small enough to keep honest.
   */
  restrictedTo: readonly RegionId[] | null;
}

/** A seed as authored: ids are derived and the optional fields default. */
export type SeedInput = Omit<
  SpeciesSeed,
  'id' | 'inatTaxonId' | 'continent' | 'restrictedTo'
> & {
  inatTaxonId?: number | null;
  continent?: Continent;
  restrictedTo?: readonly RegionId[];
};

/** "Tyrannus forficatus" -> "tyrannus-forficatus". */
export function slugifyBinomial(scientificName: string): string {
  // NFD splits any accented letter into base + combining mark; the
  // non-alphanumeric pass then discards the mark rather than transliterating it.
  return scientificName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toSpeciesSeed(input: SeedInput): SpeciesSeed {
  return {
    id: slugifyBinomial(input.scientificName),
    commonName: input.commonName,
    scientificName: input.scientificName,
    family: input.family,
    order: input.order,
    inatTaxonId: input.inatTaxonId ?? null,
    // North America is the default because this file is a North American list;
    // the European additions in master-list.ts set it explicitly.
    continent: input.continent ?? 'na',
    restrictedTo: input.restrictedTo ?? null,
  };
}

/** Drops later entries that repeat an id, preserving first-seen order. */
export function dedupeById(seeds: readonly SpeciesSeed[]): SpeciesSeed[] {
  const seen = new Set<string>();
  const out: SpeciesSeed[] = [];
  for (const seed of seeds) {
    if (seen.has(seed.id)) continue;
    seen.add(seed.id);
    out.push(seed);
  }
  return out;
}

const CURATED_SEEDS: readonly SeedInput[] = [
  /* ---------------------------------------------------------------- */
  /* ANSERIFORMES — ducks, geese, swans                                */
  /* ---------------------------------------------------------------- */
  { commonName: 'Canada Goose', scientificName: 'Branta canadensis', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Snow Goose', scientificName: 'Anser caerulescens', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Trumpeter Swan', scientificName: 'Cygnus buccinator', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Tundra Swan', scientificName: 'Cygnus columbianus', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Wood Duck', scientificName: 'Aix sponsa', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Mallard', scientificName: 'Anas platyrhynchos', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'American Wigeon', scientificName: 'Mareca americana', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Northern Pintail', scientificName: 'Anas acuta', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Green-winged Teal', scientificName: 'Anas crecca', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Blue-winged Teal', scientificName: 'Spatula discors', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Hooded Merganser', scientificName: 'Lophodytes cucullatus', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Long-tailed Duck', scientificName: 'Clangula hyemalis', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Ruddy Duck', scientificName: 'Oxyura jamaicensis', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Common Goldeneye', scientificName: 'Bucephala clangula', family: 'Anatidae', order: 'Anseriformes' },

  /* ---------------------------------------------------------------- */
  /* GALLIFORMES — grouse, quail, turkey                               */
  /* ---------------------------------------------------------------- */
  { commonName: 'Wild Turkey', scientificName: 'Meleagris gallopavo', family: 'Phasianidae', order: 'Galliformes' },
  { commonName: 'Ruffed Grouse', scientificName: 'Bonasa umbellus', family: 'Phasianidae', order: 'Galliformes', restrictedTo: ['na-canada', 'us-west', 'us-midwest', 'us-northeast'] },
  { commonName: 'Greater Prairie-Chicken', scientificName: 'Tympanuchus cupido', family: 'Phasianidae', order: 'Galliformes', restrictedTo: ['us-midwest'] },
  { commonName: 'Greater Sage-Grouse', scientificName: 'Centrocercus urophasianus', family: 'Phasianidae', order: 'Galliformes', restrictedTo: ['us-west'] },
  { commonName: 'Northern Bobwhite', scientificName: 'Colinus virginianus', family: 'Odontophoridae', order: 'Galliformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'California Quail', scientificName: 'Callipepla californica', family: 'Odontophoridae', order: 'Galliformes', restrictedTo: ['us-west'] },
  { commonName: "Gambel's Quail", scientificName: 'Callipepla gambelii', family: 'Odontophoridae', order: 'Galliformes', restrictedTo: ['us-west'] },
  { commonName: 'Ring-necked Pheasant', scientificName: 'Phasianus colchicus', family: 'Phasianidae', order: 'Galliformes' },

  /* ---------------------------------------------------------------- */
  /* PODICIPEDIFORMES — grebes                                         */
  /* ---------------------------------------------------------------- */
  { commonName: 'Pied-billed Grebe', scientificName: 'Podilymbus podiceps', family: 'Podicipedidae', order: 'Podicipediformes' },
  { commonName: 'Western Grebe', scientificName: 'Aechmophorus occidentalis', family: 'Podicipedidae', order: 'Podicipediformes', restrictedTo: ['us-west'] },

  /* ---------------------------------------------------------------- */
  /* COLUMBIFORMES — pigeons and doves                                 */
  /* ---------------------------------------------------------------- */
  { commonName: 'Rock Pigeon', scientificName: 'Columba livia', family: 'Columbidae', order: 'Columbiformes' },
  { commonName: 'Band-tailed Pigeon', scientificName: 'Patagioenas fasciata', family: 'Columbidae', order: 'Columbiformes', restrictedTo: ['us-west'] },
  { commonName: 'Eurasian Collared-Dove', scientificName: 'Streptopelia decaocto', family: 'Columbidae', order: 'Columbiformes' },
  { commonName: 'Mourning Dove', scientificName: 'Zenaida macroura', family: 'Columbidae', order: 'Columbiformes' },
  { commonName: 'White-winged Dove', scientificName: 'Zenaida asiatica', family: 'Columbidae', order: 'Columbiformes' },
  { commonName: 'Inca Dove', scientificName: 'Columbina inca', family: 'Columbidae', order: 'Columbiformes' },

  /* ---------------------------------------------------------------- */
  /* CUCULIFORMES — cuckoos and roadrunners                            */
  /* ---------------------------------------------------------------- */
  { commonName: 'Yellow-billed Cuckoo', scientificName: 'Coccyzus americanus', family: 'Cuculidae', order: 'Cuculiformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Black-billed Cuckoo', scientificName: 'Coccyzus erythropthalmus', family: 'Cuculidae', order: 'Cuculiformes' },
  { commonName: 'Greater Roadrunner', scientificName: 'Geococcyx californianus', family: 'Cuculidae', order: 'Cuculiformes', restrictedTo: ['us-west', 'us-south'] },

  /* ---------------------------------------------------------------- */
  /* CAPRIMULGIFORMES — nightjars                                      */
  /* ---------------------------------------------------------------- */
  { commonName: 'Common Nighthawk', scientificName: 'Chordeiles minor', family: 'Caprimulgidae', order: 'Caprimulgiformes' },
  { commonName: 'Common Poorwill', scientificName: 'Phalaenoptilus nuttallii', family: 'Caprimulgidae', order: 'Caprimulgiformes' },
  { commonName: 'Eastern Whip-poor-will', scientificName: 'Antrostomus vociferus', family: 'Caprimulgidae', order: 'Caprimulgiformes' },
  { commonName: "Chuck-will's-widow", scientificName: 'Antrostomus carolinensis', family: 'Caprimulgidae', order: 'Caprimulgiformes', restrictedTo: ['us-south'] },

  /* ---------------------------------------------------------------- */
  /* APODIFORMES — swifts and hummingbirds                             */
  /* ---------------------------------------------------------------- */
  { commonName: 'Chimney Swift', scientificName: 'Chaetura pelagica', family: 'Apodidae', order: 'Apodiformes' },
  { commonName: 'White-throated Swift', scientificName: 'Aeronautes saxatalis', family: 'Apodidae', order: 'Apodiformes', restrictedTo: ['us-west'] },
  { commonName: 'Ruby-throated Hummingbird', scientificName: 'Archilochus colubris', family: 'Trochilidae', order: 'Apodiformes' },
  { commonName: "Anna's Hummingbird", scientificName: 'Calypte anna', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west'] },
  { commonName: "Costa's Hummingbird", scientificName: 'Calypte costae', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west'] },
  { commonName: 'Rufous Hummingbird', scientificName: 'Selasphorus rufus', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Broad-tailed Hummingbird', scientificName: 'Selasphorus platycercus', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west'] },

  /* ---------------------------------------------------------------- */
  /* GRUIFORMES — rails, gallinules, cranes                            */
  /* ---------------------------------------------------------------- */
  { commonName: 'Virginia Rail', scientificName: 'Rallus limicola', family: 'Rallidae', order: 'Gruiformes' },
  { commonName: 'Sora', scientificName: 'Porzana carolina', family: 'Rallidae', order: 'Gruiformes' },
  { commonName: 'Clapper Rail', scientificName: 'Rallus crepitans', family: 'Rallidae', order: 'Gruiformes' },
  { commonName: 'American Coot', scientificName: 'Fulica americana', family: 'Rallidae', order: 'Gruiformes' },
  { commonName: 'Common Gallinule', scientificName: 'Gallinula galeata', family: 'Rallidae', order: 'Gruiformes' },
  { commonName: 'Sandhill Crane', scientificName: 'Antigone canadensis', family: 'Gruidae', order: 'Gruiformes' },

  /* ---------------------------------------------------------------- */
  /* CHARADRIIFORMES — shorebirds, gulls, terns                        */
  /* ---------------------------------------------------------------- */
  { commonName: 'Killdeer', scientificName: 'Charadrius vociferus', family: 'Charadriidae', order: 'Charadriiformes' },
  { commonName: 'Semipalmated Plover', scientificName: 'Charadrius semipalmatus', family: 'Charadriidae', order: 'Charadriiformes' },
  { commonName: 'Black-bellied Plover', scientificName: 'Pluvialis squatarola', family: 'Charadriidae', order: 'Charadriiformes' },
  { commonName: 'American Oystercatcher', scientificName: 'Haematopus palliatus', family: 'Haematopodidae', order: 'Charadriiformes' },
  { commonName: 'Black-necked Stilt', scientificName: 'Himantopus mexicanus', family: 'Recurvirostridae', order: 'Charadriiformes' },
  { commonName: 'American Avocet', scientificName: 'Recurvirostra americana', family: 'Recurvirostridae', order: 'Charadriiformes' },
  { commonName: 'Spotted Sandpiper', scientificName: 'Actitis macularius', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Solitary Sandpiper', scientificName: 'Tringa solitaria', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Greater Yellowlegs', scientificName: 'Tringa melanoleuca', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Lesser Yellowlegs', scientificName: 'Tringa flavipes', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Willet', scientificName: 'Tringa semipalmata', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Upland Sandpiper', scientificName: 'Bartramia longicauda', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Long-billed Curlew', scientificName: 'Numenius americanus', family: 'Scolopacidae', order: 'Charadriiformes', restrictedTo: ['us-west', 'us-midwest'] },
  { commonName: 'Whimbrel', scientificName: 'Numenius phaeopus', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Marbled Godwit', scientificName: 'Limosa fedoa', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: "Wilson's Snipe", scientificName: 'Gallinago delicata', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'American Woodcock', scientificName: 'Scolopax minor', family: 'Scolopacidae', order: 'Charadriiformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Laughing Gull', scientificName: 'Leucophaeus atricilla', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Ring-billed Gull', scientificName: 'Larus delawarensis', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Herring Gull', scientificName: 'Larus argentatus', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Great Black-backed Gull', scientificName: 'Larus marinus', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Western Gull', scientificName: 'Larus occidentalis', family: 'Laridae', order: 'Charadriiformes', restrictedTo: ['us-west'] },
  { commonName: 'Caspian Tern', scientificName: 'Hydroprogne caspia', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Common Tern', scientificName: 'Sterna hirundo', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Least Tern', scientificName: 'Sternula antillarum', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Royal Tern', scientificName: 'Thalasseus maximus', family: 'Laridae', order: 'Charadriiformes' },
  { commonName: 'Black Skimmer', scientificName: 'Rynchops niger', family: 'Laridae', order: 'Charadriiformes' },

  /* ---------------------------------------------------------------- */
  /* GAVIIFORMES — loons                                               */
  /* ---------------------------------------------------------------- */
  { commonName: 'Common Loon', scientificName: 'Gavia immer', family: 'Gaviidae', order: 'Gaviiformes' },
  { commonName: 'Red-throated Loon', scientificName: 'Gavia stellata', family: 'Gaviidae', order: 'Gaviiformes', restrictedTo: ['na-canada'] },

  /* ---------------------------------------------------------------- */
  /* SULIFORMES — cormorants                                           */
  /* ---------------------------------------------------------------- */
  { commonName: 'Double-crested Cormorant', scientificName: 'Nannopterum auritum', family: 'Phalacrocoracidae', order: 'Suliformes' },

  /* ---------------------------------------------------------------- */
  /* PELECANIFORMES — herons, egrets, bitterns                         */
  /* ---------------------------------------------------------------- */
  { commonName: 'Great Blue Heron', scientificName: 'Ardea herodias', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Great Egret', scientificName: 'Ardea alba', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Snowy Egret', scientificName: 'Egretta thula', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Green Heron', scientificName: 'Butorides virescens', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Black-crowned Night Heron', scientificName: 'Nycticorax nycticorax', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'American Bittern', scientificName: 'Botaurus lentiginosus', family: 'Ardeidae', order: 'Pelecaniformes' },

  /* ---------------------------------------------------------------- */
  /* ACCIPITRIFORMES — osprey, eagles, hawks                           */
  /* ---------------------------------------------------------------- */
  { commonName: 'Osprey', scientificName: 'Pandion haliaetus', family: 'Pandionidae', order: 'Accipitriformes' },
  { commonName: 'Bald Eagle', scientificName: 'Haliaeetus leucocephalus', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: "Cooper's Hawk", scientificName: 'Astur cooperii', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Red-shouldered Hawk', scientificName: 'Buteo lineatus', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Broad-winged Hawk', scientificName: 'Buteo platypterus', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: "Swainson's Hawk", scientificName: 'Buteo swainsoni', family: 'Accipitridae', order: 'Accipitriformes' },

  /* ---------------------------------------------------------------- */
  /* STRIGIFORMES — owls                                               */
  /* ---------------------------------------------------------------- */
  { commonName: 'Barn Owl', scientificName: 'Tyto alba', family: 'Tytonidae', order: 'Strigiformes' },
  { commonName: 'Eastern Screech-Owl', scientificName: 'Megascops asio', family: 'Strigidae', order: 'Strigiformes' },
  { commonName: 'Western Screech-Owl', scientificName: 'Megascops kennicottii', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['us-west'] },
  { commonName: 'Great Horned Owl', scientificName: 'Bubo virginianus', family: 'Strigidae', order: 'Strigiformes' },
  { commonName: 'Northern Pygmy-Owl', scientificName: 'Glaucidium gnoma', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['us-west'] },
  { commonName: 'Burrowing Owl', scientificName: 'Athene cunicularia', family: 'Strigidae', order: 'Strigiformes' },
  { commonName: 'Barred Owl', scientificName: 'Strix varia', family: 'Strigidae', order: 'Strigiformes' },
  { commonName: 'Northern Saw-whet Owl', scientificName: 'Aegolius acadicus', family: 'Strigidae', order: 'Strigiformes' },

  /* ---------------------------------------------------------------- */
  /* CORACIIFORMES — kingfishers                                       */
  /* ---------------------------------------------------------------- */
  { commonName: 'Belted Kingfisher', scientificName: 'Megaceryle alcyon', family: 'Alcedinidae', order: 'Coraciiformes' },

  /* ---------------------------------------------------------------- */
  /* PICIFORMES — woodpeckers                                          */
  /* ---------------------------------------------------------------- */
  { commonName: 'Red-headed Woodpecker', scientificName: 'Melanerpes erythrocephalus', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Acorn Woodpecker', scientificName: 'Melanerpes formicivorus', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'Gila Woodpecker', scientificName: 'Melanerpes uropygialis', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'Red-bellied Woodpecker', scientificName: 'Melanerpes carolinus', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Yellow-bellied Sapsucker', scientificName: 'Sphyrapicus varius', family: 'Picidae', order: 'Piciformes' },
  { commonName: 'Downy Woodpecker', scientificName: 'Dryobates pubescens', family: 'Picidae', order: 'Piciformes' },
  { commonName: 'Hairy Woodpecker', scientificName: 'Dryobates villosus', family: 'Picidae', order: 'Piciformes' },
  { commonName: 'Northern Flicker', scientificName: 'Colaptes auratus', family: 'Picidae', order: 'Piciformes' },
  { commonName: 'Pileated Woodpecker', scientificName: 'Dryocopus pileatus', family: 'Picidae', order: 'Piciformes' },

  /* ---------------------------------------------------------------- */
  /* FALCONIFORMES — falcons                                           */
  /* ---------------------------------------------------------------- */
  { commonName: 'American Kestrel', scientificName: 'Falco sparverius', family: 'Falconidae', order: 'Falconiformes' },
  { commonName: 'Merlin', scientificName: 'Falco columbarius', family: 'Falconidae', order: 'Falconiformes' },
  { commonName: 'Peregrine Falcon', scientificName: 'Falco peregrinus', family: 'Falconidae', order: 'Falconiformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Tyrannidae, tyrant flycatchers                    */
  /* ---------------------------------------------------------------- */
  { commonName: 'Olive-sided Flycatcher', scientificName: 'Contopus cooperi', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: 'Eastern Wood-Pewee', scientificName: 'Contopus virens', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Western Wood-Pewee', scientificName: 'Contopus sordidulus', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Acadian Flycatcher', scientificName: 'Empidonax virescens', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Willow Flycatcher', scientificName: 'Empidonax traillii', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: 'Least Flycatcher', scientificName: 'Empidonax minimus', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: 'Black Phoebe', scientificName: 'Sayornis nigricans', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Eastern Phoebe', scientificName: 'Sayornis phoebe', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: "Say's Phoebe", scientificName: 'Sayornis saya', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Vermilion Flycatcher', scientificName: 'Pyrocephalus rubinus', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'Ash-throated Flycatcher', scientificName: 'Myiarchus cinerascens', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Great Crested Flycatcher', scientificName: 'Myiarchus crinitus', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Great Kiskadee', scientificName: 'Pitangus sulphuratus', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: "Cassin's Kingbird", scientificName: 'Tyrannus vociferans', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Western Kingbird', scientificName: 'Tyrannus verticalis', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Eastern Kingbird', scientificName: 'Tyrannus tyrannus', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: 'Scissor-tailed Flycatcher', scientificName: 'Tyrannus forficatus', family: 'Tyrannidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Vireonidae, Laniidae                              */
  /* ---------------------------------------------------------------- */
  { commonName: 'White-eyed Vireo', scientificName: 'Vireo griseus', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: "Bell's Vireo", scientificName: 'Vireo bellii', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-midwest', 'us-south'] },
  { commonName: 'Yellow-throated Vireo', scientificName: 'Vireo flavifrons', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Blue-headed Vireo', scientificName: 'Vireo solitarius', family: 'Vireonidae', order: 'Passeriformes' },
  { commonName: 'Warbling Vireo', scientificName: 'Vireo gilvus', family: 'Vireonidae', order: 'Passeriformes' },
  { commonName: 'Red-eyed Vireo', scientificName: 'Vireo olivaceus', family: 'Vireonidae', order: 'Passeriformes' },
  { commonName: 'Loggerhead Shrike', scientificName: 'Lanius ludovicianus', family: 'Laniidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Corvidae                                          */
  /* ---------------------------------------------------------------- */
  { commonName: 'Canada Jay', scientificName: 'Perisoreus canadensis', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-west', 'us-northeast'] },
  { commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast', 'na-canada'] },
  { commonName: 'California Scrub-Jay', scientificName: 'Aphelocoma californica', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Mexican Jay', scientificName: 'Aphelocoma wollweberi', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Green Jay', scientificName: 'Cyanocorax yncas', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: 'Pinyon Jay', scientificName: 'Gymnorhinus cyanocephalus', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "Clark's Nutcracker", scientificName: 'Nucifraga columbiana', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Black-billed Magpie', scientificName: 'Pica hudsonia', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'American Crow', scientificName: 'Corvus brachyrhynchos', family: 'Corvidae', order: 'Passeriformes' },
  { commonName: 'Fish Crow', scientificName: 'Corvus ossifragus', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-northeast'] },
  { commonName: 'Common Raven', scientificName: 'Corvus corax', family: 'Corvidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — larks, tits, swallows, bushtits                   */
  /* ---------------------------------------------------------------- */
  { commonName: 'Horned Lark', scientificName: 'Eremophila alpestris', family: 'Alaudidae', order: 'Passeriformes' },
  { commonName: 'Verdin', scientificName: 'Auriparus flaviceps', family: 'Remizidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'Carolina Chickadee', scientificName: 'Poecile carolinensis', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Black-capped Chickadee', scientificName: 'Poecile atricapillus', family: 'Paridae', order: 'Passeriformes' },
  { commonName: 'Mountain Chickadee', scientificName: 'Poecile gambeli', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Chestnut-backed Chickadee', scientificName: 'Poecile rufescens', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Oak Titmouse', scientificName: 'Baeolophus inornatus', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Tufted Titmouse', scientificName: 'Baeolophus bicolor', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Bank Swallow', scientificName: 'Riparia riparia', family: 'Hirundinidae', order: 'Passeriformes' },
  { commonName: 'Tree Swallow', scientificName: 'Tachycineta bicolor', family: 'Hirundinidae', order: 'Passeriformes' },
  { commonName: 'Violet-green Swallow', scientificName: 'Tachycineta thalassina', family: 'Hirundinidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Northern Rough-winged Swallow', scientificName: 'Stelgidopteryx serripennis', family: 'Hirundinidae', order: 'Passeriformes' },
  { commonName: 'Purple Martin', scientificName: 'Progne subis', family: 'Hirundinidae', order: 'Passeriformes' },
  { commonName: 'Barn Swallow', scientificName: 'Hirundo rustica', family: 'Hirundinidae', order: 'Passeriformes' },
  { commonName: 'Cliff Swallow', scientificName: 'Petrochelidon pyrrhonota', family: 'Hirundinidae', order: 'Passeriformes' },
  { commonName: 'Bushtit', scientificName: 'Psaltriparus minimus', family: 'Aegithalidae', order: 'Passeriformes', restrictedTo: ['us-west'] },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — nuthatches, creeper, gnatcatcher, wrens, dipper   */
  /* ---------------------------------------------------------------- */
  { commonName: 'Red-breasted Nuthatch', scientificName: 'Sitta canadensis', family: 'Sittidae', order: 'Passeriformes' },
  { commonName: 'White-breasted Nuthatch', scientificName: 'Sitta carolinensis', family: 'Sittidae', order: 'Passeriformes' },
  { commonName: 'Pygmy Nuthatch', scientificName: 'Sitta pygmaea', family: 'Sittidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Brown-headed Nuthatch', scientificName: 'Sitta pusilla', family: 'Sittidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: 'Brown Creeper', scientificName: 'Certhia americana', family: 'Certhiidae', order: 'Passeriformes' },
  { commonName: 'Blue-gray Gnatcatcher', scientificName: 'Polioptila caerulea', family: 'Polioptilidae', order: 'Passeriformes' },
  { commonName: 'Rock Wren', scientificName: 'Salpinctes obsoletus', family: 'Troglodytidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Canyon Wren', scientificName: 'Catherpes mexicanus', family: 'Troglodytidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'House Wren', scientificName: 'Troglodytes aedon', family: 'Troglodytidae', order: 'Passeriformes' },
  { commonName: 'Pacific Wren', scientificName: 'Troglodytes pacificus', family: 'Troglodytidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Winter Wren', scientificName: 'Troglodytes hiemalis', family: 'Troglodytidae', order: 'Passeriformes' },
  { commonName: 'Marsh Wren', scientificName: 'Cistothorus palustris', family: 'Troglodytidae', order: 'Passeriformes' },
  { commonName: 'Carolina Wren', scientificName: 'Thryothorus ludovicianus', family: 'Troglodytidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: "Bewick's Wren", scientificName: 'Thryomanes bewickii', family: 'Troglodytidae', order: 'Passeriformes' },
  { commonName: 'Cactus Wren', scientificName: 'Campylorhynchus brunneicapillus', family: 'Troglodytidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'American Dipper', scientificName: 'Cinclus mexicanus', family: 'Cinclidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Golden-crowned Kinglet', scientificName: 'Regulus satrapa', family: 'Regulidae', order: 'Passeriformes' },
  { commonName: 'Ruby-crowned Kinglet', scientificName: 'Corthylio calendula', family: 'Regulidae', order: 'Passeriformes' },
  { commonName: 'Wrentit', scientificName: 'Chamaea fasciata', family: 'Sylviidae', order: 'Passeriformes', restrictedTo: ['us-west'] },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Turdidae, Mimidae                                 */
  /* ---------------------------------------------------------------- */
  { commonName: 'Eastern Bluebird', scientificName: 'Sialia sialis', family: 'Turdidae', order: 'Passeriformes' },
  { commonName: 'Western Bluebird', scientificName: 'Sialia mexicana', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Mountain Bluebird', scientificName: 'Sialia currucoides', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "Townsend's Solitaire", scientificName: 'Myadestes townsendi', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Veery', scientificName: 'Catharus fuscescens', family: 'Turdidae', order: 'Passeriformes' },
  { commonName: "Swainson's Thrush", scientificName: 'Catharus ustulatus', family: 'Turdidae', order: 'Passeriformes' },
  { commonName: 'Hermit Thrush', scientificName: 'Catharus guttatus', family: 'Turdidae', order: 'Passeriformes' },
  { commonName: 'Wood Thrush', scientificName: 'Hylocichla mustelina', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'American Robin', scientificName: 'Turdus migratorius', family: 'Turdidae', order: 'Passeriformes' },
  { commonName: 'Varied Thrush', scientificName: 'Ixoreus naevius', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Gray Catbird', scientificName: 'Dumetella carolinensis', family: 'Mimidae', order: 'Passeriformes' },
  { commonName: 'Brown Thrasher', scientificName: 'Toxostoma rufum', family: 'Mimidae', order: 'Passeriformes' },
  { commonName: 'Curve-billed Thrasher', scientificName: 'Toxostoma curvirostre', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'Sage Thrasher', scientificName: 'Oreoscoptes montanus', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Northern Mockingbird', scientificName: 'Mimus polyglottos', family: 'Mimidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — starling, waxwing, silky-flycatcher, sparrow, pipit */
  /* ---------------------------------------------------------------- */
  { commonName: 'European Starling', scientificName: 'Sturnus vulgaris', family: 'Sturnidae', order: 'Passeriformes' },
  { commonName: 'Cedar Waxwing', scientificName: 'Bombycilla cedrorum', family: 'Bombycillidae', order: 'Passeriformes' },
  { commonName: 'Phainopepla', scientificName: 'Phainopepla nitens', family: 'Ptiliogonatidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'House Sparrow', scientificName: 'Passer domesticus', family: 'Passeridae', order: 'Passeriformes' },
  { commonName: 'American Pipit', scientificName: 'Anthus rubescens', family: 'Motacillidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Fringillidae, Calcariidae                         */
  /* ---------------------------------------------------------------- */
  { commonName: 'Evening Grosbeak', scientificName: 'Hesperiphona vespertina', family: 'Fringillidae', order: 'Passeriformes' },
  { commonName: 'House Finch', scientificName: 'Haemorhous mexicanus', family: 'Fringillidae', order: 'Passeriformes' },
  { commonName: 'Purple Finch', scientificName: 'Haemorhous purpureus', family: 'Fringillidae', order: 'Passeriformes' },
  { commonName: 'Pine Siskin', scientificName: 'Spinus pinus', family: 'Fringillidae', order: 'Passeriformes' },
  { commonName: 'Lesser Goldfinch', scientificName: 'Spinus psaltria', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'American Goldfinch', scientificName: 'Spinus tristis', family: 'Fringillidae', order: 'Passeriformes' },
  { commonName: 'Snow Bunting', scientificName: 'Plectrophenax nivalis', family: 'Calcariidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-midwest', 'us-northeast'] },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Passerellidae, New World sparrows                 */
  /* ---------------------------------------------------------------- */
  { commonName: "Cassin's Sparrow", scientificName: 'Peucaea cassinii', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: "Bachman's Sparrow", scientificName: 'Peucaea aestivalis', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: 'Grasshopper Sparrow', scientificName: 'Ammodramus savannarum', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Green-tailed Towhee', scientificName: 'Pipilo chlorurus', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Spotted Towhee', scientificName: 'Pipilo maculatus', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Eastern Towhee', scientificName: 'Pipilo erythrophthalmus', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'California Towhee', scientificName: 'Melozone crissalis', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Chipping Sparrow', scientificName: 'Spizella passerina', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Clay-colored Sparrow', scientificName: 'Spizella pallida', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: "Brewer's Sparrow", scientificName: 'Spizella breweri', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Field Sparrow', scientificName: 'Spizella pusilla', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'American Tree Sparrow', scientificName: 'Spizelloides arborea', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Lark Sparrow', scientificName: 'Chondestes grammacus', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Lark Bunting', scientificName: 'Calamospiza melanocorys', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-midwest'] },
  { commonName: 'Black-throated Sparrow', scientificName: 'Amphispiza bilineata', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Vesper Sparrow', scientificName: 'Pooecetes gramineus', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Savannah Sparrow', scientificName: 'Passerculus sandwichensis', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: "Lincoln's Sparrow", scientificName: 'Melospiza lincolnii', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Swamp Sparrow', scientificName: 'Melospiza georgiana', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'White-throated Sparrow', scientificName: 'Zonotrichia albicollis', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'White-crowned Sparrow', scientificName: 'Zonotrichia leucophrys', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Golden-crowned Sparrow', scientificName: 'Zonotrichia atricapilla', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Dark-eyed Junco', scientificName: 'Junco hyemalis', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: 'Fox Sparrow', scientificName: 'Passerella iliaca', family: 'Passerellidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Icteriidae, Icteridae                             */
  /* ---------------------------------------------------------------- */
  { commonName: 'Yellow-breasted Chat', scientificName: 'Icteria virens', family: 'Icteriidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast', 'us-west'] },
  { commonName: 'Yellow-headed Blackbird', scientificName: 'Xanthocephalus xanthocephalus', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: 'Bobolink', scientificName: 'Dolichonyx oryzivorus', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: 'Eastern Meadowlark', scientificName: 'Sturnella magna', family: 'Icteridae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Western Meadowlark', scientificName: 'Sturnella neglecta', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: 'Orchard Oriole', scientificName: 'Icterus spurius', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: "Bullock's Oriole", scientificName: 'Icterus bullockii', family: 'Icteridae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Baltimore Oriole', scientificName: 'Icterus galbula', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: "Scott's Oriole", scientificName: 'Icterus parisorum', family: 'Icteridae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Red-winged Blackbird', scientificName: 'Agelaius phoeniceus', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: 'Brown-headed Cowbird', scientificName: 'Molothrus ater', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: 'Rusty Blackbird', scientificName: 'Euphagus carolinus', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: "Brewer's Blackbird", scientificName: 'Euphagus cyanocephalus', family: 'Icteridae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Common Grackle', scientificName: 'Quiscalus quiscula', family: 'Icteridae', order: 'Passeriformes' },
  { commonName: 'Boat-tailed Grackle', scientificName: 'Quiscalus major', family: 'Icteridae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-northeast'] },
  { commonName: 'Great-tailed Grackle', scientificName: 'Quiscalus mexicanus', family: 'Icteridae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Parulidae, wood-warblers                          */
  /* ---------------------------------------------------------------- */
  { commonName: 'Ovenbird', scientificName: 'Seiurus aurocapilla', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast', 'na-canada'] },
  { commonName: 'Worm-eating Warbler', scientificName: 'Helmitheros vermivorum', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Louisiana Waterthrush', scientificName: 'Parkesia motacilla', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Northern Waterthrush', scientificName: 'Parkesia noveboracensis', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Golden-winged Warbler', scientificName: 'Vermivora chrysoptera', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Blue-winged Warbler', scientificName: 'Vermivora cyanoptera', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Black-and-white Warbler', scientificName: 'Mniotilta varia', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Prothonotary Warbler', scientificName: 'Protonotaria citrea', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest'] },
  { commonName: 'Nashville Warbler', scientificName: 'Leiothlypis ruficapilla', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Mourning Warbler', scientificName: 'Geothlypis philadelphia', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Kentucky Warbler', scientificName: 'Geothlypis formosa', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest'] },
  { commonName: 'Common Yellowthroat', scientificName: 'Geothlypis trichas', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Hooded Warbler', scientificName: 'Setophaga citrina', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'American Redstart', scientificName: 'Setophaga ruticilla', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Cerulean Warbler', scientificName: 'Setophaga cerulea', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Northern Parula', scientificName: 'Setophaga americana', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Magnolia Warbler', scientificName: 'Setophaga magnolia', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Blackburnian Warbler', scientificName: 'Setophaga fusca', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Yellow Warbler', scientificName: 'Setophaga petechia', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Chestnut-sided Warbler', scientificName: 'Setophaga pensylvanica', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Black-throated Blue Warbler', scientificName: 'Setophaga caerulescens', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Pine Warbler', scientificName: 'Setophaga pinus', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Yellow-rumped Warbler', scientificName: 'Setophaga coronata', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Yellow-throated Warbler', scientificName: 'Setophaga dominica', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest'] },
  { commonName: 'Prairie Warbler', scientificName: 'Setophaga discolor', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest', 'us-northeast'] },
  { commonName: 'Black-throated Gray Warbler', scientificName: 'Setophaga nigrescens', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Black-throated Green Warbler', scientificName: 'Setophaga virens', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Canada Warbler', scientificName: 'Cardellina canadensis', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: "Wilson's Warbler", scientificName: 'Cardellina pusilla', family: 'Parulidae', order: 'Passeriformes' },

  /* ---------------------------------------------------------------- */
  /* PASSERIFORMES — Cardinalidae                                      */
  /* ---------------------------------------------------------------- */
  { commonName: 'Summer Tanager', scientificName: 'Piranga rubra', family: 'Cardinalidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-midwest'] },
  { commonName: 'Scarlet Tanager', scientificName: 'Piranga olivacea', family: 'Cardinalidae', order: 'Passeriformes' },
  { commonName: 'Western Tanager', scientificName: 'Piranga ludoviciana', family: 'Cardinalidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', family: 'Cardinalidae', order: 'Passeriformes' },
  { commonName: 'Pyrrhuloxia', scientificName: 'Cardinalis sinuatus', family: 'Cardinalidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'Rose-breasted Grosbeak', scientificName: 'Pheucticus ludovicianus', family: 'Cardinalidae', order: 'Passeriformes' },
  { commonName: 'Black-headed Grosbeak', scientificName: 'Pheucticus melanocephalus', family: 'Cardinalidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Blue Grosbeak', scientificName: 'Passerina caerulea', family: 'Cardinalidae', order: 'Passeriformes' },
  { commonName: 'Lazuli Bunting', scientificName: 'Passerina amoena', family: 'Cardinalidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Indigo Bunting', scientificName: 'Passerina cyanea', family: 'Cardinalidae', order: 'Passeriformes' },
  { commonName: 'Painted Bunting', scientificName: 'Passerina ciris', family: 'Cardinalidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: 'Dickcissel', scientificName: 'Spiza americana', family: 'Cardinalidae', order: 'Passeriformes' },
];

export const CURATED_SPECIES: readonly SpeciesSeed[] = Object.freeze(
  dedupeById(CURATED_SEEDS.map(toSpeciesSeed)),
);
