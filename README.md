# Song Quest

**A birdsong identification game for people who already know their *Empidonax* from their *Contopus*.**

### ▶ Play it: **https://mgdlg.github.io/songquest/**

You hear a bird. You have four attempts to name it. Each attempt you miss opens
another drawer of the field guide — first the range map, then the taxonomy, then
a sharper look at the plate, which is fully revealed on the fourth. Guess on the
first note and you keep the whole ten thousand points; guess on the fourth and
you keep a quarter of what the clock left you.

Every recording, photograph and distribution map in the game is Creative
Commons or open data, credited in-product, because that is the licence term and
not a nicety.

---

## The four modes

| Mode | Puzzle | Clips on attempt 1 | Clock | Pool | Counts toward stats |
|---|---|---|---|---|---|
| **Daily Standard** | One bird a day, identical for every player worldwide | All three — song, call, alarm | Untimed | Curated | Yes — streak, distribution, Elo |
| **Daily Hardcore** | A *different* bird a day, drawn from the deep pool | One — song only | **15 s per attempt** | Master | Yes — separate streak |
| **Practice Standard** | Endless random birds | All three | Untimed | Curated | No |
| **Practice Hardcore** | Endless, with the hardcore constraints | One | 15 s per attempt | Master | No |

The daily puzzle is derived, not served: a seeded PRNG (`mulberry32`) is keyed
off the UTC date, so every device computes the same index with no server and no
sync. Hardcore salts the same hash with `'hardcore'`, which is why it draws a
different bird on the same date.

Practice modes never touch the persisted streak or guess distribution — you can
grind *Empidonax* for an hour without putting a daily record at risk.

### The two pools

| Pool | Size | Scope |
|---|---|---|
| Curated | **294 species** | Common, widespread North American breeders a competent birder can name by ear. |
| Master | **611 species** | The curated pool plus scarcer North American breeders, the sibling-species problems (*Empidonax*, *Catharus*, rosy-finches, scaup, crossbills, the grass sparrows), and Europe / the western Palearctic. |

The roster lists 612; one is deliberately unplayable. Xeno-canto withholds
downloads for **Spotted Owl** — a restricted species, protected from recordings
being used to lure or disturb birds — and Song Quest respects that rather than
working around it.

Each bird plays whichever of song, call and alarm genuinely exist for it, as
distinct recordings. Many species have no catalogued alarm call, and those
rounds simply open with fewer clips.

Scope is deliberately Holarctic. Tropical regions were considered and dropped:
Xeno-canto's coverage there is thin enough that many species have too few openly
licensed recordings to make a fair puzzle.

`curated-500.ts` is named for its original target, not its contents. Every
binomial in both files is real and follows current AOS/IOC placement, which
mattered more than reaching a round number — an invented species or a warbler
filed under the wrong family is the one error this audience notices instantly.

---

## The progressive hint system

Four attempts map one-to-one onto four hint stages. A stage unlocks when the
attempt before it is consumed, whether by a wrong guess, a skip, or a timeout.
Earlier stages stay on screen; the guide only ever opens further.

| Attempt | Stage | What you get |
|---|---|---|
| 1 | **Audio** | The recording(s). Song, call and alarm in standard; song alone in hardcore. Recordist and licence shown from the first second. |
| 2 | **Geography** | A GBIF occurrence-density range map over a label-free base map, styled as a printed distribution plate. |
| 3 | **Taxonomy** | Order, family and genus in a ruled table. Never the species — that would be the answer. |
| 4 | **Visual** | The photograph, fully revealed, plus the Wikipedia description with every giveaway word struck out. |

The field-marks plate is docked beside the board from the first attempt, blurred
heavily and sharpening with each attempt spent, until the fourth hands it over.

**Redaction** happens when the data is generated, and is thorough: the common name, the binomial, the
genus alone, the epithet alone, and every individual word of the common name
longer than three characters that is not a generic bird word (`bird`, `species`,
`family`, `genus`, `north`, `american`, `common`, `greater`, `lesser`). Each
becomes a black bar. "A medium-sized [REDACTED] of open country" is as much help
as you get.

