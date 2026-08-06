/**
 * The only module that is allowed to touch `localStorage`.
 *
 * Two constraints shape everything here:
 *
 * 1. **This runs during SSR.** Next renders client components on the server for
 *    the initial HTML, so every access is guarded by `typeof window`. Callers
 *    must read persisted state from an effect, never during render — the server
 *    pass always returns a fresh default and rendering it would desynchronise
 *    hydration.
 * 2. **Stored data is untrusted input.** It survives version bumps, hand-edits,
 *    and half-written writes from a killed tab. A thrown `JSON.parse` on load
 *    would brick the app for anyone carrying stale data, so every read is
 *    defensive and every field is coerced back into range.
 */

import { DEFAULT_ELO } from '@/lib/game/elo';
import { rankForElo } from '@/lib/game/ranks';
import { PERSISTENCE_VERSION } from '@/types/domain';
import type {
  AttemptNumber,
  DailyHistoryEntry,
  DailyModeRecord,
  PersistedState,
  PlayerProfile,
} from '@/types/domain';

export const STORAGE_KEY = 'songquest.v1';

/** Archive depth for the daily history strip — one year of squares. */
export const HISTORY_LIMIT = 365;

/** Practice shuffle memory. Beyond this the oldest sightings are forgotten. */
export const SEEN_LIMIT = 600;

const DEFAULT_USERNAME = 'Field Observer';

/**
 * Audubon-style plates shipped under `public/avatars/`. The plate is chosen by
 * hashing the profile id rather than by a second `Math.random()` call, so the
 * whole default profile derives from exactly one source of entropy.
 */
const AVATAR_PLATES = [
  'plate-01',
  'plate-02',
  'plate-03',
  'plate-04',
  'plate-05',
  'plate-06',
  'plate-07',
  'plate-08',
] as const;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ */
/* Coercion helpers — every one of these takes `unknown`               */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.round(num(value, fallback, min, max));
}

function str(value: unknown, fallback: string, maxLength = 120): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  return trimmed.slice(0, maxLength);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function dateKeyOrNull(value: unknown): string | null {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value) ? value : null;
}

function attemptOrNull(value: unknown): AttemptNumber | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

function emptyDistribution(): Record<AttemptNumber, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0 };
}

