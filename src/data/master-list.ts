/**
 * MASTER POOL — the hardcore game's species list.
 *
 * The master pool is a strict superset of the curated pool: everything a
 * standard player can draw, plus the tier that separates a good birder from a
 * specialist. Three kinds of addition live here.
 *
 *  1. Scarcer or more localised North American breeders — birds you have to go
 *     looking for rather than birds that turn up in a suburban yard.
 *  2. The sibling-species problems: Empidonax, Catharus, Traill's complex
 *     (Alder vs Willow), scaup, crossbill call types, scrub-jays, rosy-finches.
 *  3. Europe and the western Palearctic, so the hardcore pool is not a North
 *     American list wearing a difficult hat. Scope is deliberately Holarctic:
 *     the two regions where Xeno-canto's coverage is deep enough that a
 *     song, a call AND an alarm recording reliably exist for the same
 *     species. Tropical pools were considered and dropped for that reason —
 *     a puzzle that cannot fill its three audio slots is not playable.
 *
 * Same rules as the curated file: real binomials, current AOS/IOC placement,
 * ids derived from the binomial, `inatTaxonId` left null so the species service
 * resolves by name rather than risking the wrong bird's photograph.
 */

import { getRegion, isWithin, type RegionId } from '@/lib/regions';
import { COMMONNESS_RANK, beginnerRank } from './generated/beginner-pools';
import {
  CURATED_SPECIES,
  dedupeById,
  toSpeciesSeed,
  type SeedInput,
  type SpeciesSeed,
} from './curated-500';

export type { SpeciesSeed, SeedInput } from './curated-500';

