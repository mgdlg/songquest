/**
 * The four ways to play.
 *
 * Everything that distinguishes a mode lives in its `ModeConfig` — the reducer,
 * the board, and the stats writer all read from here rather than testing the
 * mode id, so adding a fifth mode is a data change.
 */

import type { AttemptNumber, GameMode, HintStage, ModeConfig } from '@/types/domain';

/** Four attempts, one per hint stage. */
export const TOTAL_ATTEMPTS = 4;

/** Attempt *n* unlocks stage *n*: sound, then place, then lineage, then plate. */
export const HINT_STAGE_ORDER: readonly HintStage[] = [
  'audio',
  'geography',
  'taxonomy',
  'visual',
];

export const MODES: Readonly<Record<GameMode, ModeConfig>> = {
  'daily-standard': {
    id: 'daily-standard',
    label: 'Daily Round',
    blurb:
      'One bird a day, the same for every ear on earth. Three recordings, four attempts, and no clock — sit with it as long as the coffee holds out.',
    daily: true,
    hardcore: false,
    clipsOnFirstAttempt: 3,
    secondsPerAttempt: null,
    pool: 'curated',
    affectsStats: true,
    // The gentle daily: the streak counts days you turned up, not days you were
    // right. Hardcore is where a miss costs you something.
    breaksStreakOnLoss: false,
  },

  'daily-hardcore': {
    id: 'daily-hardcore',
    label: 'Hardcore Daily',
    blurb:
      'A single recording, fifteen seconds a guess, drawn from the whole list — dowitchers, empids, wintering thrushes and all. Miss it and the streak goes with it.',
    daily: true,
    hardcore: true,
    clipsOnFirstAttempt: 1,
    secondsPerAttempt: 15,
    pool: 'master',
    affectsStats: true,
    breaksStreakOnLoss: true,
  },

  'practice-standard': {
    id: 'practice-standard',
    label: 'Practice',
    blurb:
      'An endless drawer of specimens from the curated set. Nothing is recorded, nothing is counted, and you may stay all afternoon.',
    daily: false,
    hardcore: false,
    clipsOnFirstAttempt: 3,
    secondsPerAttempt: null,
    pool: 'curated',
    affectsStats: false,
    breaksStreakOnLoss: false,
  },

  'practice-hardcore': {
    id: 'practice-hardcore',
    label: 'Hardcore Practice',
    blurb:
      'Hardcore conditions with the stakes removed: one clip, fifteen seconds, the full list. The drill for the genera that keep catching you out.',
    daily: false,
    hardcore: true,
    clipsOnFirstAttempt: 1,
    secondsPerAttempt: 15,
    pool: 'master',
    affectsStats: false,
    breaksStreakOnLoss: false,
  },
};

/** Display order on the home page: the two dailies first, then the sandboxes. */
export const MODE_ORDER: readonly GameMode[] = [
  'daily-standard',
  'daily-hardcore',
  'practice-standard',
  'practice-hardcore',
];

export function isGameMode(id: string): id is GameMode {
  return Object.prototype.hasOwnProperty.call(MODES, id);
}

/**
 * Route-parameter guard: takes the raw `[mode]` segment and returns null for
 * anything that is not one of the four, so the page can `notFound()`.
 */
export function getMode(id: string): ModeConfig | null {
  return isGameMode(id) ? MODES[id] : null;
}

/** The hint unlocked by reaching the given attempt. */
export function stageForAttempt(attempt: AttemptNumber): HintStage {
  return HINT_STAGE_ORDER[attempt - 1];
}

/** Every stage unlocked at or before the current attempt. */
export function stagesUpTo(attempt: AttemptNumber): HintStage[] {
  return HINT_STAGE_ORDER.slice(0, attempt);
}
