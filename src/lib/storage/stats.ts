/**
 * Pure reducers over `PersistedState`.
 *
 * `recordRoundResult` takes state and returns state — it never writes. The
 * caller owns the write, which keeps the streak arithmetic testable without a
 * browser and keeps one round from producing two `localStorage` writes.
 *
 * The awkward requirement here is idempotence. A player who finishes the daily
 * and refreshes must not bank the day twice, so a date already present in the
 * archive is a no-op. That means `recordRoundResult` is safe to call from an
 * effect that may re-run.
 */

import { outcomeForAttempt, updateElo } from '@/lib/game/elo';
import { previousDateKey } from '@/lib/game/daily';
import { rankForElo } from '@/lib/game/ranks';
import { getMode } from '@/lib/modes';
import { findSpeciesById, puzzleEloFor } from '@/data/master-list';
import { HISTORY_LIMIT } from '@/lib/storage/persistence';
import type {
  AttemptNumber,
  DailyHistoryEntry,
  DailyModeRecord,
  GameMode,
  PersistedState,
  PlayerProfile,
  RoundResult,
} from '@/types/domain';

/** Rolling window for the practice mean, in rounds. */
const PRACTICE_WINDOW = 50;

/** Used when a dossier id has no seed behind it — mid-ladder, no free ride. */
const FALLBACK_PUZZLE_ELO = 1400;

function bumpDistribution(
  distribution: Record<AttemptNumber, number>,
  attempt: AttemptNumber,
): Record<AttemptNumber, number> {
  const next: Record<AttemptNumber, number> = {
    1: distribution[1],
    2: distribution[2],
    3: distribution[3],
    4: distribution[4],
  };
  next[attempt] += 1;
  return next;
}

/** ISO keys sort chronologically, so the oldest days are simply the first. */
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

function alreadyRecorded(record: DailyModeRecord, dateKey: string): boolean {
  if (record.lastPlayedDate === dateKey) return true;
  return Object.prototype.hasOwnProperty.call(record.history, dateKey);
}

/**
 * A streak counts consecutive UTC days. Any gap larger than one day restarts
 * the chain at 1 — the day just played still counts, so a returning player is
 * never shown a zero after a win.
 *
 * In a forgiving mode the chain counts days you turned up, not days you were
 * right, so a loss extends it exactly as a win does. What a loss must NOT do is
 * skip the contiguity test: carrying the stored number forward untouched would
 * resurrect a chain that lapsed months ago, and the next win would increment
 * from it. Contiguity is therefore evaluated once, for both outcomes.
 */
function nextStreakValue(
  record: DailyModeRecord,
  dateKey: string,
  won: boolean,
  breaksStreakOnLoss: boolean,
): number {
  if (!won && breaksStreakOnLoss) return 0;

  const yesterday = previousDateKey(dateKey);
  const contiguous = yesterday !== null && record.lastPlayedDate === yesterday;
  return contiguous ? record.currentStreak + 1 : 1;
}

function laterDateKey(a: string | null, b: string): string {
  if (a === null) return b;
  return a > b ? a : b;
}

/**
 * Rolling mean of the last `PRACTICE_WINDOW` scores held in a single number.
 * The individual scores are not stored, so the newest sample is weighted
 * `1/min(n, 50)`; once past 50 rounds that is an exponential window with the
 * same centre of mass as a true 50-round mean. Practice is a warm-up counter,
 * not a leaderboard, and the exactness is not worth 50 stored integers.
 */
function nextPractice(
  practice: PersistedState['practice'],
  result: RoundResult,
): PersistedState['practice'] {
  const roundsPlayed = practice.roundsPlayed + 1;
  const window = Math.min(roundsPlayed, PRACTICE_WINDOW);
  const mean = practice.averageScore + (result.score.total - practice.averageScore) / window;

  return {
    roundsPlayed,
    roundsWon: practice.roundsWon + (result.won ? 1 : 0),
    averageScore: Math.round(mean * 100) / 100,
  };
}

