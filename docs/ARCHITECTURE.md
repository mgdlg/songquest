# SONG QUEST — Architecture & Build Contract

> A bird-song identification game for people who already know their *Empidonax* from
> their *Contopus*. Vintage field-guide typography, Wingspan-grade tactility,
> Creative-Commons data end to end.

This document is the **binding contract** between modules. Implementers work in
parallel and cannot see each other's files, so every cross-module symbol is
specified here with its exact name and signature. If the spec and your instinct
disagree, follow the spec — a compiling seam beats a nicer API.

---

## 0. Stack decisions (settled — do not substitute)

| Concern | Decision | Why |
|---|---|---|
| Framework | **Next.js 15, App Router, React 19** | Route handlers give us a server-side proxy for CORS-blocked audio and API keys. |
| Language | **TypeScript 5.6+, `strict: true`** | |
| Styling | **Plain CSS: `globals.css` tokens + CSS Modules** | No Tailwind. The look is bespoke; utility classes fight the field-guide detailing. |
| Maps | **Leaflet 1.9 directly**, no `react-leaflet` | Avoids the React-19 peer-dependency churn. Leaflet is imported dynamically inside `useEffect` because it touches `window` at module scope. |
| State | **React Context + `useReducer`** | No Redux. One round at a time; the reducer is small and testable. |
| Fonts | `next/font/google` for **Instrument Serif**; Times New Roman is a system font | |
| Data fetching | Server route handlers → client `fetch` | Never call Xeno-canto or iNaturalist from the browser: no keys client-side, no CORS surprises, and one cache to rule them. |
| Persistence | `localStorage`, versioned + migrated | No backend, no accounts. |

**No Node runtime exists on the build machine.** Nothing can be `npm install`ed or
type-checked during authoring. Code must be correct by construction: no invented
package APIs, no "I'll fix the import later".

---

## 1. Canonical files — already written, treat as read-only

| File | Contents |
|---|---|
| `src/types/domain.ts` | Every shared type. **Import from here; never redeclare.** |
| `src/app/globals.css` | Every design token. **Use `var(--token)`; never hard-code a colour, size, duration, or font stack.** |

Read both before writing anything.

---

## 2. File ownership

Each agent owns its listed paths **exclusively**. Do not create, edit, or even
stub a file owned by someone else — a missing import at review time is expected
and fine; a duplicate definition is a merge conflict.

| # | Agent | Owns |
|---|---|---|
| 1 | SCAFFOLD | `package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `.gitignore`, `.env.example`, `README.md`, `src/app/layout.tsx` |
| 2 | API-CLIENTS | `src/types/xenocanto.ts`, `src/types/inaturalist.ts`, `src/lib/api/xenocanto.ts`, `src/lib/api/inaturalist.ts`, `src/lib/api/gbif.ts`, `src/lib/cache.ts` |
| 3 | SERVICE-ROUTES | `src/lib/api/speciesService.ts`, `src/app/api/species/route.ts`, `src/app/api/daily/route.ts`, `src/app/api/audio/route.ts`, `src/app/api/search/route.ts` |
| 4 | GAME-LOGIC | `src/lib/game/scoring.ts`, `elo.ts`, `ranks.ts`, `daily.ts`, `matching.ts`, `redact.ts`, `src/lib/modes.ts` |
| 5 | STATE | `src/state/gameReducer.ts`, `src/state/GameContext.tsx`, `src/lib/storage/persistence.ts`, `src/lib/storage/stats.ts` |
| 6 | DATA | `src/data/curated-500.ts`, `src/data/master-list.ts` |
| 7 | UI-KIT | `src/components/ui/*` |
| 8 | GAMEPLAY-UI | `src/components/game/*` |
| 9 | AUDIO-UI | `src/components/audio/*` |
| 10 | MAP | `src/components/map/*` |
| 11 | SPECIES-CARD | `src/components/species/*` |
| 12 | PAGES | `src/app/page.tsx`, `src/app/play/[mode]/page.tsx`, `src/app/stats/page.tsx`, and their co-located `.module.css` |

---

## 3. Module contracts

Signatures below are **exact**. Match names, parameter order, and return types.

### 3.1 `src/lib/cache.ts` — API-CLIENTS

```ts
export function cacheGet<T>(key: string): T | null;
export function cacheSet<T>(key: string, value: T, ttlMs: number): void;
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
export const TTL: { readonly SPECIES: number; readonly SEARCH: number; readonly DAILY: number };
```

Module-scope `Map` with expiry stamps, capped at 500 entries (evict oldest on
overflow). `cached()` must **de-duplicate in-flight requests** — two concurrent
calls for the same key issue one upstream fetch. Server-side only; it is a
per-instance warm cache, not a correctness guarantee.

### 3.2 `src/lib/api/xenocanto.ts` — API-CLIENTS

```ts
export interface ClipQuery { scientificName: string; kind: ClipKind; }

/** Best CC-BY recording for the species + vocalisation type, or null. */
export function fetchClip(q: ClipQuery): Promise<XcRecording | null>;