**Guess matching** is forgiving about typing and unforgiving about ornithology.
Guesses are normalised — lowercased, diacritics stripped, hyphens and
apostrophes dropped, whitespace collapsed — and accepted against either the
common or the scientific name within an edit distance of one per eight
characters. So `scissor tailed flycatchr` lands, and `Willow Flycatcher` will
never be accepted for an Alder.

---

## Scoring

```
base        = 10 000
multiplier  = 1.00  solved on attempt 1
              0.75  solved on attempt 2
              0.50  solved on attempt 3
              0.25  solved on attempt 4
              0.00  never solved

seconds     = floor(elapsedMs / 1000)          clock starts on FIRST PLAY,
                                               not on page load

total       = max(0, round(base × multiplier) − seconds × 10)
```

The time penalty is applied **after** the multiplier, so a slow fourth-attempt
save is worth very little and a fast first-attempt call is worth nearly
everything. The total is clamped at zero — you can run the clock down to nothing
but never into debt.

### Rank and Elo

Results feed a personal Elo rating. A puzzle's Elo comes from its seeded
difficulty (`600 + (difficulty − 1) × 400`); the outcome fed to the update is
the same 1 / 0.75 / 0.5 / 0.25 / 0 ladder as the score multiplier. The K-factor
is 40 for your first twenty games, then 24, then 16 once you pass 2100 — so
early rounds place you quickly and later ones move you slowly.

Thirteen tiers span 600 → 2400 in 150-point steps:

**Fledgling III–I → Novice Birder III–I → Field Guide III–I → Master Birder III–I → Ornithologist** (2400+).

Streaks, guess distribution, win rate, average score and a 365-day history strip
all live in `localStorage` under `songquest.v1`. There is no account and no
backend; clearing site data is a factory reset.

---

## Data sources