function nextProfile(
  profile: PlayerProfile,
  args: { won: boolean; attempt: AttemptNumber | null; speciesId: string; streak: number },
): PlayerProfile {
  const seed = findSpeciesById(args.speciesId);
  const puzzleElo = seed ? puzzleEloFor(seed) : FALLBACK_PUZZLE_ELO;

  const eloRating = updateElo({
    playerElo: profile.eloRating,
    puzzleElo,
    outcome: outcomeForAttempt(args.won ? args.attempt : null),
    gamesPlayed: profile.stats.gamesPlayed,
  });

  return {
    ...profile,
    eloRating,
    rankTier: rankForElo(eloRating),
    stats: {
      gamesPlayed: profile.stats.gamesPlayed + 1,
      winStreak: args.streak,
      bestStreak: Math.max(profile.stats.bestStreak, args.streak),
      guessDistribution:
        args.won && args.attempt !== null
          ? bumpDistribution(profile.stats.guessDistribution, args.attempt)
          : profile.stats.guessDistribution,
    },
  };
}

export function recordRoundResult(
  prev: PersistedState,
  args: { mode: GameMode; result: RoundResult; speciesId: string; dateKey: string },
): PersistedState {
  const config = getMode(args.mode);
  if (config === null) return prev;

  const attempt = args.result.solvedOnAttempt;
  // `won` and `solvedOnAttempt` are set together by the reducer; the histogram
  // still refuses to count a win with no attempt behind it.
  const won = args.result.won && attempt !== null;

  if (!config.affectsStats) {
    return { ...prev, practice: nextPractice(prev.practice, args.result) };
  }

  const key: 'standard' | 'hardcore' = config.hardcore ? 'hardcore' : 'standard';
  const record = prev.daily[key];

  if (alreadyRecorded(record, args.dateKey)) return prev;

  const streak = nextStreakValue(record, args.dateKey, won, config.breaksStreakOnLoss);

  const entry: DailyHistoryEntry = {
    won,
    attempt: won ? attempt : null,
    score: args.result.score.total,
    speciesId: args.speciesId,
  };

  const nextRecord: DailyModeRecord = {
    currentStreak: streak,
    bestStreak: Math.max(record.bestStreak, streak),
    gamesPlayed: record.gamesPlayed + 1,
    gamesWon: record.gamesWon + (won ? 1 : 0),
    guessDistribution:
      won && attempt !== null
        ? bumpDistribution(record.guessDistribution, attempt)
        : record.guessDistribution,
    scoreTotal: record.scoreTotal + args.result.score.total,
    lastPlayedDate: args.dateKey,
    history: capHistory({ ...record.history, [args.dateKey]: entry }),
  };

  // Written as an explicit branch rather than a computed key: a computed
  // property with a union key widens the literal into an index signature and
  // loses the guarantee that both records are present.
  const daily: PersistedState['daily'] = {
    lastCompletedDate: laterDateKey(prev.daily.lastCompletedDate, args.dateKey),
    standard: key === 'standard' ? nextRecord : prev.daily.standard,
    hardcore: key === 'hardcore' ? nextRecord : prev.daily.hardcore,
  };

  return {
    ...prev,
    profile: nextProfile(prev.profile, {
      won,
      attempt,
      speciesId: args.speciesId,
      streak,
    }),
    daily,
  };
}

/**
 * The streak as it stands *today*, which is not always the stored number: a
 * chain whose last entry is older than yesterday has lapsed and reads zero,
 * even though the stored value is only rewritten on the next completed round.
 */
export function currentStreak(rec: DailyModeRecord, todayKey: string): number {
  if (rec.lastPlayedDate === null) return 0;
  if (rec.lastPlayedDate === todayKey) return rec.currentStreak;
  if (rec.lastPlayedDate === previousDateKey(todayKey)) return rec.currentStreak;
  return 0;
}

/** Fraction in 0–1, not a percentage. Multiply at the render site. */
export function winRate(rec: DailyModeRecord): number {
  if (rec.gamesPlayed <= 0) return 0;
  return rec.gamesWon / rec.gamesPlayed;
}

/** Mean score across every counted daily, rounded to a whole point. */
export function averageScore(rec: DailyModeRecord): number {
  if (rec.gamesPlayed <= 0) return 0;
  return Math.round(rec.scoreTotal / rec.gamesPlayed);
}