const MASTER_ADDITIONS: readonly SeedInput[] = [
  /* ---------------------------------------------------------------- */
  /* A · SCARCER AND MORE LOCALISED NORTH AMERICAN BREEDERS            */
  /*     Birds you travel for, or that only give themselves away by    */
  /*     voice at the right hour of the right month.                   */
  /* ---------------------------------------------------------------- */

  /* Waterbirds and marsh skulkers */
  { commonName: 'Black Rail', scientificName: 'Laterallus jamaicensis', family: 'Rallidae', order: 'Gruiformes', restrictedTo: ['us-south', 'us-west'] },
  { commonName: 'Yellow Rail', scientificName: 'Coturnicops noveboracensis', family: 'Rallidae', order: 'Gruiformes' },
  { commonName: 'King Rail', scientificName: 'Rallus elegans', family: 'Rallidae', order: 'Gruiformes', restrictedTo: ['us-south', 'us-midwest'] },
  { commonName: 'Limpkin', scientificName: 'Aramus guarauna', family: 'Aramidae', order: 'Gruiformes', restrictedTo: ['us-south'] },
  { commonName: 'Least Bittern', scientificName: 'Ixobrychus exilis', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Eared Grebe', scientificName: 'Podiceps nigricollis', family: 'Podicipedidae', order: 'Podicipediformes', restrictedTo: ['us-west', 'us-midwest'] },
  { commonName: 'Horned Grebe', scientificName: 'Podiceps auritus', family: 'Podicipedidae', order: 'Podicipediformes' },
  { commonName: 'Red-necked Grebe', scientificName: 'Podiceps grisegena', family: 'Podicipedidae', order: 'Podicipediformes', restrictedTo: ['na-canada', 'us-west'] },
  { commonName: 'Reddish Egret', scientificName: 'Egretta rufescens', family: 'Ardeidae', order: 'Pelecaniformes', restrictedTo: ['us-south'] },
  { commonName: 'Tricolored Heron', scientificName: 'Egretta tricolor', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Little Blue Heron', scientificName: 'Egretta caerulea', family: 'Ardeidae', order: 'Pelecaniformes' },
  { commonName: 'Yellow-crowned Night Heron', scientificName: 'Nyctanassa violacea', family: 'Ardeidae', order: 'Pelecaniformes', restrictedTo: ['us-south', 'us-northeast'] },
  { commonName: 'White Ibis', scientificName: 'Eudocimus albus', family: 'Threskiornithidae', order: 'Pelecaniformes', restrictedTo: ['us-south'] },
  { commonName: 'Glossy Ibis', scientificName: 'Plegadis falcinellus', family: 'Threskiornithidae', order: 'Pelecaniformes' },
  { commonName: 'Roseate Spoonbill', scientificName: 'Platalea ajaja', family: 'Threskiornithidae', order: 'Pelecaniformes', restrictedTo: ['us-south'] },
  { commonName: 'Wood Stork', scientificName: 'Mycteria americana', family: 'Ciconiidae', order: 'Ciconiiformes', restrictedTo: ['us-south'] },
  { commonName: 'Anhinga', scientificName: 'Anhinga anhinga', family: 'Anhingidae', order: 'Suliformes', restrictedTo: ['us-south'] },
  { commonName: 'Magnificent Frigatebird', scientificName: 'Fregata magnificens', family: 'Fregatidae', order: 'Suliformes', restrictedTo: ['us-south'] },
  { commonName: 'Brown Pelican', scientificName: 'Pelecanus occidentalis', family: 'Pelecanidae', order: 'Pelecaniformes' },
  { commonName: 'American White Pelican', scientificName: 'Pelecanus erythrorhynchos', family: 'Pelecanidae', order: 'Pelecaniformes' },

  /* Shorebirds — mostly flight calls, which is the whole difficulty */
  { commonName: 'Mountain Plover', scientificName: 'Charadrius montanus', family: 'Charadriidae', order: 'Charadriiformes', restrictedTo: ['us-west'] },
  { commonName: 'Snowy Plover', scientificName: 'Charadrius nivosus', family: 'Charadriidae', order: 'Charadriiformes' },
  { commonName: "Wilson's Plover", scientificName: 'Charadrius wilsonia', family: 'Charadriidae', order: 'Charadriiformes', restrictedTo: ['us-south', 'us-northeast'] },
  { commonName: 'Black Oystercatcher', scientificName: 'Haematopus bachmani', family: 'Haematopodidae', order: 'Charadriiformes', restrictedTo: ['us-west'] },
  { commonName: 'Red Knot', scientificName: 'Calidris canutus', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Least Sandpiper', scientificName: 'Calidris minutilla', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Western Sandpiper', scientificName: 'Calidris mauri', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Dunlin', scientificName: 'Calidris alpina', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Pectoral Sandpiper', scientificName: 'Calidris melanotos', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: "Wilson's Phalarope", scientificName: 'Phalaropus tricolor', family: 'Scolopacidae', order: 'Charadriiformes' },
  { commonName: 'Red-necked Phalarope', scientificName: 'Phalaropus lobatus', family: 'Scolopacidae', order: 'Charadriiformes' },

  /* Raptors */
  { commonName: 'American Goshawk', scientificName: 'Astur atricapillus', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Sharp-shinned Hawk', scientificName: 'Accipiter striatus', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Northern Harrier', scientificName: 'Circus hudsonius', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Ferruginous Hawk', scientificName: 'Buteo regalis', family: 'Accipitridae', order: 'Accipitriformes', restrictedTo: ['us-west'] },
  { commonName: 'Zone-tailed Hawk', scientificName: 'Buteo albonotatus', family: 'Accipitridae', order: 'Accipitriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: "Harris's Hawk", scientificName: 'Parabuteo unicinctus', family: 'Accipitridae', order: 'Accipitriformes', restrictedTo: ['us-west', 'us-south', 'na-mexico'] },
  { commonName: 'Common Black Hawk', scientificName: 'Buteogallus anthracinus', family: 'Accipitridae', order: 'Accipitriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Mississippi Kite', scientificName: 'Ictinia mississippiensis', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Swallow-tailed Kite', scientificName: 'Elanoides forficatus', family: 'Accipitridae', order: 'Accipitriformes', restrictedTo: ['us-south'] },
  { commonName: 'White-tailed Kite', scientificName: 'Elanus leucurus', family: 'Accipitridae', order: 'Accipitriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'Golden Eagle', scientificName: 'Aquila chrysaetos', family: 'Accipitridae', order: 'Accipitriformes' },
  { commonName: 'Crested Caracara', scientificName: 'Caracara plancus', family: 'Falconidae', order: 'Falconiformes', restrictedTo: ['us-south', 'us-west', 'na-mexico'] },
  { commonName: 'Prairie Falcon', scientificName: 'Falco mexicanus', family: 'Falconidae', order: 'Falconiformes', restrictedTo: ['us-west'] },
  { commonName: 'Gyrfalcon', scientificName: 'Falco rusticolus', family: 'Falconidae', order: 'Falconiformes', restrictedTo: ['na-canada'] },

  /* Owls and nightbirds */
  { commonName: 'Boreal Owl', scientificName: 'Aegolius funereus', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['na-canada', 'us-west'] },
  { commonName: 'Long-eared Owl', scientificName: 'Asio otus', family: 'Strigidae', order: 'Strigiformes' },
  { commonName: 'Short-eared Owl', scientificName: 'Asio flammeus', family: 'Strigidae', order: 'Strigiformes' },
  { commonName: 'Northern Hawk Owl', scientificName: 'Surnia ulula', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['na-canada'] },
  { commonName: 'Great Gray Owl', scientificName: 'Strix nebulosa', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['na-canada', 'us-west'] },
  { commonName: 'Spotted Owl', scientificName: 'Strix occidentalis', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Flammulated Owl', scientificName: 'Psiloscops flammeolus', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Elf Owl', scientificName: 'Micrathene whitneyi', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Ferruginous Pygmy-Owl', scientificName: 'Glaucidium brasilianum', family: 'Strigidae', order: 'Strigiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Buff-collared Nightjar', scientificName: 'Antrostomus ridgwayi', family: 'Caprimulgidae', order: 'Caprimulgiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Lesser Nighthawk', scientificName: 'Chordeiles acutipennis', family: 'Caprimulgidae', order: 'Caprimulgiformes', restrictedTo: ['us-west', 'na-mexico'] },

  /* Swifts, hummingbirds, trogon, kingfishers */
  { commonName: "Vaux's Swift", scientificName: 'Chaetura vauxi', family: 'Apodidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Black Swift', scientificName: 'Cypseloides niger', family: 'Apodidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Black-chinned Hummingbird', scientificName: 'Archilochus alexandri', family: 'Trochilidae', order: 'Apodiformes' },
  { commonName: 'Broad-billed Hummingbird', scientificName: 'Cynanthus latirostris', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: "Rivoli's Hummingbird", scientificName: 'Eugenes fulgens', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Blue-throated Mountain-gem', scientificName: 'Lampornis clemenciae', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Lucifer Hummingbird', scientificName: 'Calothorax lucifer', family: 'Trochilidae', order: 'Apodiformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Calliope Hummingbird', scientificName: 'Selasphorus calliope', family: 'Trochilidae', order: 'Apodiformes' },
  { commonName: "Allen's Hummingbird", scientificName: 'Selasphorus sasin', family: 'Trochilidae', order: 'Apodiformes' },
  { commonName: 'Elegant Trogon', scientificName: 'Trogon elegans', family: 'Trogonidae', order: 'Trogoniformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Green Kingfisher', scientificName: 'Chloroceryle americana', family: 'Alcedinidae', order: 'Coraciiformes', restrictedTo: ['us-west', 'us-south', 'na-mexico'] },
  { commonName: 'Ringed Kingfisher', scientificName: 'Megaceryle torquata', family: 'Alcedinidae', order: 'Coraciiformes', restrictedTo: ['us-south', 'na-mexico'] },

  /* Woodpeckers */
  { commonName: "Lewis's Woodpecker", scientificName: 'Melanerpes lewis', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'Golden-fronted Woodpecker', scientificName: 'Melanerpes aurifrons', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-south', 'na-mexico'] },
  { commonName: 'Red-naped Sapsucker', scientificName: 'Sphyrapicus nuchalis', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'Red-breasted Sapsucker', scientificName: 'Sphyrapicus ruber', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: "Williamson's Sapsucker", scientificName: 'Sphyrapicus thyroideus', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'American Three-toed Woodpecker', scientificName: 'Picoides dorsalis', family: 'Picidae', order: 'Piciformes', restrictedTo: ['na-canada', 'us-west'] },
  { commonName: 'Black-backed Woodpecker', scientificName: 'Picoides arcticus', family: 'Picidae', order: 'Piciformes', restrictedTo: ['na-canada', 'us-west', 'us-northeast'] },
  { commonName: 'Ladder-backed Woodpecker', scientificName: 'Dryobates scalaris', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west', 'us-south', 'na-mexico'] },
  { commonName: "Nuttall's Woodpecker", scientificName: 'Dryobates nuttallii', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'Red-cockaded Woodpecker', scientificName: 'Dryobates borealis', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-south'] },
  { commonName: 'White-headed Woodpecker', scientificName: 'Dryobates albolarvatus', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west'] },
  { commonName: 'Gilded Flicker', scientificName: 'Colaptes chrysoides', family: 'Picidae', order: 'Piciformes', restrictedTo: ['us-west', 'na-mexico'] },
  /* ---------------------------------------------------------------- */
  /* B · THE SIBLING-SPECIES PROBLEMS                                  */
  /*     Where voice is the only honest field mark. These carry the    */
  /*     high difficulty ratings and are the point of hardcore mode.   */
  /* ---------------------------------------------------------------- */

  /* Empidonax. Note: AOS lumped Pacific-slope and Cordilleran back into
     Western Flycatcher (E. difficilis) in 2023, so only the lumped taxon
     appears here — listing E. occidentalis would no longer resolve against
     current iNaturalist taxonomy. */
  { commonName: 'Alder Flycatcher', scientificName: 'Empidonax alnorum', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: 'Yellow-bellied Flycatcher', scientificName: 'Empidonax flaviventris', family: 'Tyrannidae', order: 'Passeriformes' },
  { commonName: "Hammond's Flycatcher", scientificName: 'Empidonax hammondii', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Dusky Flycatcher', scientificName: 'Empidonax oberholseri', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Gray Flycatcher', scientificName: 'Empidonax wrightii', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Western Flycatcher', scientificName: 'Empidonax difficilis', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Buff-breasted Flycatcher', scientificName: 'Empidonax fulvifrons', family: 'Tyrannidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },

  /* Catharus */
  { commonName: 'Gray-cheeked Thrush', scientificName: 'Catharus minimus', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['na-canada'] },
  { commonName: "Bicknell's Thrush", scientificName: 'Catharus bicknelli', family: 'Turdidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-northeast'] },

  /* Aythya and the sea ducks */
  { commonName: 'Greater Scaup', scientificName: 'Aythya marila', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Lesser Scaup', scientificName: 'Aythya affinis', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Ring-necked Duck', scientificName: 'Aythya collaris', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Redhead', scientificName: 'Aythya americana', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Canvasback', scientificName: 'Aythya valisineria', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: "Barrow's Goldeneye", scientificName: 'Bucephala islandica', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Bufflehead', scientificName: 'Bucephala albeola', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Common Merganser', scientificName: 'Mergus merganser', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Red-breasted Merganser', scientificName: 'Mergus serrator', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Gadwall', scientificName: 'Mareca strepera', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Eurasian Wigeon', scientificName: 'Mareca penelope', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Northern Shoveler', scientificName: 'Spatula clypeata', family: 'Anatidae', order: 'Anseriformes' },
  { commonName: 'Cinnamon Teal', scientificName: 'Spatula cyanoptera', family: 'Anatidae', order: 'Anseriformes' },

  /* Crossbills, rosy-finches and the boreal finches */
  { commonName: 'Red Crossbill', scientificName: 'Loxia curvirostra', family: 'Fringillidae', order: 'Passeriformes' },
  { commonName: 'White-winged Crossbill', scientificName: 'Loxia leucoptera', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-west', 'us-northeast'] },
  { commonName: "Cassin's Finch", scientificName: 'Haemorhous cassinii', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Gray-crowned Rosy-Finch', scientificName: 'Leucosticte tephrocotis', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-canada'] },
  { commonName: 'Black Rosy-Finch', scientificName: 'Leucosticte atrata', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Brown-capped Rosy-Finch', scientificName: 'Leucosticte australis', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Common Redpoll', scientificName: 'Acanthis flammea', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-midwest', 'us-northeast'] },
  { commonName: 'Pine Grosbeak', scientificName: 'Pinicola enucleator', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-west', 'us-northeast'] },
  { commonName: "Lawrence's Goldfinch", scientificName: 'Spinus lawrencei', family: 'Fringillidae', order: 'Passeriformes', restrictedTo: ['us-west'] },

  /* Corvids and parids */
  { commonName: "Woodhouse's Scrub-Jay", scientificName: 'Aphelocoma woodhouseii', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Florida Scrub-Jay', scientificName: 'Aphelocoma coerulescens', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: 'Island Scrub-Jay', scientificName: 'Aphelocoma insularis', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Chihuahuan Raven', scientificName: 'Corvus cryptoleucus', family: 'Corvidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south'] },
  { commonName: 'Boreal Chickadee', scientificName: 'Poecile hudsonicus', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-northeast'] },
  { commonName: 'Mexican Chickadee', scientificName: 'Poecile sclateri', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Juniper Titmouse', scientificName: 'Baeolophus ridgwayi', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Black-crested Titmouse', scientificName: 'Baeolophus atricristatus', family: 'Paridae', order: 'Passeriformes', restrictedTo: ['us-south', 'na-mexico'] },

  /* Thrashers and wrens */
  { commonName: "Bendire's Thrasher", scientificName: 'Toxostoma bendirei', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "LeConte's Thrasher", scientificName: 'Toxostoma lecontei', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'California Thrasher', scientificName: 'Toxostoma redivivum', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Crissal Thrasher', scientificName: 'Toxostoma crissale', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Long-billed Thrasher', scientificName: 'Toxostoma longirostre', family: 'Mimidae', order: 'Passeriformes', restrictedTo: ['us-south', 'na-mexico'] },
  { commonName: 'Sedge Wren', scientificName: 'Cistothorus stellaris', family: 'Troglodytidae', order: 'Passeriformes' },

  /* The grass sparrows — the hardest common birds in North America */
  { commonName: "Nelson's Sparrow", scientificName: 'Ammospiza nelsoni', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-midwest', 'us-northeast'] },
  { commonName: 'Saltmarsh Sparrow', scientificName: 'Ammospiza caudacuta', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-northeast', 'us-south'] },
  { commonName: 'Seaside Sparrow', scientificName: 'Ammospiza maritima', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-south', 'us-northeast'] },
  { commonName: "LeConte's Sparrow", scientificName: 'Ammospiza leconteii', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: "Henslow's Sparrow", scientificName: 'Centronyx henslowii', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-midwest', 'us-south'] },
  { commonName: "Baird's Sparrow", scientificName: 'Centronyx bairdii', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-midwest', 'na-canada'] },
  { commonName: "Botteri's Sparrow", scientificName: 'Peucaea botterii', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'us-south', 'na-mexico'] },
  { commonName: 'Rufous-winged Sparrow', scientificName: 'Peucaea carpalis', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Five-striped Sparrow', scientificName: 'Amphispiza quinquestriata', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Sagebrush Sparrow', scientificName: 'Artemisiospiza nevadensis', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "Bell's Sparrow", scientificName: 'Artemisiospiza belli', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Black-chinned Sparrow', scientificName: 'Spizella atrogularis', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: "Harris's Sparrow", scientificName: 'Zonotrichia querula', family: 'Passerellidae', order: 'Passeriformes' },
  { commonName: "Abert's Towhee", scientificName: 'Melozone aberti', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Canyon Towhee', scientificName: 'Melozone fusca', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Olive Sparrow', scientificName: 'Arremonops rufivirgatus', family: 'Passerellidae', order: 'Passeriformes', restrictedTo: ['us-south', 'na-mexico'] },
  { commonName: 'Lapland Longspur', scientificName: 'Calcarius lapponicus', family: 'Calcariidae', order: 'Passeriformes', restrictedTo: ['na-canada'] },
  { commonName: 'Chestnut-collared Longspur', scientificName: 'Calcarius ornatus', family: 'Calcariidae', order: 'Passeriformes', restrictedTo: ['us-midwest', 'us-west'] },
  { commonName: "Smith's Longspur", scientificName: 'Calcarius pictus', family: 'Calcariidae', order: 'Passeriformes', restrictedTo: ['na-canada'] },
  { commonName: 'Thick-billed Longspur', scientificName: 'Rhynchophanes mccownii', family: 'Calcariidae', order: 'Passeriformes', restrictedTo: ['us-midwest', 'us-west'] },

  /* Warblers beyond the common set */
  { commonName: 'Connecticut Warbler', scientificName: 'Oporornis agilis', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['na-canada', 'us-midwest'] },
  { commonName: "MacGillivray's Warbler", scientificName: 'Geothlypis tolmiei', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Blackpoll Warbler', scientificName: 'Setophaga striata', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Bay-breasted Warbler', scientificName: 'Setophaga castanea', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Cape May Warbler', scientificName: 'Setophaga tigrina', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Tennessee Warbler', scientificName: 'Leiothlypis peregrina', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: 'Orange-crowned Warbler', scientificName: 'Leiothlypis celata', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: "Virginia's Warbler", scientificName: 'Leiothlypis virginiae', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "Lucy's Warbler", scientificName: 'Leiothlypis luciae', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Colima Warbler', scientificName: 'Leiothlypis crissalis', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: "Grace's Warbler", scientificName: 'Setophaga graciae', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: "Townsend's Warbler", scientificName: 'Setophaga townsendi', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Hermit Warbler', scientificName: 'Setophaga occidentalis', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Golden-cheeked Warbler', scientificName: 'Setophaga chrysoparia', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: "Kirtland's Warbler", scientificName: 'Setophaga kirtlandii', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-midwest'] },
  { commonName: 'Palm Warbler', scientificName: 'Setophaga palmarum', family: 'Parulidae', order: 'Passeriformes' },
  { commonName: "Swainson's Warbler", scientificName: 'Limnothlypis swainsonii', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  { commonName: 'Red-faced Warbler', scientificName: 'Cardellina rubrifrons', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },
  { commonName: 'Painted Redstart', scientificName: 'Myioborus pictus', family: 'Parulidae', order: 'Passeriformes', restrictedTo: ['us-west', 'na-mexico'] },

  /* Vireos — the Solitary Vireo complex especially */
  { commonName: 'Gray Vireo', scientificName: 'Vireo vicinior', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "Hutton's Vireo", scientificName: 'Vireo huttoni', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: "Cassin's Vireo", scientificName: 'Vireo cassinii', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Plumbeous Vireo', scientificName: 'Vireo plumbeus', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-west'] },
  { commonName: 'Philadelphia Vireo', scientificName: 'Vireo philadelphicus', family: 'Vireonidae', order: 'Passeriformes' },
  { commonName: 'Black-capped Vireo', scientificName: 'Vireo atricapilla', family: 'Vireonidae', order: 'Passeriformes', restrictedTo: ['us-south'] },
  /* ---------------------------------------------------------------- */
  /* C · EUROPE AND THE WESTERN PALEARCTIC                             */
  /*     The other half of the Holarctic songbook. Shared Holarctic    */
  /*     breeders already in the curated pool (Barn Swallow, Common    */
  /*     Starling, House Sparrow, Common Raven, Barn Owl, Bank         */
  /*     Swallow) are not repeated here.                               */
  /* ---------------------------------------------------------------- */

  /* Wildfowl */
  { commonName: 'Greylag Goose', scientificName: 'Anser anser', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Barnacle Goose', scientificName: 'Branta leucopsis', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Brant', scientificName: 'Branta bernicla', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Mute Swan', scientificName: 'Cygnus olor', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Whooper Swan', scientificName: 'Cygnus cygnus', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Common Shelduck', scientificName: 'Tadorna tadorna', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Common Eider', scientificName: 'Somateria mollissima', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },
  { commonName: 'Tufted Duck', scientificName: 'Aythya fuligula', family: 'Anatidae', order: 'Anseriformes', continent: 'eu' },

  /* Gamebirds */
  { commonName: 'Western Capercaillie', scientificName: 'Tetrao urogallus', family: 'Phasianidae', order: 'Galliformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-central', 'eu-east'] },
  { commonName: 'Black Grouse', scientificName: 'Lyrurus tetrix', family: 'Phasianidae', order: 'Galliformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-central', 'eu-east'] },
  { commonName: 'Willow Ptarmigan', scientificName: 'Lagopus lagopus', family: 'Phasianidae', order: 'Galliformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-west'] },
  { commonName: 'Rock Ptarmigan', scientificName: 'Lagopus muta', family: 'Phasianidae', order: 'Galliformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-central'] },
  { commonName: 'Grey Partridge', scientificName: 'Perdix perdix', family: 'Phasianidae', order: 'Galliformes', continent: 'eu' },
  { commonName: 'Red-legged Partridge', scientificName: 'Alectoris rufa', family: 'Phasianidae', order: 'Galliformes', continent: 'eu', restrictedTo: ['eu-southwest', 'eu-west'] },
  { commonName: 'Common Quail', scientificName: 'Coturnix coturnix', family: 'Phasianidae', order: 'Galliformes', continent: 'eu' },

  /* Doves, cuckoo, nightjar, swifts */
  { commonName: 'Common Wood Pigeon', scientificName: 'Columba palumbus', family: 'Columbidae', order: 'Columbiformes', continent: 'eu' },
  { commonName: 'Stock Dove', scientificName: 'Columba oenas', family: 'Columbidae', order: 'Columbiformes', continent: 'eu' },
  { commonName: 'European Turtle Dove', scientificName: 'Streptopelia turtur', family: 'Columbidae', order: 'Columbiformes', continent: 'eu' },
  { commonName: 'Common Cuckoo', scientificName: 'Cuculus canorus', family: 'Cuculidae', order: 'Cuculiformes', continent: 'eu' },
  { commonName: 'European Nightjar', scientificName: 'Caprimulgus europaeus', family: 'Caprimulgidae', order: 'Caprimulgiformes', continent: 'eu' },
  { commonName: 'Common Swift', scientificName: 'Apus apus', family: 'Apodidae', order: 'Apodiformes', continent: 'eu' },
  { commonName: 'Alpine Swift', scientificName: 'Tachymarptis melba', family: 'Apodidae', order: 'Apodiformes', continent: 'eu' },

  /* Rails, crane, waders, seabirds */
  { commonName: 'Water Rail', scientificName: 'Rallus aquaticus', family: 'Rallidae', order: 'Gruiformes', continent: 'eu' },
  { commonName: 'Corn Crake', scientificName: 'Crex crex', family: 'Rallidae', order: 'Gruiformes', continent: 'eu' },
  { commonName: 'Eurasian Coot', scientificName: 'Fulica atra', family: 'Rallidae', order: 'Gruiformes', continent: 'eu' },
  { commonName: 'Common Moorhen', scientificName: 'Gallinula chloropus', family: 'Rallidae', order: 'Gruiformes', continent: 'eu' },
  { commonName: 'Common Crane', scientificName: 'Grus grus', family: 'Gruidae', order: 'Gruiformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-east', 'eu-central'] },
  { commonName: 'Eurasian Oystercatcher', scientificName: 'Haematopus ostralegus', family: 'Haematopodidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Northern Lapwing', scientificName: 'Vanellus vanellus', family: 'Charadriidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'European Golden Plover', scientificName: 'Pluvialis apricaria', family: 'Charadriidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Common Ringed Plover', scientificName: 'Charadrius hiaticula', family: 'Charadriidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Eurasian Curlew', scientificName: 'Numenius arquata', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Black-tailed Godwit', scientificName: 'Limosa limosa', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Common Redshank', scientificName: 'Tringa totanus', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Common Greenshank', scientificName: 'Tringa nebularia', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Common Sandpiper', scientificName: 'Actitis hypoleucos', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Common Snipe', scientificName: 'Gallinago gallinago', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Eurasian Woodcock', scientificName: 'Scolopax rusticola', family: 'Scolopacidae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Black-headed Gull', scientificName: 'Chroicocephalus ridibundus', family: 'Laridae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Common Gull', scientificName: 'Larus canus', family: 'Laridae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Lesser Black-backed Gull', scientificName: 'Larus fuscus', family: 'Laridae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Black-legged Kittiwake', scientificName: 'Rissa tridactyla', family: 'Laridae', order: 'Charadriiformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-west'] },
  { commonName: 'Sandwich Tern', scientificName: 'Thalasseus sandvicensis', family: 'Laridae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Arctic Tern', scientificName: 'Sterna paradisaea', family: 'Laridae', order: 'Charadriiformes', continent: 'eu' },
  { commonName: 'Atlantic Puffin', scientificName: 'Fratercula arctica', family: 'Alcidae', order: 'Charadriiformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-west'] },
  { commonName: 'Common Murre', scientificName: 'Uria aalge', family: 'Alcidae', order: 'Charadriiformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-west'] },
  { commonName: 'Razorbill', scientificName: 'Alca torda', family: 'Alcidae', order: 'Charadriiformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-west'] },

  /* Waterbirds and raptors */
  { commonName: 'Grey Heron', scientificName: 'Ardea cinerea', family: 'Ardeidae', order: 'Pelecaniformes', continent: 'eu' },
  { commonName: 'Eurasian Bittern', scientificName: 'Botaurus stellaris', family: 'Ardeidae', order: 'Pelecaniformes', continent: 'eu' },
  { commonName: 'White Stork', scientificName: 'Ciconia ciconia', family: 'Ciconiidae', order: 'Ciconiiformes', continent: 'eu', restrictedTo: ['eu-central', 'eu-east', 'eu-southeast', 'eu-southwest'] },
  { commonName: 'Great Cormorant', scientificName: 'Phalacrocorax carbo', family: 'Phalacrocoracidae', order: 'Suliformes', continent: 'eu' },
  { commonName: 'Northern Gannet', scientificName: 'Morus bassanus', family: 'Sulidae', order: 'Suliformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-west'] },
  { commonName: 'Red Kite', scientificName: 'Milvus milvus', family: 'Accipitridae', order: 'Accipitriformes', continent: 'eu' },
  { commonName: 'Common Buzzard', scientificName: 'Buteo buteo', family: 'Accipitridae', order: 'Accipitriformes', continent: 'eu' },
  { commonName: 'Eurasian Sparrowhawk', scientificName: 'Accipiter nisus', family: 'Accipitridae', order: 'Accipitriformes', continent: 'eu' },
  { commonName: 'Western Marsh Harrier', scientificName: 'Circus aeruginosus', family: 'Accipitridae', order: 'Accipitriformes', continent: 'eu' },
  { commonName: 'White-tailed Eagle', scientificName: 'Haliaeetus albicilla', family: 'Accipitridae', order: 'Accipitriformes', continent: 'eu' },
  { commonName: 'Common Kestrel', scientificName: 'Falco tinnunculus', family: 'Falconidae', order: 'Falconiformes', continent: 'eu' },

  /* Owls */
  { commonName: 'Tawny Owl', scientificName: 'Strix aluco', family: 'Strigidae', order: 'Strigiformes', continent: 'eu' },
  { commonName: 'Eurasian Eagle-Owl', scientificName: 'Bubo bubo', family: 'Strigidae', order: 'Strigiformes', continent: 'eu' },
  { commonName: 'Little Owl', scientificName: 'Athene noctua', family: 'Strigidae', order: 'Strigiformes', continent: 'eu' },
  { commonName: 'Eurasian Pygmy Owl', scientificName: 'Glaucidium passerinum', family: 'Strigidae', order: 'Strigiformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-central', 'eu-east'] },

  /* Near-passerines */
  { commonName: 'Eurasian Hoopoe', scientificName: 'Upupa epops', family: 'Upupidae', order: 'Bucerotiformes', continent: 'eu', restrictedTo: ['eu-south', 'eu-southwest', 'eu-southeast', 'eu-central', 'eu-east'] },
  { commonName: 'Common Kingfisher', scientificName: 'Alcedo atthis', family: 'Alcedinidae', order: 'Coraciiformes', continent: 'eu' },
  { commonName: 'European Bee-eater', scientificName: 'Merops apiaster', family: 'Meropidae', order: 'Coraciiformes', continent: 'eu', restrictedTo: ['eu-south', 'eu-southwest', 'eu-southeast', 'eu-central', 'eu-east'] },
  { commonName: 'European Roller', scientificName: 'Coracias garrulus', family: 'Coraciidae', order: 'Coraciiformes', continent: 'eu', restrictedTo: ['eu-south', 'eu-southwest', 'eu-southeast', 'eu-east'] },
  { commonName: 'European Green Woodpecker', scientificName: 'Picus viridis', family: 'Picidae', order: 'Piciformes', continent: 'eu' },
  { commonName: 'Black Woodpecker', scientificName: 'Dryocopus martius', family: 'Picidae', order: 'Piciformes', continent: 'eu' },
  { commonName: 'Great Spotted Woodpecker', scientificName: 'Dendrocopos major', family: 'Picidae', order: 'Piciformes', continent: 'eu' },
  { commonName: 'Lesser Spotted Woodpecker', scientificName: 'Dryobates minor', family: 'Picidae', order: 'Piciformes', continent: 'eu' },
  { commonName: 'Eurasian Wryneck', scientificName: 'Jynx torquilla', family: 'Picidae', order: 'Piciformes', continent: 'eu' },

  /* Larks, pipits, wagtails, hirundines */
  { commonName: 'Eurasian Skylark', scientificName: 'Alauda arvensis', family: 'Alaudidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Woodlark', scientificName: 'Lullula arborea', family: 'Alaudidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common House Martin', scientificName: 'Delichon urbicum', family: 'Hirundinidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'White Wagtail', scientificName: 'Motacilla alba', family: 'Motacillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Grey Wagtail', scientificName: 'Motacilla cinerea', family: 'Motacillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Meadow Pipit', scientificName: 'Anthus pratensis', family: 'Motacillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Tree Pipit', scientificName: 'Anthus trivialis', family: 'Motacillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Water Pipit', scientificName: 'Anthus spinoletta', family: 'Motacillidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-central', 'eu-south', 'eu-southwest'] },

  /* Chats, thrushes and flycatchers */
  { commonName: 'Eurasian Wren', scientificName: 'Troglodytes troglodytes', family: 'Troglodytidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Dunnock', scientificName: 'Prunella modularis', family: 'Prunellidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'European Robin', scientificName: 'Erithacus rubecula', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Nightingale', scientificName: 'Luscinia megarhynchos', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-west', 'eu-central', 'eu-south', 'eu-southwest', 'eu-southeast'] },
  { commonName: 'Bluethroat', scientificName: 'Luscinia svecica', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-east', 'eu-central'] },
  { commonName: 'Common Redstart', scientificName: 'Phoenicurus phoenicurus', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Black Redstart', scientificName: 'Phoenicurus ochruros', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'European Stonechat', scientificName: 'Saxicola rubicola', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Whinchat', scientificName: 'Saxicola rubetra', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Northern Wheatear', scientificName: 'Oenanthe oenanthe', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Spotted Flycatcher', scientificName: 'Muscicapa striata', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'European Pied Flycatcher', scientificName: 'Ficedula hypoleuca', family: 'Muscicapidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Blackbird', scientificName: 'Turdus merula', family: 'Turdidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Song Thrush', scientificName: 'Turdus philomelos', family: 'Turdidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Mistle Thrush', scientificName: 'Turdus viscivorus', family: 'Turdidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Redwing', scientificName: 'Turdus iliacus', family: 'Turdidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-east'] },
  { commonName: 'Fieldfare', scientificName: 'Turdus pilaris', family: 'Turdidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-central', 'eu-east'] },

  /* Sylviid and phylloscopid warblers — the European ear-training core */
  { commonName: 'Eurasian Blackcap', scientificName: 'Sylvia atricapilla', family: 'Sylviidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Garden Warbler', scientificName: 'Sylvia borin', family: 'Sylviidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Whitethroat', scientificName: 'Curruca communis', family: 'Sylviidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Lesser Whitethroat', scientificName: 'Curruca curruca', family: 'Sylviidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Chiffchaff', scientificName: 'Phylloscopus collybita', family: 'Phylloscopidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Willow Warbler', scientificName: 'Phylloscopus trochilus', family: 'Phylloscopidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Wood Warbler', scientificName: 'Phylloscopus sibilatrix', family: 'Phylloscopidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Sedge Warbler', scientificName: 'Acrocephalus schoenobaenus', family: 'Acrocephalidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Reed Warbler', scientificName: 'Acrocephalus scirpaceus', family: 'Acrocephalidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Marsh Warbler', scientificName: 'Acrocephalus palustris', family: 'Acrocephalidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Great Reed Warbler', scientificName: 'Acrocephalus arundinaceus', family: 'Acrocephalidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Grasshopper Warbler', scientificName: 'Locustella naevia', family: 'Locustellidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: "Cetti's Warbler", scientificName: 'Cettia cetti', family: 'Cettiidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-southwest', 'eu-south', 'eu-southeast', 'eu-west'] },
  { commonName: 'Zitting Cisticola', scientificName: 'Cisticola juncidis', family: 'Cisticolidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-southwest', 'eu-south', 'eu-southeast', 'eu-west'] },
  { commonName: 'Goldcrest', scientificName: 'Regulus regulus', family: 'Regulidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Firecrest', scientificName: 'Regulus ignicapilla', family: 'Regulidae', order: 'Passeriformes', continent: 'eu' },

  /* Tits, nuthatch, treecreepers */
  { commonName: 'Great Tit', scientificName: 'Parus major', family: 'Paridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Blue Tit', scientificName: 'Cyanistes caeruleus', family: 'Paridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Coal Tit', scientificName: 'Periparus ater', family: 'Paridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Marsh Tit', scientificName: 'Poecile palustris', family: 'Paridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Willow Tit', scientificName: 'Poecile montanus', family: 'Paridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Crested Tit', scientificName: 'Lophophanes cristatus', family: 'Paridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Long-tailed Tit', scientificName: 'Aegithalos caudatus', family: 'Aegithalidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Nuthatch', scientificName: 'Sitta europaea', family: 'Sittidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Treecreeper', scientificName: 'Certhia familiaris', family: 'Certhiidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Short-toed Treecreeper', scientificName: 'Certhia brachydactyla', family: 'Certhiidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-west', 'eu-central', 'eu-southwest', 'eu-south'] },

  /* Shrikes, oriole, corvids, waxwing */
  { commonName: 'Eurasian Golden Oriole', scientificName: 'Oriolus oriolus', family: 'Oriolidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Red-backed Shrike', scientificName: 'Lanius collurio', family: 'Laniidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Great Grey Shrike', scientificName: 'Lanius excubitor', family: 'Laniidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Jay', scientificName: 'Garrulus glandarius', family: 'Corvidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Magpie', scientificName: 'Pica pica', family: 'Corvidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Western Jackdaw', scientificName: 'Coloeus monedula', family: 'Corvidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Rook', scientificName: 'Corvus frugilegus', family: 'Corvidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Carrion Crow', scientificName: 'Corvus corone', family: 'Corvidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-west', 'eu-central', 'eu-southwest'] },
  { commonName: 'Hooded Crow', scientificName: 'Corvus cornix', family: 'Corvidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-east', 'eu-southeast', 'eu-north', 'eu-central'] },
  { commonName: 'Red-billed Chough', scientificName: 'Pyrrhocorax pyrrhocorax', family: 'Corvidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-west', 'eu-southwest', 'eu-south', 'eu-southeast'] },
  { commonName: 'Bohemian Waxwing', scientificName: 'Bombycilla garrulus', family: 'Bombycillidae', order: 'Passeriformes', continent: 'eu' },

  /* Sparrows, finches and buntings */
  { commonName: 'Eurasian Tree Sparrow', scientificName: 'Passer montanus', family: 'Passeridae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Chaffinch', scientificName: 'Fringilla coelebs', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Brambling', scientificName: 'Fringilla montifringilla', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'European Greenfinch', scientificName: 'Chloris chloris', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'European Goldfinch', scientificName: 'Carduelis carduelis', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Siskin', scientificName: 'Spinus spinus', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Common Linnet', scientificName: 'Linaria cannabina', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Eurasian Bullfinch', scientificName: 'Pyrrhula pyrrhula', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Hawfinch', scientificName: 'Coccothraustes coccothraustes', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'European Serin', scientificName: 'Serinus serinus', family: 'Fringillidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-southwest', 'eu-south', 'eu-southeast', 'eu-central', 'eu-west'] },
  { commonName: 'Yellowhammer', scientificName: 'Emberiza citrinella', family: 'Emberizidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Cirl Bunting', scientificName: 'Emberiza cirlus', family: 'Emberizidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-southwest', 'eu-south', 'eu-west'] },
  { commonName: 'Ortolan Bunting', scientificName: 'Emberiza hortulana', family: 'Emberizidae', order: 'Passeriformes', continent: 'eu', restrictedTo: ['eu-north', 'eu-central', 'eu-east', 'eu-southeast'] },
  { commonName: 'Reed Bunting', scientificName: 'Emberiza schoeniclus', family: 'Emberizidae', order: 'Passeriformes', continent: 'eu' },
  { commonName: 'Corn Bunting', scientificName: 'Emberiza calandra', family: 'Emberizidae', order: 'Passeriformes', continent: 'eu' },
];

/**
 * The union, curated first. `dedupeById` keeps the curated entry when an
 * addition accidentally repeats a binomial, so the curated difficulty rating
 * always wins.
 */
export const MASTER_SPECIES: readonly SpeciesSeed[] = Object.freeze(
  dedupeById([...CURATED_SPECIES, ...MASTER_ADDITIONS.map(toSpeciesSeed)]),
);

/** curated ∪ master, deduped by id. */
export function allSpecies(): readonly SpeciesSeed[] {
  return MASTER_SPECIES;
}

/**
 * Does this species turn up in this region?
 *
 * Matching runs in both directions along the region tree, which is what makes
 * "tag only the exceptions" work:
 *
 *  - Ask for `us-west` and a bird tagged `us-west` matches downwards.
 *  - Ask for `na-usa` and that same bird still matches, because `us-west` sits
 *    beneath it — choosing a country must not hide its own specialities.
 *  - Ask for `us-northeast` and it does not match, which is the whole point.
 *
 * An untagged species is available anywhere on its continent.
 */
export function occursIn(seed: SpeciesSeed, region: RegionId): boolean {
  const target = getRegion(region);
  if (!target) return false;
  if (seed.continent !== target.continent) return false;
  if (!seed.restrictedTo || seed.restrictedTo.length === 0) return true;
  return seed.restrictedTo.some((r) => isWithin(region, r) || isWithin(r, region));
}

/**
 * The drawable pool for a mode and a region, in stable order.
 *
 * `curated-500.ts` is a North American list, so asking it for a European region
 * returns nothing and the standard daily has no bird to draw. Europe's common
 * tier lives in this file instead: the European additions are the birds a
 * competent European birder knows by ear — Robin, Blackbird, Chaffinch, Great
 * Tit — with the harder siblings mixed in. Falling through to them means
 * Europe currently has one tier where North America has two, which is a gap in
 * the data rather than in the code; when a European curated list exists, delete
 * this branch.
 */
export function speciesForRegion(
  pool: 'curated' | 'master',
  region: RegionId,
  options: { beginner?: boolean } = {},
): SpeciesSeed[] {
  const source = pool === 'master' ? MASTER_SPECIES : CURATED_SPECIES;
  let matched = source.filter((seed) => occursIn(seed, region));
  if (matched.length === 0 && pool === 'curated') {
    matched = MASTER_SPECIES.filter((seed) => occursIn(seed, region));
  }

  if (!options.beginner) return matched;

  // Beginner mode narrows to the birds most observed in this region on
  // iNaturalist, ordered by that ranking rather than by taxonomy — so the first
  // birds a new player meets are the ones they have most likely already heard.
  const ranked = matched
    .map((seed) => ({ seed, rank: beginnerRank(region, seed.scientificName) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank);

  // A region whose beginner list barely overlaps the playable roster would be
  // a worse experience than no beginner mode at all; fall back to the full
  // regional pool rather than serving a handful of birds on repeat.
  if (ranked.length < MIN_BEGINNER_POOL) return matched;
  return ranked.map((entry) => entry.seed);
}

/** Below this a region's beginner list is too thin to draw from. */
const MIN_BEGINNER_POOL = 25;

/** How many birds a region can draw on, for the selection screen. */
export function speciesCountForRegion(
  pool: 'curated' | 'master',
  region: RegionId,
  options: { beginner?: boolean } = {},
): number {
  return speciesForRegion(pool, region, options).length;
}

/**
 * Puzzle rating, from how often the species is observed rather than from a
 * hand-written difficulty score.
 *
 * Observation count is real, per-region, self-updating data; a difficulty
 * column was one person's opinion frozen at authoring time. A bird nobody has
 * ranked in any region's top list is treated as a hard puzzle, which is very
 * nearly what being unranked means.
 */
export function puzzleEloFor(seed: SpeciesSeed): number {
  const rank = COMMONNESS_RANK[seed.scientificName];
  if (rank === undefined) return 1800;
  if (rank < 25) return 600;
  if (rank < 75) return 850;
  if (rank < 150) return 1100;
  return 1350;
}

const BY_ID: ReadonlyMap<string, SpeciesSeed> = new Map(
  MASTER_SPECIES.map((seed) => [seed.id, seed] as const),
);

export function findSpeciesById(id: string): SpeciesSeed | undefined {
  if (!id) return undefined;
  return BY_ID.get(id.trim().toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/**
 * Lowercase, diacritic-free, punctuation collapsed to single spaces.
 * "LeConte's Thrasher" and "Leconte s Thrasher" both fold to the same key, so
 * a player typing without the apostrophe still gets the bird.
 */
function foldKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface SearchEntry {
  seed: SpeciesSeed;
  /** "black capped chickadee" */
  common: string;
  /** "poecile atricapillus" */
  scientific: string;
  /** Word starts within the common name, plus the species epithet. */
  words: string[];
  /** Separator-free forms, so "blackcapped" still finds the bird. */
  commonTight: string;
  scientificTight: string;
}

function buildIndex(pool: readonly SpeciesSeed[]): SearchEntry[] {
  return pool.map((seed) => {
    const common = foldKey(seed.commonName);
    const scientific = foldKey(seed.scientificName);
    const words = [...common.split(' '), ...scientific.split(' ')].filter(Boolean);
    return {
      seed,
      common,
      scientific,
      words,
      commonTight: common.replace(/ /g, ''),
      scientificTight: scientific.replace(/ /g, ''),
    };
  });
}

const CURATED_INDEX: readonly SearchEntry[] = buildIndex(CURATED_SPECIES);
const MASTER_INDEX: readonly SearchEntry[] = buildIndex(MASTER_SPECIES);

/** Lower is better; -1 means no match at all. */
function rankEntry(entry: SearchEntry, query: string, tight: string): number {
  if (entry.common.startsWith(query)) return 0;
  if (entry.scientific.startsWith(query)) return 1;
  for (const word of entry.words) {
    if (word.startsWith(query)) return 2;
  }
  if (entry.commonTight.includes(tight) || entry.scientificTight.includes(tight)) return 3;
  return -1;
}

export const SEARCH_LIMIT_DEFAULT = 12;

/**
 * Typeahead over one pool. Case- and diacritic-insensitive; prefix matches on
 * the common name outrank prefix matches on the binomial, which outrank
 * interior-word matches, which outrank plain substrings. Ties resolve
 * alphabetically so the same query always returns the same order.
 */
export function searchSpecies(
  q: string,
  pool: 'curated' | 'master',
  limit: number = SEARCH_LIMIT_DEFAULT,
): SpeciesSeed[] {
  const query = foldKey(q ?? '');
  if (!query) return [];

  const max = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : SEARCH_LIMIT_DEFAULT;
  if (max === 0) return [];

  const tight = query.replace(/ /g, '');
  const index = pool === 'curated' ? CURATED_INDEX : MASTER_INDEX;

  const hits: { entry: SearchEntry; rank: number }[] = [];
  for (const entry of index) {
    const rank = rankEntry(entry, query, tight);
    if (rank >= 0) hits.push({ entry, rank });
  }

  hits.sort(
    (a, b) =>
      a.rank - b.rank || a.entry.seed.commonName.localeCompare(b.entry.seed.commonName, 'en'),
  );

  return hits.slice(0, max).map((hit) => hit.entry.seed);
}