| Source | Used for | Licence |
|---|---|---|
| [Xeno-canto](https://xeno-canto.org) | Song, call and alarm recordings | Per recording; Song Quest accepts CC0 and CC BY, BY-SA, BY-NC and BY-NC-SA, and refuses anything NoDerivatives |
| [iNaturalist](https://www.inaturalist.org) | Taxonomy, photographs, Wikipedia summaries | Per photo, same policy as audio; all-rights-reserved photos are refused |
| [GBIF](https://www.gbif.org) | Occurrence-density range tiles and range extents | [GBIF terms](https://www.gbif.org/terms) — open data |
| [CARTO](https://carto.com/attributions) / [OpenStreetMap](https://www.openstreetmap.org/copyright) | Label-free base map tiles | ODbL, attribution rendered on the map |
| [Wikipedia](https://www.wikipedia.org) | Species descriptions (via iNaturalist) | CC BY-SA |

**Why non-commercial is allowed.** Plain CC BY barely exists on Xeno-canto: of
roughly 25,000 song recordings surveyed across twelve species, 25 were plain CC BY
and none of those were North American. The catalogue is overwhelmingly CC BY-NC-SA,
so **Song Quest is a non-commercial project**, and any deployment of it must stay
non-commercial. NoDerivatives recordings are still refused, so clips can be trimmed
in future without a licence problem.

The licence check runs on every parsed record rather than trusting the upstream
query, because a licence breach in a shipped game should not depend on an API
filter behaving.

---

## How it works: a static site

Song Quest has **no server**. It is plain HTML, JavaScript and JSON, served by
GitHub Pages.

That is a deliberate constraint, and it shapes one thing above all: **the
Xeno-canto API key never reaches a browser.** A static host cannot keep a secret —
anything shipped to the page can be read in devtools. So the catalogue is queried
once, ahead of time, on a machine that holds the key, and the results are
committed as static files:

```
scripts/generate-dossiers.ts  ──►  public/data/species/<id>.json   (one per bird)
          (needs the API key)  ──►  src/data/generated/playable.ts  (which birds have one)
```

The deployed site reads only those files. Audio, photographs and map tiles are
then loaded straight from Xeno-canto, iNaturalist, GBIF and CARTO, all of which
allow cross-origin use. The daily bird is computed in the browser from the UTC
date and your region, so every player birding the same place gets the same bird
with no shared state.

The trade-off is that the species data is a **snapshot**. Recordings and photos
are stable URLs and do not go stale quickly, but refreshing means re-running the
generator and pushing.

---

## Playing locally

### 1. Install Node.js

A fresh Windows machine has no Node runtime. In PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then **close and reopen your terminal** so the new `PATH` takes effect. On macOS,
`brew install node`; elsewhere, see <https://nodejs.org/en/download>.

### 2. Run it

Double-click **`play.bat`**, or:

```powershell
npm install
npm run dev
```

and open <http://localhost:3000>. **No API key is needed to play** — the bird data
is already in the repository.

`play.bat` adds Node to `PATH` for shells opened before it was installed, installs
dependencies on first run, checks the bird data is present, and opens a browser
tab. If port 3000 is already in use it assumes the game is running and opens that,
rather than starting a second server: two dev servers share one `.next` build
directory and corrupt each other.

### Available scripts

| Script | Does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Static export to `out/` |
| `npm run lint` | ESLint via `next lint` |
| `npm run typecheck` | `tsc --noEmit` — strict, no emit |
| `npx tsx scripts/generate-dossiers.ts` | Regenerate bird data (needs an API key) |
| `node --experimental-strip-types scripts/generate-beginner-pools.ts` | Regenerate beginner pools from iNaturalist |

---

## Refreshing the bird data

Only needed to add species or pick up new recordings.

1. Get a free Xeno-canto API key: register at <https://xeno-canto.org/> and copy it
   from your account page. There is no keyless fallback — Xeno-canto's v2 API is
   retired and v3 answers 401 without a key.
2. Put it in `.env.local` (git-ignored — never commit it):
   ```
   XENO_CANTO_API_KEY=your-key-here
   ```
3. Run the generator. It is resumable, so an interrupted run picks up where it
   stopped; `--force` rebuilds everything.
   ```powershell
   npx tsx scripts/generate-dossiers.ts
   ```
   A full run takes around half an hour. iNaturalist hard-limits clients to 100
   requests a minute, and the generator spaces its calls to stay well under that.
4. Commit `public/data/` and `src/data/generated/playable.ts`, and push.

The generator treats the roster as authoritative for names. iNaturalist's preferred
common name often differs — it calls *Larus argentatus* "European Herring Gull" —
and autocomplete offers the roster's name, so the two must agree or a correct pick
from the suggestion list would be marked wrong.

---

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`, which builds the static
site and publishes it to GitHub Pages. It uses no secrets: the data is already
committed.

The site is served under `/songquest/`, so the build sets `PAGES_BASE_PATH`, which
`next.config.mjs` applies to every route and asset. Locally it is unset and the game
runs at the root of `localhost`.

---

## How it is built

- **Next.js 15 (App Router) + React 19 + TypeScript, `strict: true`**, exported as a
  fully static site (`output: 'export'`).
- **Plain CSS**: a token layer in `src/app/globals.css` plus co-located CSS Modules.
- **Leaflet 1.9 used directly**, imported inside `useEffect` because it touches
  `window` at module scope.
- **React Context + `useReducer`** for round state. The reducer is pure — timestamps
  arrive on the action, never from `Date.now()` inside.
- **`localStorage`** for rank, streaks and history. No accounts, no backend.

### File tree

```
songquest/
├── .github/workflows/deploy.yml   builds and publishes to GitHub Pages
├── .env.example                   XENO_CANTO_API_KEY, needed only to regenerate data
├── next.config.mjs                static export + base path
├── play.bat                       one-click local launcher (Windows)
├── docs/ARCHITECTURE.md           the original build contract
├── scripts/
│   ├── generate-dossiers.ts       queries every source, writes public/data/
│   └── generate-beginner-pools.ts most-observed birds per region
├── public/data/species/           one pre-built dossier per playable bird
└── src/
    ├── app/
    │   ├── globals.css            the design-token contract
    │   ├── layout.tsx             root layout, fonts, footer
    │   ├── page.tsx               region picker over a clickable map
    │   ├── solo/page.tsx          daily / practice, beginner and hardcore
    │   ├── play/[mode]/page.tsx   the four modes, pre-rendered
    │   └── stats/page.tsx         rank, streaks, distribution, history
    ├── components/
    │   ├── game/                  GameBoard, HintStage, GuessInput, timers
    │   ├── audio/                 AudioClipPlayer, Waveform
    │   ├── map/                   RangeMap for the distribution clue
    │   ├── region/                RegionMap for the region picker
    │   ├── species/               SpeciesCard, BlurredPhoto, TaxonomyPanel
    │   └── ui/                    Button, Panel, Seal, Skeleton
    ├── data/
    │   ├── curated-500.ts         the common North American roster
    │   ├── master-list.ts         full roster, region filtering, search
    │   └── generated/             beginner pools, playable ids
    ├── lib/
    │   ├── regions.ts             region tree and map polygons
    │   ├── paths.ts               base-path-aware URLs for static files
    │   ├── modes.ts               the four mode configs
    │   ├── api/                   build-time only: Xeno-canto, iNaturalist,
    │   │                          GBIF and dossier assembly
    │   ├── game/                  scoring, Elo, ranks, daily draw, matching,
    │   │                          redaction
    │   └── storage/               localStorage: progress, region, beginner
    ├── state/                     reducer and GameContext
    └── types/                     domain and upstream response types
```

---

## Design

Vintage scientific field guide meets *Wingspan*, on a plain white ground. Sage,
clay, slate and burgundy accents; hairline rules and doubled borders; engraved small-caps labels;
reveals that settle rather than bounce. **Instrument Serif** names and titles
things, **Times New Roman** explains them, and binomials are always italic
burgundy.

Every colour, size, duration and font stack is a custom property in
`globals.css`. Component stylesheets reference `var(--token)` and never a hex
value — the whole look can be re-keyed from one file.

Accessibility is a build requirement, not a pass at the end: every control is
reachable and labelled, hint reveals announce through `aria-live="polite"`, the
countdown is a `role="timer"`, the typeahead is a full `role="combobox"` with
`aria-activedescendant`, and no state is ever conveyed by colour alone — the
attempt pips carry a glyph as well as a hue. The operating system's
`prefers-reduced-motion` setting is honoured throughout.

---

## Licence and attribution obligations

**The source code has no licence yet.** That means all rights are reserved: you are
welcome to read it and play the game, but not to copy, modify or redistribute the
code.

**The data the game renders has its own licences, and those obligations apply
regardless.** They are why the credits in the game are not decoration:

1. **Xeno-canto recordings — CC BY, BY-SA, BY-NC, BY-NC-SA or CC0, per recording.**
   Every clip displays its recordist, catalogue number and licence wherever it plays.
   Because most recordings are **NonCommercial**, Song Quest and any deployment of it
   must remain non-commercial. NoDerivatives recordings are refused.
2. **iNaturalist photographs.** Each carries its own Creative Commons licence and
   photographer, shown beneath the plate. All-rights-reserved photos are refused.
3. **Wikipedia text — CC BY-SA.** Species descriptions are stored in the
   pre-generated data under `public/data/`, and that text remains CC BY-SA whatever
   happens to the code. The species card credits Wikipedia and links the article.
4. **OpenStreetMap — ODbL.** The base-map attribution stays visible on every map.
5. **CARTO base tiles.** Used under CARTO's free attribution terms; heavy traffic
   would need a tile plan of its own.
6. **GBIF occurrence data.** Credited as the source of range density on the map.
7. **Rate limits are a courtesy obligation too.** These are volunteer- and
   grant-funded services. The generator spaces its requests, and the deployed site
   never calls their APIs at all — keep it that way.

The recordists are the entire reason this game exists. Credit them loudly.
