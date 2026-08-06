/**
 * Elo rating for the player against the puzzle.
 *
 * The "opponent" is the bird: each species carries a puzzle rating derived from
 * its curated difficulty, so identifying an *Empidonax* on the first clip moves
 * the needle further than a Northern Cardinal ever will.
 */

import type { AttemptNumber } from '@/types/domain';
import { ATTEMPT_MULTIPLIERS } from './scoring';

/** Where a new account starts — the top of Novice Birder III. */
export const DEFAULT_ELO = 1000;

/** Ratings are clamped so a bad week cannot drive the number somewhere absurd. */
export const ELO_FLOOR = 100;
export const ELO_CEILING = 3000;

export const K_PROVISIONAL = 40;
export const K_STANDARD = 24;
export const K_ELITE = 16;

/** Games below which the rating is still finding its level. */
export const PROVISIONAL_GAMES = 20;
/** Above this rating, moves get small so the top of the ladder stays meaningful. */
export const ELITE_ELO = 2100;

function sanitise(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * K-factor. The provisional bracket is checked first: a brand-new account that
 * has somehow landed above `ELITE_ELO` is still an unmeasured player and should
 * keep moving fast until it has a real sample behind it.
 */
export function kFactor(playerElo: number, gamesPlayed: number): number {
  const games = Number.isFinite(gamesPlayed) ? gamesPlayed : 0;
  if (games < PROVISIONAL_GAMES) return K_PROVISIONAL;
  return sanitise(playerElo, DEFAULT_ELO) >= ELITE_ELO ? K_ELITE : K_STANDARD;
}

/** Logistic expectation, 0–1: the share of the point the player "should" take. */
export function expectedScore(playerElo: number, puzzleElo: number): number {
  const player = sanitise(playerElo, DEFAULT_ELO);
  const puzzle = sanitise(puzzleElo, DEFAULT_ELO);
  return 1 / (1 + Math.pow(10, (puzzle - player) / 400));
}

/**
 * `outcome` is 0–1 — see `outcomeForAttempt`. Returns the new rating, rounded to
 * a whole number and clamped; ratings are stored and displayed as integers, so
 * rounding here keeps persistence and display in agreement.
 */
export function updateElo(args: {
  playerElo: number;
  puzzleElo: number;
  outcome: number;
  gamesPlayed: number;
}): number {
  const player = sanitise(args.playerElo, DEFAULT_ELO);
  // A malformed outcome must not silently read as a loss; refuse the update.
  if (!Number.isFinite(args.outcome)) return Math.round(clamp(player, ELO_FLOOR, ELO_CEILING));

  const outcome = clamp(args.outcome, 0, 1);
  const k = kFactor(player, args.gamesPlayed);
  const next = player + k * (outcome - expectedScore(player, args.puzzleElo));

  return Math.round(clamp(next, ELO_FLOOR, ELO_CEILING));
}

/**
 * Attempt → Elo outcome. Deliberately the same ladder as the score multipliers:
 * a fourth-attempt solve is a quarter of a point, a loss is nothing.
 */
export function outcomeForAttempt(solvedOnAttempt: AttemptNumber | null): number {
  return solvedOnAttempt === null ? 0 : ATTEMPT_MULTIPLIERS[solvedOnAttempt];
}

/* `puzzleEloForDifficulty` lived here. Puzzle ratings now come from
   `puzzleEloFor` in `data/master-list.ts`, which reads iNaturalist observation
   rank instead of a hand-written difficulty column. */
