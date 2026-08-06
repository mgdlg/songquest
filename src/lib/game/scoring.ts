/**
 * Round scoring.
 *
 * Pure arithmetic, no clock access — every timestamp arrives from the caller so
 * the reducer stays deterministic and the numbers can be replayed from a stored
 * `RoundResult`.
 */

import type { AttemptNumber, ScoreBreakdown } from '@/types/domain';

export const BASE_SCORE = 10_000;

export const ATTEMPT_MULTIPLIERS: Readonly<Record<AttemptNumber, number>> = {
  1: 1.0,
  2: 0.75,
  3: 0.5,
  4: 0.25,
};

export const TIME_PENALTY_PER_SECOND = 10;

/**
 * A round that somehow reports a day's worth of elapsed time is a broken clock,
 * not a slow player. Capping keeps `secondsElapsed` renderable — an unbounded
 * value would print as `Infinity` in the score breakdown.
 */
const MAX_ELAPSED_MS = 86_400_000;

/**
 * Whole seconds charged against the player. A clock that never started, ran
 * backwards, or produced `NaN` from a subtraction against a null start costs
 * nothing.
 */
function chargeableSeconds(elapsedMs: number): number {
  if (Number.isNaN(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(Math.min(elapsedMs, MAX_ELAPSED_MS) / 1000);
}

/**
 * `total = max(0, round(BASE * multiplier) - seconds * TIME_PENALTY_PER_SECOND)`.
 *
 * The penalty is subtracted *after* the attempt multiplier is applied, so a
 * fourth-attempt solve is not additionally punished for the seconds it burned:
 * the multiplier already discounted the prize.
 */
export function computeScore(args: {
  solvedOnAttempt: AttemptNumber | null;
  elapsedMs: number;
}): ScoreBreakdown {
  const secondsElapsed = chargeableSeconds(args.elapsedMs);

  const multiplier =
    args.solvedOnAttempt === null ? 0 : ATTEMPT_MULTIPLIERS[args.solvedOnAttempt];

  const earned = Math.round(BASE_SCORE * multiplier);
  const total = Math.max(0, earned - secondsElapsed * TIME_PENALTY_PER_SECOND);

  return {
    base: BASE_SCORE,
    multiplier,
    // Points actually removed, never more than were earned: a loss is a plain
    // zero rather than a zero with a phantom deduction printed beside it.
    timePenalty: earned - total,
    secondsElapsed,
    total,
  };
}

/** The zero-value breakdown, for a round that ended before it began. */
export function emptyScore(): ScoreBreakdown {
  return computeScore({ solvedOnAttempt: null, elapsedMs: 0 });
}