/** All three kinds in parallel; individual failures degrade to null. */
export function fetchClipSet(scientificName: string): Promise<Record<ClipKind, XcRecording | null>>;

export function toAudioCredit(rec: XcRecording): AudioCredit;
```

- Base URL `https://xeno-canto.org/api/3/recordings`, query param `key` from
  `process.env.XENO_CANTO_API_KEY`. **The key is required and there is no
  fallback.** An earlier revision of this spec called for degrading to the v2
  endpoint; that was verified against the live service and is wrong — v2 is
  retired and returns 404 for every query, v3 returns 401 without a key. When
  the key is missing, short-circuit before issuing any request and log one
  actionable line; do not emit a request per clip.
- Query grammar: `gen:"Genus" sp:"species" type:song q:">C" lic:"BY"`.
  Note `sp:` is the **specific epithet**, not the binomial — passing
  `sp:"Genus species"` matches nothing.
  - `song` → `type:song`
  - `call` → `type:call`
  - `alarm` → `type:alarm` (fall back to `type:"territorial call"`, then plain
    `type:call`, so a clip always exists where one plausibly can).
- **Licence filter is a hard requirement.** After parsing, re-check each record's
  `lic` field and discard anything that is not CC BY or CC0 — reject `nc`, `nd`,
  and `sa` variants. Never trust the upstream filter alone.
- Rank survivors by quality grade (A > B > C), then prefer 5–35 s duration,
  then higher `//xeno-canto.org` download availability. Return the top one.
- Audio URL: use the record's `file` field, then rewrite it to our proxy —
  see §3.3 `/api/audio`.

### 3.3 Route handlers — SERVICE-ROUTES

All handlers live under `src/app/api/`. Node runtime (`export const runtime = 'nodejs'`).

| Route | Method | Query | Returns |
|---|---|---|---|
| `/api/species` | GET | `?id=<inatTaxonId>` or `?name=<scientificName>` | `SpeciesDossier` |
| `/api/daily` | GET | `?mode=daily-standard\|daily-hardcore` | `{ date: string; species: SpeciesDossier }` |
| `/api/search` | GET | `?q=<prefix>&pool=curated\|master` | `SpeciesOption[]`, max 12 |
| `/api/audio` | GET | `?src=<encoded upstream url>` | audio bytes, streamed |

`/api/audio` is security-sensitive: **allow-list the upstream host** to
`xeno-canto.org` and `*.xeno-canto.org` only, reject anything else with 400.
This prevents the route becoming an open proxy. Stream the upstream body
through, forward `Content-Type` and `Accept-Ranges`, set
`Cache-Control: public, max-age=86400, immutable`, and pass the `Range` header
upstream so scrubbing works.

**Redaction happens server-side.** `/api/species` and `/api/daily` return
`descriptionSnippet` already redacted. `descriptionFull` is also included — this
is a single-player game with no anti-cheat pretence, and shipping both avoids a
second round-trip on resolution. Note the tradeoff in a comment; do not "fix" it
by adding a second endpoint.