function coerceDistribution(value: unknown): Record<AttemptNumber, number> {
  if (!isRecord(value)) return emptyDistribution();
  return {
    1: int(value['1'], 0),
    2: int(value['2'], 0),
    3: int(value['3'], 0),
    4: int(value['4'], 0),
  };
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * `crypto.randomUUID` is unavailable over plain HTTP on some browsers (it is a
 * secure-context API), so both a `getRandomValues` path and a plain fallback
 * are kept. The id is a local save-file handle, not a security token.
 */
function randomId(): string {
  const webCrypto: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    let out = '';
    for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
    return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`;
  }

  return `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function avatarForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  }
  const plate = AVATAR_PLATES[hash % AVATAR_PLATES.length] ?? AVATAR_PLATES[0];
  return `/avatars/${plate}.svg`;
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

export function emptyDailyRecord(): DailyModeRecord {
  return {
    currentStreak: 0,
    bestStreak: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    guessDistribution: emptyDistribution(),
    scoreTotal: 0,
    lastPlayedDate: null,
    history: {},
  };
}

export function defaultPersistedState(): PersistedState {
  const id = randomId();

  const profile: PlayerProfile = {
    id,
    username: DEFAULT_USERNAME,
    avatarUrl: avatarForId(id),
    eloRating: DEFAULT_ELO,
    rankTier: rankForElo(DEFAULT_ELO),
    stats: {
      gamesPlayed: 0,
      winStreak: 0,
      bestStreak: 0,
      guessDistribution: emptyDistribution(),
    },
  };

  return {
    version: PERSISTENCE_VERSION,
    profile,
    daily: {
      lastCompletedDate: null,
      standard: emptyDailyRecord(),
      hardcore: emptyDailyRecord(),
    },
    practice: {
      roundsPlayed: 0,
      roundsWon: 0,
      averageScore: 0,
    },
    seenSpeciesIds: [],
    settings: {
      reducedMotion: false,
      volume: 0.8,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

/**
 * ISO date keys sort lexicographically in chronological order, so trimming the
 * archive is a sort and a slice — the oldest days fall off the front.
 */
function capHistory(history: Record<string, DailyHistoryEntry>): Record<string, DailyHistoryEntry> {
  const keys = Object.keys(history).sort();
  if (keys.length <= HISTORY_LIMIT) return history;

  const kept: Record<string, DailyHistoryEntry> = {};
  for (const key of keys.slice(keys.length - HISTORY_LIMIT)) {
    const entry = history[key];
    if (entry) kept[key] = entry;
  }
  return kept;
}

function coerceHistory(value: unknown): Record<string, DailyHistoryEntry> {
  if (!isRecord(value)) return {};

  const out: Record<string, DailyHistoryEntry> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!DATE_KEY_PATTERN.test(key) || !isRecord(raw)) continue;
    const attempt = attemptOrNull(raw.attempt);
    const won = bool(raw.won, false);
    out[key] = {
      won,
      // A win with no recorded attempt would break the guess histogram; the
      // archive keeps the pair consistent even when the stored row was not.
      attempt: won ? (attempt ?? 4) : attempt,
      score: int(raw.score, 0),
      speciesId: str(raw.speciesId, '', 120),
    };
  }
  return capHistory(out);
}

function coerceDailyRecord(value: unknown): DailyModeRecord {
  if (!isRecord(value)) return emptyDailyRecord();

  const currentStreak = int(value.currentStreak, 0);
  return {
    currentStreak,
    bestStreak: Math.max(currentStreak, int(value.bestStreak, 0)),
    gamesPlayed: int(value.gamesPlayed, 0),
    gamesWon: int(value.gamesWon, 0),
    guessDistribution: coerceDistribution(value.guessDistribution),
    scoreTotal: int(value.scoreTotal, 0),
    lastPlayedDate: dateKeyOrNull(value.lastPlayedDate),
    history: coerceHistory(value.history),
  };
}

function coerceProfile(value: unknown, fallback: PlayerProfile): PlayerProfile {
  if (!isRecord(value)) return fallback;

  const eloRating = int(value.eloRating, DEFAULT_ELO, 0, 4000);
  const stats = isRecord(value.stats) ? value.stats : {};
  const winStreak = int(stats.winStreak, 0);
  const id = str(value.id, fallback.id);

  return {
    id,
    username: str(value.username, DEFAULT_USERNAME, 40),
    // Only same-origin plate paths are honoured; a stored absolute URL would
    // let a tampered save file point the avatar at an arbitrary host.
    avatarUrl: coerceAvatarUrl(value.avatarUrl, id),
    eloRating,
    // Always recomputed. A stored tier can disagree with the rating after a
    // ladder change, and the rating is the number of record.
    rankTier: rankForElo(eloRating),
    stats: {
      gamesPlayed: int(stats.gamesPlayed, 0),
      winStreak,
      bestStreak: Math.max(winStreak, int(stats.bestStreak, 0)),
      guessDistribution: coerceDistribution(stats.guessDistribution),
    },
  };
}

function coerceAvatarUrl(value: unknown, id: string): string {
  if (typeof value === 'string' && /^\/avatars\/[A-Za-z0-9_-]+\.(svg|png|jpg|jpeg|webp)$/.test(value)) {
    return value;
  }
  return avatarForId(id);
}

function coerceSeen(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0 && entry.length <= 120) {
      seen.push(entry);
    }
  }
  return seen.slice(-SEEN_LIMIT);
}

/**
 * Anything that is not exactly the current version is discarded in favour of a
 * clean default. Guessing at an older shape is how streaks quietly become
 * wrong; losing a save is visible and honest, a silently mangled one is not.
 * When a real upgrade path is needed, branch here on `version` and translate.
 */
export function migrate(raw: unknown): PersistedState {
  const base = defaultPersistedState();
  if (!isRecord(raw)) return base;

  const version = typeof raw.version === 'number' ? raw.version : -1;
  if (version !== PERSISTENCE_VERSION) return base;

  const daily = isRecord(raw.daily) ? raw.daily : {};
  const practice = isRecord(raw.practice) ? raw.practice : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};

  const roundsPlayed = int(practice.roundsPlayed, 0);

  return {
    version: PERSISTENCE_VERSION,
    profile: coerceProfile(raw.profile, base.profile),
    daily: {
      lastCompletedDate: dateKeyOrNull(daily.lastCompletedDate),
      standard: coerceDailyRecord(daily.standard),
      hardcore: coerceDailyRecord(daily.hardcore),
    },
    practice: {
      roundsPlayed,
      roundsWon: Math.min(roundsPlayed, int(practice.roundsWon, 0)),
      averageScore: num(practice.averageScore, 0, 0, 1_000_000),
    },
    seenSpeciesIds: coerceSeen(raw.seenSpeciesIds),
    settings: {
      reducedMotion: bool(settings.reducedMotion, false),
      volume: num(settings.volume, 0.8, 0, 1),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultPersistedState();

  let raw: string | null = null;
  try {
    // Reading storage throws outright in Safari's private mode and under a
    // "block all cookies" policy; that is a normal browser, not an error.
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return defaultPersistedState();
  }

  if (raw === null || raw.length === 0) return defaultPersistedState();

  try {
    return migrate(JSON.parse(raw));
  } catch {
    return defaultPersistedState();
  }
}

export function saveState(next: PersistedState): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exhausted or storage disabled. The round already resolved on
    // screen; losing the record is the lesser failure and must not throw
    // inside the effect that ends the round.
  }
}

export function resetState(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — see `saveState`.
  }
}
