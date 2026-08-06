/**
 * CANONICAL DOMAIN MODEL — Song Quest
 *
 * This file is the single source of truth for shared shapes. Every other module
 * imports from here. Do not redefine these types locally.
 */

/* ------------------------------------------------------------------ */
/* Species                                                             */
/* ------------------------------------------------------------------ */

export interface SpeciesData {
  id: string;
  commonName: string;
  /** Binomial, e.g. "Tyrannus forficatus" */
  scientificName: string;
  taxonomy: {
    order: string;
    family: string;
    genus: string;
  };
  audioClips: {
    songUrl: string;
    callUrl: string;
    alarmUrl: string;
  };
  photo: {
    url: string;
    attribution: string;
    license: string;
  };
  rangeMapTileUrl: string;
  /** Wikipedia text with every mention of the species name replaced by [REDACTED] */
  descriptionSnippet: string;
}

/**
 * Richer server-assembled record. `SpeciesData` is the subset the game loop
 * needs; `SpeciesDossier` carries provenance required for CC attribution and
 * the post-game species card.
 */
export interface SpeciesDossier extends SpeciesData {
  /** iNaturalist taxon id — also the key for GBIF range tiles. */
  inatTaxonId: number;
  gbifTaxonKey: number | null;
  /** Full attribution record per audio clip, required by CC BY. */
  audioCredits: {
    song: AudioCredit | null;
    call: AudioCredit | null;
    alarm: AudioCredit | null;
  };
  /** Un-redacted description, only sent to the client after the round resolves. */
  descriptionFull: string;
  wikipediaUrl: string | null;
  conservationStatus: string | null;
  /** Approximate map focus for the range map, [lat, lng]. */
  rangeCenter: [number, number] | null;
  /**
   * `[[south, west], [north, east]]` covering the bulk of the species' verified
   * occurrences, for the map's opening view.
   *
   * Trimmed to the 5th–95th percentile of a GBIF sample rather than the true
   * extremes: a handful of vagrant or introduced records — a Northern Bobwhite
   * shot in Italy, say — would otherwise stretch the frame to the whole globe
   * and leave the actual range as an unreadable smudge.
   */
  rangeBounds: [[number, number], [number, number]] | null;
}

export interface AudioCredit {
  /** Xeno-canto catalogue number, e.g. "XC512345" */
  catalogueId: string;
  recordist: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  locality: string | null;
  country: string | null;
  /** Seconds. */
  duration: number;
  /** Xeno-canto quality grade A–E. */
  quality: string | null;
}

export type ClipKind = 'song' | 'call' | 'alarm';

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export interface PlayerProfile {
  id: string;
  username: string;
  avatarUrl: string;
  eloRating: number;
  rankTier: RankTier;
  stats: {
    gamesPlayed: number;
    winStreak: number;
    bestStreak: number;
    guessDistribution: Record<1 | 2 | 3 | 4, number>;
  };
}

export type RankTier =
  | 'Fledgling III' | 'Fledgling II' | 'Fledgling I'
  | 'Novice Birder III' | 'Novice Birder II' | 'Novice Birder I'
  | 'Field Guide III' | 'Field Guide II' | 'Field Guide I'
  | 'Master Birder III' | 'Master Birder II' | 'Master Birder I'
  | 'Ornithologist';

/* ------------------------------------------------------------------ */
/* Modes                                                               */
/* ------------------------------------------------------------------ */

export type GameMode =
  | 'daily-standard'
  | 'daily-hardcore'
  | 'practice-standard'
  | 'practice-hardcore';

export interface ModeConfig {
  id: GameMode;
  label: string;
  /** One-line description for the mode-select card. */
  blurb: string;
  /** true => the puzzle is the globally synced bird of the day. */
  daily: boolean;
  hardcore: boolean;
  /** How many of the three clips are exposed on attempt 1. */
  clipsOnFirstAttempt: 1 | 3;
  /** Seconds allowed per attempt; null = untimed. */
  secondsPerAttempt: number | null;
  /** Which species pool to draw from. */
  pool: 'curated' | 'master';
  /** Whether results mutate the persisted daily streak / distribution. */
  affectsStats: boolean;
  /** A loss (or timeout) resets the streak to zero. */
  breaksStreakOnLoss: boolean;
}