### 3.4 `src/lib/api/speciesService.ts` — SERVICE-ROUTES

```ts
export function buildDossier(input: { inatTaxonId?: number; scientificName?: string }): Promise<SpeciesDossier>;
export function resolveTaxon(scientificName: string): Promise<InatTaxon | null>;
```

Fan out to iNaturalist (taxonomy + photo + Wikipedia summary), Xeno-canto
(three clips), and GBIF (tile URL) **in parallel** via `Promise.allSettled`.
A failed photo or a missing alarm clip must not fail the whole dossier —
degrade to empty string / null and let the UI handle absence. A missing
*song* clip is fatal; throw, because there is no game without audio.

### 3.5 `src/lib/game/scoring.ts` — GAME-LOGIC

```ts
export const BASE_SCORE = 10_000;
export const ATTEMPT_MULTIPLIERS: Readonly<Record<AttemptNumber, number>> =
  { 1: 1.0, 2: 0.75, 3: 0.5, 4: 0.25 };
export const TIME_PENALTY_PER_SECOND = 10;

export function computeScore(args: {
  solvedOnAttempt: AttemptNumber | null;
  elapsedMs: number;
}): ScoreBreakdown;
```

Rules: a loss (`solvedOnAttempt === null`) scores 0 with multiplier 0. Seconds
are `Math.floor(elapsedMs / 1000)`. Penalty applies **after** the multiplier:
`total = max(0, round(BASE * multiplier) - seconds * 10)`. Clamp at 0.

### 3.6 `src/lib/game/daily.ts` — GAME-LOGIC

```ts
export function todayKey(now?: Date): string;              // "2026-08-02", UTC
export function hashDate(dateKey: string, salt?: string): number;
export function mulberry32(seed: number): () => number;
export function pickDailyIndex(dateKey: string, poolSize: number, salt?: string): number;
```

Determinism is the whole point: same UTC date → same index on every device, no
server needed. Hardcore uses `salt = 'hardcore'` so it draws a *different* bird
than standard on the same date. Pure functions, no `Date.now()` inside except
via the optional `now` parameter.

### 3.7 `src/lib/game/matching.ts` — GAME-LOGIC

```ts
export function normalise(s: string): string;
export function isCorrectGuess(guess: string, species: { commonName: string; scientificName: string }): boolean;
export function damerauLevenshtein(a: string, b: string): number;
```

`normalise`: lowercase, strip diacritics (`NFD` + combining-mark regex),
collapse whitespace, drop hyphens and apostrophes. A guess is correct if it
normalises to the common name, the scientific name, or is within an edit
distance of 1 per 8 characters (so "Scissor-tailed Flycatcher" tolerates a
typo but "Willow Flycatcher" never matches "Alder Flycatcher").

### 3.8 `src/lib/game/redact.ts` — GAME-LOGIC

```ts
export function redactDescription(text: string, species: { commonName: string; scientificName: string }): string;
```

Replace, case-insensitively: the full common name, the full binomial, the genus
alone, the species epithet alone, and each individual word of the common name
that is longer than three characters and not a generic bird word
(`bird, species, family, genus, north, american, common, greater, lesser`).
Replacement token is the literal string `[REDACTED]`. Guard every interpolation
into a `RegExp` with an escape helper — species names contain `.` and `-`.

### 3.9 `src/lib/game/ranks.ts` + `elo.ts` — GAME-LOGIC

```ts
// ranks.ts
export const RANK_TIERS: readonly RankTier[];             // 13 entries, ascending
export function rankForElo(elo: number): RankTier;
export function eloRangeForRank(tier: RankTier): { min: number; max: number };
export function rankProgress(elo: number): { tier: RankTier; next: RankTier | null; pct: number };

// elo.ts
export function expectedScore(playerElo: number, puzzleElo: number): number;
export function updateElo(args: {
  playerElo: number; puzzleElo: number; outcome: number; gamesPlayed: number;
}): number;
```

