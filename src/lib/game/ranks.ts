/**
 * Rank ladder.
 *
 * Twelve numbered tiers of 150 Elo spanning 600 → 2400, then `Ornithologist`
 * open-ended above. Within a named tier the numeral counts *down* as you climb —
 * III is the entry step, I is the last one before promotion — which is the
 * convention every competitive ladder uses and the one the copy assumes.
 */

import type { RankTier } from '@/types/domain';

export const RANK_TIERS: readonly RankTier[] = [
  'Fledgling III',
  'Fledgling II',
  'Fledgling I',
  'Novice Birder III',
  'Novice Birder II',
  'Novice Birder I',
  'Field Guide III',
  'Field Guide II',
  'Field Guide I',
  'Master Birder III',
  'Master Birder II',
  'Master Birder I',
  'Ornithologist',
] as const;

/** Bottom of the ladder; anything below this still reads as Fledgling III. */
export const RANK_FLOOR_ELO = 600;
export const RANK_BAND_ELO = 150;
/** Entry rating for the uncapped top tier. */
export const ORNITHOLOGIST_ELO = 2400;

/** The twelve banded tiers; `Ornithologist` is the thirteenth and has no ceiling. */
const NUMBERED_TIERS = RANK_TIERS.length - 1;

/** Position on the ladder, 0 (Fledgling III) → 12 (Ornithologist). */
export function rankIndex(tier: RankTier): number {
  const index = RANK_TIERS.indexOf(tier);
  return index < 0 ? 0 : index;
}

export function rankForElo(elo: number): RankTier {
  if (!Number.isFinite(elo) || elo < RANK_FLOOR_ELO) return 'Fledgling III';
  if (elo >= ORNITHOLOGIST_ELO) return 'Ornithologist';

  const band = Math.floor((elo - RANK_FLOOR_ELO) / RANK_BAND_ELO);
  return RANK_TIERS[Math.min(band, NUMBERED_TIERS - 1)];
}

/**
 * `min` is inclusive, `max` exclusive — an Elo of exactly 750 is Fledgling II,
 * not the top of Fledgling III. `Ornithologist` returns `Infinity` as its max;
 * callers rendering a range must special-case it rather than printing the word.
 */
export function eloRangeForRank(tier: RankTier): { min: number; max: number } {
  const index = rankIndex(tier);
  if (index >= NUMBERED_TIERS) {
    return { min: ORNITHOLOGIST_ELO, max: Number.POSITIVE_INFINITY };
  }
  const min = RANK_FLOOR_ELO + index * RANK_BAND_ELO;
  return { min, max: min + RANK_BAND_ELO };
}

/**
 * Progress through the current tier. `pct` is 0–1 and is pinned to 1 at
 * `Ornithologist`, where there is nothing left to fill.
 */
export function rankProgress(elo: number): {
  tier: RankTier;
  next: RankTier | null;
  pct: number;
} {
  const tier = rankForElo(elo);
  const index = rankIndex(tier);

  if (index >= NUMBERED_TIERS) {
    return { tier, next: null, pct: 1 };
  }

  const { min, max } = eloRangeForRank(tier);
  const value = Number.isFinite(elo) ? elo : min;
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));

  return { tier, next: RANK_TIERS[index + 1], pct };
}

/** Elo still owed before promotion; 0 once the top tier is reached. */
export function eloToNextRank(elo: number): number {
  const tier = rankForElo(elo);
  if (rankIndex(tier) >= NUMBERED_TIERS) return 0;
  const value = Number.isFinite(elo) ? elo : RANK_FLOOR_ELO;
  return Math.max(0, Math.ceil(eloRangeForRank(tier).max - value));
}
