# Song Quest

**A birdsong identification game for people who already know their *Empidonax* from their *Contopus*.**

You hear a bird. You have four attempts to name it. Each attempt you miss opens
another drawer of the field guide — first the range map, then the taxonomy, then
a blurred plate and a redacted description. Guess on the first note and you keep
the whole ten thousand points; guess on the fourth and you keep a quarter of
what the clock left you.

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
| Master | **612 species** | The curated pool plus scarcer North American breeders, the sibling-species problems (*Empidonax*, *Catharus*, rosy-finches, scaup, crossbills, the grass sparrows), and Europe / the western Palearctic. |

Scope is deliberately Holarctic. Tropical regions were considered and dropped:
Xeno-canto's coverage there is thin enough that a species often has a song but
no call and no alarm recording, and a puzzle that cannot fill all three audio
slots is not playable.

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
| 4 | **Visual** | A heavily blurred photograph plus the Wikipedia description with every giveaway word struck out. |

**Redaction** is server-side and thorough: the common name, the binomial, the
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

All three upstreams are queried **server-side only**, through route handlers, so
no key ever reaches the browser and there are no CORS surprises.

| Source | Used for | Licence |
|---|---|---|
| [Xeno-canto](https://xeno-canto.org) | Song, call and alarm recordings | Per-recording; Song Quest hard-filters to **CC BY** and **CC0** only |
| [iNaturalist](https://www.inaturalist.org) | Taxonomy, photographs, Wikipedia summaries | CC-licensed observations, credit rendered per photo |
| [GBIF](https://www.gbif.org) | Occurrence-density range tiles | [GBIF terms](https://www.gbif.org/terms) — open data |
| [CARTO](https://carto.com/attributions) / [OpenStreetMap](https://www.openstreetmap.org/copyright) | Label-free base map tiles | ODbL, attribution required and rendered on the map |
| [Wikipedia](https://www.wikipedia.org) | Species descriptions (via iNaturalist) | CC BY-SA |

The licence filter on audio is applied **twice** — once in the upstream query
and once again on the parsed response — because a game that ships a
non-commercial clip under a permissive banner is a licence violation, not a bug.
`nc`, `nd` and `sa` variants are discarded even if the API returns them.

---

## Getting set up

### 1. Install Node.js — start here

**This project needs a Node runtime, and a fresh Windows machine does not have
one.** Nothing below works until this step is done.

Open PowerShell and run:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then **close and reopen your terminal** so the new `PATH` takes effect, and
confirm it worked:

```powershell
node --version   # expect v20.x or newer
npm --version    # expect 10.x or newer
```

If `winget` itself is missing (Windows 10 without App Installer), download the
LTS installer from <https://nodejs.org/en/download> and run it instead. On macOS,
`brew install node`; on Debian/Ubuntu, use
[nodesource](https://github.com/nodesource/distributions).

### 2. Install dependencies

From the project root:

```powershell
npm install
```

### 3. Configure the environment (optional)

```powershell
copy .env.example .env.local
```

The only variable is `XENO_CANTO_API_KEY`, and it is **required**. Without it no
audio can be fetched and no round will start — the home page and stats render,
but every puzzle fails to load.

There is no keyless fallback. Xeno-canto retired its unauthenticated v2 API (it
now returns 404 for every query, whatever the syntax) and the current v3 API
answers 401 without a key; both were verified against the live service. A key is
free — register at <https://xeno-canto.org/> and copy it from your account page.

Everything else — iNaturalist, GBIF, CARTO — is keyless.

`.env.local` is git-ignored. Never prefix the key with `NEXT_PUBLIC_`; it is
read only inside route handlers.

### 4. Run it

Double-click **`play.bat`**, or from a terminal:

```powershell
npm run dev
```

Open <http://localhost:3000>.

`play.bat` does the same thing with the sharp edges filed off: it adds Node to
`PATH` for shells opened before Node was installed, installs dependencies on
first run, warns if `XENO_CANTO_API_KEY` is missing or blank — the failure that
otherwise looks like a broken game rather than a missing credential — and opens
a browser tab, unless port 3000 is already taken, in which case it leaves the
tab alone and lets you read the real port off the log.

### Available scripts

| Script | Does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | ESLint via `next lint` |
| `npm run typecheck` | `tsc --noEmit` — strict, no emit |

---

## How it is built

- **Next.js 15 (App Router) + React 19 + TypeScript 5.6, `strict: true`.**
- **Plain CSS**: a token layer in `src/app/globals.css` plus co-located CSS
  Modules. No Tailwind — utility classes fight the field-guide detailing.
- **Leaflet 1.9 used directly**, not through `react-leaflet`, and imported with
  `await import('leaflet')` inside `useEffect` because it touches `window` at
  module scope.
- **React Context + `useReducer`** for round state. The reducer is pure —
  timestamps arrive on the action, never from `Date.now()` inside.
- **Route handlers as the only network seam.** `/api/audio` is an explicit
  allow-list proxy restricted to `xeno-canto.org`, which keeps it from becoming
  an open relay while still letting the browser scrub through a clip via
  forwarded `Range` headers.
- **`localStorage`, versioned and migrated.** No accounts, no backend.

### File tree

```
songquest/
├── .env.example                  required XENO_CANTO_API_KEY
├── .gitignore
├── next.config.mjs               remote image hosts for iNaturalist
├── next-env.d.ts
├── package.json
├── tsconfig.json                 strict; "@/*" → "./src/*"
├── README.md
├── docs/
│   └── ARCHITECTURE.md           the binding build contract
└── src/
    ├── app/
    │   ├── globals.css           the design-token contract
    │   ├── layout.tsx            root layout, fonts, skip link, footer
    │   ├── page.tsx              title lockup + four mode cards
    │   ├── play/
    │   │   └── [mode]/
    │   │       └── page.tsx      validates the mode, mounts GameProvider
    │   ├── stats/
    │   │   └── page.tsx          rank, streak, distribution, history strip
    │   └── api/
    │       ├── species/route.ts  GET ?id= | ?name=  → SpeciesDossier
    │       ├── daily/route.ts    GET ?mode=         → { date, species }
    │       ├── search/route.ts   GET ?q=&pool=      → SpeciesOption[]
    │       └── audio/route.ts    GET ?src=          → streamed audio bytes
    ├── components/
    │   ├── ui/                   Button, Panel, FieldLabel, Seal,
    │   │                         AvatarFrame, Skeleton
    │   ├── game/                 GameBoard, AttemptTracker, GuessInput,
    │   │                         CountdownTimer, HintStage
    │   ├── audio/                AudioClipPlayer, Waveform
    │   ├── map/                  RangeMap, mapConfig
    │   └── species/              SpeciesCard, BlurredPhoto,
    │                             TaxonomyPanel, RedactedText
    ├── data/
    │   ├── curated-500.ts        the approachable pool
    │   └── master-list.ts        the superset, plus search helpers
    ├── lib/
    │   ├── cache.ts              TTL map with in-flight de-duplication
    │   ├── modes.ts              MODES, MODE_ORDER, getMode
    │   ├── api/
    │   │   ├── xenocanto.ts      clip lookup + hard licence filter
    │   │   ├── inaturalist.ts    taxa, photos, Wikipedia summaries
    │   │   ├── gbif.ts           taxon keys and density tile URLs
    │   │   └── speciesService.ts parallel dossier assembly
    │   ├── game/
    │   │   ├── scoring.ts        the formula above
    │   │   ├── elo.ts            expectedScore, updateElo
    │   │   ├── ranks.ts          13 tiers, 600 → 2400
    │   │   ├── daily.ts          date hash, mulberry32, pickDailyIndex
    │   │   ├── matching.ts       normalise, Damerau-Levenshtein
    │   │   └── redact.ts         [REDACTED] substitution
    │   └── storage/
    │       ├── persistence.ts    load/save/reset, corruption-tolerant
    │       └── stats.ts          streaks, win rate, averages
    ├── state/
    │   ├── gameReducer.ts        pure reducer + initial state
    │   └── GameContext.tsx       provider, countdown, useGame()
    └── types/
        ├── domain.ts             the canonical shared types
        ├── xenocanto.ts          upstream response shapes
        └── inaturalist.ts        upstream response shapes
```

---

## Design

Vintage scientific field guide meets *Wingspan*. Parchment, sage, clay, slate
and burgundy; hairline rules and doubled borders; engraved small-caps labels;
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
attempt pips carry a glyph as well as a hue. `prefers-reduced-motion` is
honoured globally and mirrored by an in-game setting.

---

## Licence and attribution obligations

Song Quest's own source is MIT. **The data it renders is not, and the obligations
travel with it.** If you fork, deploy or modify this project you inherit them:

1. **Xeno-canto recordings — CC BY / CC0.** Every clip must display its
   recordist, catalogue number and licence wherever it is played. The
   attribution block on the species card and the credit line under each player
   are not decoration; removing them breaks the licence. Do not widen the filter
   to `NC`, `ND` or `SA` recordings — those cannot be redistributed on the terms
   this project assumes.
2. **iNaturalist photographs.** Each photo carries its own CC licence and
   photographer. The credit shown beneath the plate must survive any redesign.
3. **Wikipedia text — CC BY-SA.** Descriptions link back to the source article.
   Keep the link; the share-alike term applies to the text, not to this codebase.
4. **OpenStreetMap — ODbL.** The base map attribution control must remain
   visible on the map. Do not hide it with CSS.
5. **CARTO base tiles.** Free for this scale of use under CARTO's attribution
   terms; heavy or commercial traffic needs your own tile plan.
6. **GBIF occurrence data.** Cite GBIF as the source of range density. If you
   publish analysis derived from it, use a proper GBIF citation with a download
   DOI.
7. **Rate limits are a courtesy obligation too.** These are volunteer-funded
   and grant-funded services. The server-side cache exists so a popular deploy
   does not hammer them — keep it, and do not move these calls into the browser.

Contributors' recordings are the entire reason this game exists. Credit them
loudly.