Ranks span 600 → 2400 Elo across 12 tiers of 150 points; `Ornithologist` is
2400+. `outcome` is 0–1 (1 = solved on attempt 1, 0.75/0.5/0.25 by attempt, 0
for a loss). K-factor: 40 for the first 20 games, then 24, then 16 above 2100.

### 3.10 `src/lib/modes.ts` — GAME-LOGIC

```ts
export const MODES: Readonly<Record<GameMode, ModeConfig>>;
export function getMode(id: string): ModeConfig | null;
export const MODE_ORDER: readonly GameMode[];
```

Per the brief: hardcore = 1 clip on attempt 1, **15 s per attempt**, master
pool, streak-breaking. Standard daily = 3 clips, untimed, curated pool.
Practice never touches daily stats (`affectsStats: false`).

### 3.11 `src/state/*` — STATE

```tsx
// GameContext.tsx  — 'use client'
export function GameProvider(props: { mode: GameMode; children: React.ReactNode }): JSX.Element;
export function useGame(): GameContextValue;

export interface GameContextValue {
  state: RoundState;
  submitGuess(raw: string): void;
  skipAttempt(): void;
  revealNextHint(): void;
  startRound(): void;
  loadNewRound(): void;          // practice modes only; no-ops on daily
  unlockedStages: HintStage[];   // derived, cheapest for components to read
  config: ModeConfig;
}
```

- The provider owns the per-attempt countdown (`setInterval`, 1 s tick) and
  dispatches `TICK` / `TIMEOUT`. Clear the interval on unmount and whenever
  `status !== 'playing'` — a leaked interval here corrupts the score.
- The round clock starts on the **first audio play**, not on mount, so a slow
  network doesn't cost the player points. Expose `startRound()` for that.
- All `localStorage` access goes through `persistence.ts` and must be guarded
  by `typeof window === 'undefined'` — these run during SSR.

```ts
// gameReducer.ts
export type GameAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; species: SpeciesDossier }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'START_ROUND'; at: number }
  | { type: 'GUESS'; raw: string; correct: boolean; at: number }
  | { type: 'SKIP'; at: number }
  | { type: 'TIMEOUT'; at: number }
  | { type: 'TICK' }
  | { type: 'RESET'; mode: GameMode };

export function gameReducer(state: RoundState, action: GameAction): RoundState;
export function initialRoundState(mode: GameMode): RoundState;
```

The reducer is **pure** — no `Date.now()`, no storage writes. Timestamps arrive
on the action (`at`). Consuming attempt 4 without a correct guess sets
`status: 'lost'` and populates `result`.

### 3.12 `src/lib/storage/*` — STATE

```ts
// persistence.ts
export function loadState(): PersistedState;      // returns defaults when absent/corrupt
export function saveState(next: PersistedState): void;
export function resetState(): void;
export function defaultPersistedState(): PersistedState;
export const STORAGE_KEY = 'songquest.v1';

// stats.ts
export function recordRoundResult(prev: PersistedState, args: {
  mode: GameMode; result: RoundResult; speciesId: string; dateKey: string;
}): PersistedState;
export function currentStreak(rec: DailyModeRecord, todayKey: string): number;
export function winRate(rec: DailyModeRecord): number;
export function averageScore(rec: DailyModeRecord): number;
```

`recordRoundResult` is pure — takes state, returns new state. Streak logic:
increment only if `lastPlayedDate` is exactly the previous UTC day; reset to 1
if there's a gap; ignore a second play on the same date (idempotent). Wrap
every `JSON.parse` in try/catch and fall back to defaults on corruption.

### 3.13 `src/data/*` — DATA