/* ------------------------------------------------------------------ */
/* Game loop                                                           */
/* ------------------------------------------------------------------ */

/** Attempts are 1-indexed and map 1:1 onto hint stages. */
export type AttemptNumber = 1 | 2 | 3 | 4;

export type HintStage = 'audio' | 'geography' | 'taxonomy' | 'visual';

export type RoundStatus =
  | 'idle'        // no puzzle loaded
  | 'loading'     // fetching the dossier
  | 'error'       // fetch failed
  | 'playing'     // awaiting a guess
  | 'won'
  | 'lost';

export interface GuessRecord {
  attempt: AttemptNumber;
  /** Exactly what the player typed. Empty string for a skip or a timeout. */
  raw: string;
  correct: boolean;
  /** 'guess' | 'skip' | 'timeout' — how the attempt was consumed. */
  kind: 'guess' | 'skip' | 'timeout';
  /** ms since the round began, at the moment the attempt was consumed. */
  elapsedMs: number;
}

export interface RoundState {
  mode: GameMode;
  status: RoundStatus;
  /** null until the dossier resolves. */
  species: SpeciesDossier | null;
  error: string | null;
  currentAttempt: AttemptNumber;
  guesses: GuessRecord[];
  /** epoch ms; null before the first clip is armed. */
  startedAt: number | null;
  endedAt: number | null;
  /** Remaining seconds on the per-attempt clock; null in untimed modes. */
  secondsRemaining: number | null;
  /** Populated once status is 'won' or 'lost'. */
  result: RoundResult | null;
}

export interface RoundResult {
  won: boolean;
  /** The attempt the player got it on; null if they never did. */
  solvedOnAttempt: AttemptNumber | null;
  score: ScoreBreakdown;
  elapsedMs: number;
}

export interface ScoreBreakdown {
  base: number;
  multiplier: number;
  /** Points removed by the time penalty (always >= 0). */
  timePenalty: number;
  /** Whole seconds charged against the player. */
  secondsElapsed: number;
  /** Final, clamped to >= 0. */
  total: number;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/** Bumped whenever the persisted shape changes; drives migration. */
export const PERSISTENCE_VERSION = 1;

export interface PersistedState {
  version: number;
  profile: PlayerProfile;
  daily: {
    /** ISO date (UTC) of the last completed daily, e.g. "2026-08-02". */
    lastCompletedDate: string | null;
    /** Streaks are tracked separately for standard and hardcore. */
    standard: DailyModeRecord;
    hardcore: DailyModeRecord;
  };
  practice: {
    roundsPlayed: number;
    roundsWon: number;
    /** Rolling mean of the last 50 scores. */
    averageScore: number;
  };
  /** Species ids already served in practice, so the shuffle avoids repeats. */
  seenSpeciesIds: string[];
  settings: {
    reducedMotion: boolean;
    volume: number;
  };
}

export interface DailyModeRecord {
  currentStreak: number;
  bestStreak: number;
  gamesPlayed: number;
  gamesWon: number;
  guessDistribution: Record<1 | 2 | 3 | 4, number>;
  /** Sum of all scores, for computing the average without storing history. */
  scoreTotal: number;
  /** ISO date of the most recent day counted toward the streak. */
  lastPlayedDate: string | null;
  /** Result archive keyed by ISO date, capped at 365 entries. */
  history: Record<string, DailyHistoryEntry>;
}

export interface DailyHistoryEntry {
  won: boolean;
  attempt: AttemptNumber | null;
  score: number;
  speciesId: string;
}

/* ------------------------------------------------------------------ */
/* Autocomplete                                                        */
/* ------------------------------------------------------------------ */

export interface SpeciesOption {
  id: string;
  commonName: string;
  scientificName: string;
  family: string | null;
}
