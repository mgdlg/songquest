/**
 * The round state machine.
 *
 * This module is PURE. No `Date.now()`, no `localStorage`, no fetching — every
 * timestamp arrives on the action as `at`. That is what makes the whole game
 * loop reproducible from a recorded action log, and it is why the reducer can
 * be reasoned about without a clock.
 *
 * The invariant that matters most: GUESS / SKIP / TIMEOUT are only honoured
 * while `status === 'playing'`. A timer tick that lands in the same frame as a
 * winning guess must not consume a fifth attempt or overwrite the result, so
 * the guard sits at the single entry point every attempt-consuming action
 * passes through rather than being re-checked at each call site.
 */

import { computeScore } from '@/lib/game/scoring';
import { getMode } from '@/lib/modes';
import type {
  AttemptNumber,
  GameMode,
  GuessRecord,
  RoundState,
  SpeciesDossier,
} from '@/types/domain';

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

/** Four attempts, four hint stages, 1:1. */
export const MAX_ATTEMPTS = 4;

/**
 * Successor table rather than `attempt + 1`, so the 1|2|3|4 union survives
 * without a cast and "there is no fifth attempt" is expressed in the type.
 */
const NEXT_ATTEMPT: Readonly<Record<AttemptNumber, AttemptNumber | null>> = {
  1: 2,
  2: 3,
  3: 4,
  4: null,
};

/** Seconds allowed per attempt for a mode; null in untimed modes. */
function allowanceFor(mode: GameMode): number | null {
  return getMode(mode)?.secondsPerAttempt ?? null;
}

/**
 * Milliseconds the player has been on the clock. The clock starts at the first
 * audio play, so an attempt consumed before `START_ROUND` is charged nothing —
 * a slow network must never cost points.
 */
function elapsedSince(state: RoundState, at: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, at - state.startedAt);
}

export function initialRoundState(mode: GameMode): RoundState {
  return {
    mode,
    status: 'idle',
    species: null,
    error: null,
    currentAttempt: 1,
    guesses: [],
    startedAt: null,
    endedAt: null,
    secondsRemaining: allowanceFor(mode),
    result: null,
  };
}

/**
 * The single path by which an attempt is spent, whatever spent it. Callers have
 * already established that the round is playable.
 */
function consumeAttempt(
  state: RoundState,
  kind: GuessRecord['kind'],
  raw: string,
  correct: boolean,
  at: number,
): RoundState {
  const elapsedMs = elapsedSince(state, at);
  const record: GuessRecord = {
    attempt: state.currentAttempt,
    raw,
    correct,
    kind,
    elapsedMs,
  };
  const guesses = [...state.guesses, record];

  if (correct) {
    const solvedOnAttempt = state.currentAttempt;
    return {
      ...state,
      status: 'won',
      guesses,
      endedAt: at,
      result: {
        won: true,
        solvedOnAttempt,
        score: computeScore({ solvedOnAttempt, elapsedMs }),
        elapsedMs,
      },
    };
  }

  const nextAttempt = NEXT_ATTEMPT[state.currentAttempt];

  if (nextAttempt === null) {
    return {
      ...state,
      status: 'lost',
      guesses,
      endedAt: at,
      result: {
        won: false,
        solvedOnAttempt: null,
        score: computeScore({ solvedOnAttempt: null, elapsedMs }),
        elapsedMs,
      },
    };
  }

  // The clock is refilled for the new attempt; `secondsPerAttempt`, not a
  // budget for the whole round.
  return {
    ...state,
    guesses,
    currentAttempt: nextAttempt,
    secondsRemaining: allowanceFor(state.mode),
  };
}

export function gameReducer(state: RoundState, action: GameAction): RoundState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...initialRoundState(state.mode), status: 'loading' };

    case 'LOAD_SUCCESS':
      // Rebuilt from the initial state rather than patched onto the old one, so
      // a practice re-roll cannot inherit the previous round's guesses.
      return {
        ...initialRoundState(state.mode),
        status: 'playing',
        species: action.species,
      };

    case 'LOAD_ERROR':
      return {
        ...initialRoundState(state.mode),
        status: 'error',
        error: action.error,
      };

    case 'START_ROUND':
      // Idempotent: the second and third clips also fire `onFirstPlay`, and
      // restarting the clock there would hand back the seconds already spent.
      if (state.status !== 'playing' || state.startedAt !== null) return state;
      return {
        ...state,
        startedAt: action.at,
        secondsRemaining: allowanceFor(state.mode),
      };

    case 'GUESS':
      if (state.status !== 'playing') return state;
      return consumeAttempt(state, 'guess', action.raw, action.correct, action.at);

    case 'SKIP':
      if (state.status !== 'playing') return state;
      return consumeAttempt(state, 'skip', '', false, action.at);

    case 'TIMEOUT':
      if (state.status !== 'playing') return state;
      return consumeAttempt(state, 'timeout', '', false, action.at);

    case 'TICK': {
      if (state.status !== 'playing') return state;
      // Untimed mode, or the player has not started the clock yet.
      if (state.secondsRemaining === null || state.startedAt === null) return state;
      if (state.secondsRemaining <= 0) return state;
      return { ...state, secondsRemaining: state.secondsRemaining - 1 };
    }

    case 'RESET':
      return initialRoundState(action.mode);

    default:
      return state;
  }
}