```ts
export interface SpeciesSeed {
  id: string;               // stable slug, e.g. "tyrannus-forficatus"
  commonName: string;
  scientificName: string;
  family: string;
  order: string;
  /** iNaturalist taxon id when known, else null — the service resolves by name. */
  inatTaxonId: number | null;
  /** Rough difficulty 1–5, used as the puzzle's Elo seed. */
  difficulty: 1 | 2 | 3 | 4 | 5;
}

// curated-500.ts
export const CURATED_SPECIES: readonly SpeciesSeed[];
// master-list.ts
export const MASTER_SPECIES: readonly SpeciesSeed[];
export function allSpecies(): readonly SpeciesSeed[];       // curated ∪ master, deduped by id
export function findSpeciesById(id: string): SpeciesSeed | undefined;
export function searchSpecies(q: string, pool: 'curated' | 'master', limit?: number): SpeciesSeed[];
```

`master-list.ts` imports `CURATED_SPECIES` and re-exports the union — the master
pool is a superset. Difficulty maps to puzzle Elo as `600 + (difficulty - 1) * 400`.

**Geographic scope is Holarctic — North America and Europe only.** Tropical
regions were considered and deliberately excluded: Xeno-canto's coverage there
is thin enough that a species often has a song but no call and no alarm
recording, and a puzzle that cannot fill all three audio slots is not playable.
Adding a region means first confirming its recording depth, not just its species
list.

**Accuracy matters more than count here.** Every binomial must be real and
correctly spelled, families must be right (an ornithologist will notice
instantly), and taxonomy should follow current AOS/IOC placement — e.g.
*Setophaga* not *Dendroica*, *Spinus tristis*, *Dryobates pubescens*. Write as
many as you can get *right*; a correct 220-species list beats a padded 500 with
invented names. Never invent a species to hit a number.

### 3.14 `src/components/ui/*` — UI-KIT

Every component is a client component only if it needs interactivity.

```tsx
// Button.tsx
export function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
  className?: string;
}): JSX.Element;

// Panel.tsx — a sheet of paper with a hairline border and optional engraved label
export function Panel(props: {
  children: React.ReactNode;
  label?: string;
  tone?: 'paper' | 'warm' | 'sage' | 'slate' | 'clay';
  raised?: boolean;
  className?: string;
}): JSX.Element;

// FieldLabel.tsx
export function FieldLabel(props: { children: React.ReactNode; className?: string }): JSX.Element;

// Seal.tsx — brass wax-seal medallion used for ranks and the win stamp
export function Seal(props: { children: React.ReactNode; size?: number; tone?: 'brass' | 'sage' | 'clay' }): JSX.Element;

// AvatarFrame.tsx — oval brass frame around an Audubon-style plate
export function AvatarFrame(props: { src: string; alt: string; size?: number }): JSX.Element;

// Skeleton.tsx
export function Skeleton(props: { height?: number | string; width?: number | string; className?: string }): JSX.Element;
```

`className` is appended, never replaced. Every one of these accepts and forwards
it — page-level agents depend on that for layout.

### 3.15 `src/components/audio/*` — AUDIO-UI

```tsx
// AudioClipPlayer.tsx — 'use client'
export function AudioClipPlayer(props: {
  src: string;                       // already proxied through /api/audio
  kind: ClipKind;
  credit?: AudioCredit | null;
  locked?: boolean;                  // hardcore hides clips 2 and 3
  autoFocus?: boolean;
  onFirstPlay?: () => void;          // starts the round clock — fire once
  volume?: number;
}): JSX.Element;

// Waveform.tsx — 'use client'
export function Waveform(props: {
  progress: number;                  // 0–1
  bars?: number;                     // default 64
  seed?: string;                     // deterministic bar heights
  playing?: boolean;
  tone?: 'sage' | 'slate' | 'clay';
  onScrub?: (fraction: number) => void;
}): JSX.Element;
```

Draw the waveform as SVG rects with heights from a seeded PRNG (same
`mulberry32` approach — reimplement locally rather than importing across the
seam), so a given clip always renders the same silhouette without decoding
audio. Bars left of `progress` use the tone colour; bars right use
`--ink-ghost`. **Do not** use the Web Audio API to decode — it costs a full
download before first paint.

Each player owns one `<audio>` element via `useRef`. Pause every other clip when
one starts: a module-scope `Set<HTMLAudioElement>` registry is fine and is the
simplest thing that works.

### 3.16 `src/components/map/*` — MAP

```tsx
// RangeMap.tsx — 'use client'
export function RangeMap(props: {
  tileUrl: string;                   // GBIF density tiles
  center?: [number, number];
  zoom?: number;
  className?: string;
  interactive?: boolean;
}): JSX.Element;

// mapConfig.ts
export const BASE_TILE_URL: string;
export const BASE_TILE_ATTRIBUTION: string;
export const MAP_DEFAULTS: { center: [number, number]; zoom: number; minZoom: number; maxZoom: number };
export const RANGE_LEGEND: readonly { label: string; cssVar: string }[];
export function gbifDensityTileUrl(taxonKey: number): string;
```

- Base tiles: CARTO `light_nolabels`
  (`https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png`) —
  free, label-free, and the closest starting point to a printed plate.
  Attribution string must credit OpenStreetMap **and** CARTO; it is a licence
  term, not a nicety.
- GBIF density:
  `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=<key>&bin=hex&hexPerTile=42&style=classic.poly`
  overlaid at ~0.75 opacity with a CSS `filter` that pulls it into the pastel
  range.
- Import Leaflet with `await import('leaflet')` **inside** `useEffect`, and its
  CSS with `await import('leaflet/dist/leaflet.css')`. Guard against
  double-initialisation in React 19 StrictMode (effects run twice in dev):
  keep the map instance in a ref, and `map.remove()` in the cleanup.
- Disable `zoomControl` when `interactive === false`, and also
  `dragging`, `scrollWheelZoom`, `doubleClickZoom`, `touchZoom`, `keyboard`.
- Render a legend from `RANGE_LEGEND` beneath the canvas using the map palette
  tokens.

### 3.17 `src/components/game/*` — GAMEPLAY-UI

```tsx
// GameBoard.tsx — 'use client' — the whole play surface; reads useGame()
export function GameBoard(): JSX.Element;

// AttemptTracker.tsx — four numbered pips showing attempt state
export function AttemptTracker(props: {
  current: AttemptNumber; guesses: GuessRecord[]; total?: number;
}): JSX.Element;

// GuessInput.tsx — 'use client' — typeahead over /api/search
export function GuessInput(props: {
  pool: 'curated' | 'master';
  disabled?: boolean;
  onSubmit: (value: string) => void;
  onSkip: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}): JSX.Element;

// CountdownTimer.tsx — 'use client'
export function CountdownTimer(props: {
  secondsRemaining: number; total: number; warnAt?: number;
}): JSX.Element;

// HintStage.tsx — one revealed clue panel
export function HintStage(props: {
  stage: HintStage; species: SpeciesDossier; unlocked: boolean; config: ModeConfig;
}): JSX.Element;
```

`GuessInput` requirements: debounce the search at 140 ms, full keyboard
navigation (↑/↓ to move, Enter to accept the highlighted option or submit the
raw text, Escape to dismiss), `role="combobox"` with `aria-expanded`,
`aria-activedescendant`, and a listbox of `role="option"`. Show the common name
in body type and the binomial in italic burgundy on the same row. Never
auto-submit on selection — the player confirms.

`HintStage` renders, by stage: `audio` → up to three `AudioClipPlayer`s
(one if `config.clipsOnFirstAttempt === 1`); `geography` → `RangeMap`;
`taxonomy` → order/family/genus in a ruled table, **never** the species;
`visual` → `BlurredPhoto` + the redacted description.

### 3.18 `src/components/species/*` — SPECIES-CARD

```tsx
// SpeciesCard.tsx — the end-of-round collectible plate
export function SpeciesCard(props: {
  species: SpeciesDossier;
  result: RoundResult;
  mode: ModeConfig;
  onNext?: () => void;
  onShare?: () => void;
}): JSX.Element;

// BlurredPhoto.tsx
export function BlurredPhoto(props: {
  src: string; alt: string; blurPx?: number; revealed?: boolean; attribution?: string; license?: string;
}): JSX.Element;

// TaxonomyPanel.tsx
export function TaxonomyPanel(props: {
  taxonomy: SpeciesDossier['taxonomy']; scientificName?: string; revealSpecies?: boolean;
}): JSX.Element;

// RedactedText.tsx
export function RedactedText(props: { text: string; className?: string }): JSX.Element;
```

`BlurredPhoto` must blur with a wrapper `overflow: hidden` and a scaled-up
child (`transform: scale(1.08)`) — otherwise the blur bleeds transparent edges.
Transition `filter` over `--dur-reveal` on reveal.

`RedactedText` splits on the literal `[REDACTED]` and renders each occurrence as
`<span class="redacted">` with the same character count as a plausible name
(use 9 characters) so the bar has width. Never render `[REDACTED]` as raw text.

`SpeciesCard` is the money shot. Composition, top to bottom: photo plate with a
hairline inner border → common name in Instrument Serif at `--step-3` → binomial
italic burgundy → a ruled taxonomy table → the un-redacted description → the
three-clip soundboard → score breakdown → attribution block in `--step--2`
carrying recordist, licence, and photo credit. Give it `--card-max` width, the
`plateReveal` animation, `--shadow-lifted`, and a 1px `--paper-edge` border with
a second inset rule 4px in — the doubled border is what makes it read as a
printed plate rather than a div.

### 3.19 Pages — PAGES

- `src/app/page.tsx` — server component. Title lockup, four mode cards
  (`MODE_ORDER` → `MODES`), and a link to `/stats`. Each card links to
  `/play/<mode>`.
- `src/app/play/[mode]/page.tsx` — **Next 15: `params` is a `Promise`.**
  ```tsx
  export default async function PlayPage({ params }: { params: Promise<{ mode: string }> }) {
    const { mode } = await params;
    // validate via getMode(); notFound() when null
  }
  ```
  Wraps `<GameProvider mode={mode}><GameBoard /></GameProvider>`. `GameProvider`
  is a client component, so the page stays a server component.
- `src/app/stats/page.tsx` — client component. Rank medallion + Elo progress,
  streak, guess-distribution histogram (bars in sage, the player's modal bucket
  in clay), win rate, average score, and a 365-day daily history strip.

---

## 4. House rules

1. **`'use client'` only where genuinely needed** — state, effects, refs, event
   handlers, browser APIs. It must be the literal first line of the file.
2. **No hard-coded design values.** Every colour, space, radius, duration, and
   font stack comes from `globals.css`. A reviewer will grep for `#` in module CSS.
3. **CSS Modules co-locate**: `Foo.tsx` ↔ `Foo.module.css`. Class names are
   `camelCase` (Next.js exposes them as-is).
4. **Accessibility is not optional.** Every control is reachable and labelled;
   the audio players have real `<button>`s with `aria-pressed` where they toggle;
   hint reveals announce via `aria-live="polite"`; the countdown is
   `role="timer"`. Never convey state by colour alone — the attempt pips carry a
   glyph as well as a hue.
5. **Attribution is a licence obligation**, not decoration. Every rendered
   recording shows recordist + licence; every photo shows its credit.
6. **Comments explain constraints, not narration.** Do not write comments that
   restate the next line or address a reviewer.
7. **No placeholders.** No `// TODO: implement`, no `throw new Error('not implemented')`,
   no lorem ipsum. Every file you own ships complete.
8. **Do not import from a file you do not own unless this document names its
   exports.** That is the whole point of §3.

---

## 5. Environment

`.env.example`:

```
# REQUIRED. No audio can be fetched without it; there is no keyless fallback.
XENO_CANTO_API_KEY=
```

No key is required for iNaturalist, GBIF, or CARTO. Everything the game ships
is CC BY, CC0, or ODbL with attribution rendered in-product.
