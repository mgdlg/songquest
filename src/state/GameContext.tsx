'use client';

/**
 * The round's owner: it fetches the dossier, runs the per-attempt clock, and
 * writes the result to storage exactly once when the round resolves.
 *
 * Everything that needs a clock or a network lives here so that
 * `gameReducer.ts` can stay pure. Three timing rules are load-bearing:
 *
 * - The countdown starts on the **first audio play** (`startRound`), not on
 *   mount. A slow dossier fetch must not cost the player points.
 * - The interval is torn down on unmount *and* whenever `status` leaves
 *   `'playing'`. A leaked interval keeps dispatching `TICK` into a finished
 *   round and corrupts the next one.
 * - A tick that reaches zero dispatches `TIMEOUT`, but the reducer ignores
 *   `TIMEOUT` unless the round is still playing — so a tick racing a winning
 *   guess cannot consume an attempt after the win.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

import { CURATED_SPECIES } from '@/data/curated-500';
import { allSpecies, speciesForRegion } from '@/data/master-list';
import { getRegion, type RegionId } from '@/lib/regions';
import { loadBeginner, loadRegion } from '@/lib/storage/region';
import { todayKey } from '@/lib/game/daily';
import { isCorrectGuess } from '@/lib/game/matching';
import { MODES, getMode } from '@/lib/modes';
import { SEEN_LIMIT, loadState, saveState } from '@/lib/storage/persistence';
import { recordRoundResult } from '@/lib/storage/stats';
import { gameReducer, initialRoundState } from '@/state/gameReducer';
import type {
  GameMode,
  HintStage,
  ModeConfig,
  RoundState,
  SpeciesDossier,
} from '@/types/domain';

export interface GameContextValue {
  state: RoundState;
  submitGuess(raw: string): void;
  skipAttempt(): void;
  revealNextHint(): void;
  startRound(): void;
  /** Practice modes only; no-ops on daily — the bird of the day is fixed. */
  loadNewRound(): void;
  unlockedStages: HintStage[];
  config: ModeConfig;
}

/** Attempt N unlocks stages 1..N; the array order is the attempt order. */
const HINT_STAGES: readonly HintStage[] = ['audio', 'geography', 'taxonomy', 'visual'];

const TICK_MS = 1000;

/** One retry, far enough apart to clear a dropped packet, close enough to feel instant. */
const RETRY_DELAY_MS = 420;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Below this, a region is too thin to draw from and the round falls back to the
 * whole continent. A pool of three means the same three birds every session,
 * which is worse than a wider net that still sounds like the right place.
 */
const MIN_REGION_POOL = 12;

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Retries once, and only for failures that are plausibly transient: a dropped
 * connection, a 5xx, or a 429. A 404 means the bird genuinely is not there and
 * asking twice just doubles the wait before the player sees the message.
 */
async function fetchJson(url: string, signal: AbortSignal, label: string): Promise<unknown> {
  let transient: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await delay(RETRY_DELAY_MS, signal);

    let response: Response;
    try {
      response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    } catch (error) {
      if (isAbortError(error)) throw error;
      transient = new Error(`${label} could not be reached.`);
      continue;
    }

    if (response.ok) {
      try {
        return (await response.json()) as unknown;
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new Error(`${label} came back unreadable.`);
      }
    }

    if (response.status >= 500 || response.status === 429) {
      transient = new Error(`${label} is unavailable right now.`);
      continue;
    }

    throw new Error(`${label} could not be found.`);
  }

  throw transient ?? new Error(`${label} could not be reached.`);
}

/**
 * The single unchecked cast in this module, at the network boundary. The keys
 * the game loop cannot run without are verified first; optional provenance
 * fields are allowed to be absent because the UI already renders their absence.
 */
function asDossier(value: unknown): SpeciesDossier {
  if (typeof value !== 'object' || value === null) {
    throw new Error('That dossier came back empty.');
  }

  const candidate = value as Partial<SpeciesDossier>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.commonName !== 'string' ||
    typeof candidate.scientificName !== 'string'
  ) {
    throw new Error('That dossier is missing its species names.');
  }

  // Any one voice is playable; not every bird sings. This mirrors the check in
  // speciesService — if it ever tightens to require a song again, a round that
  // the server considers valid would fail here instead, which is a far more
  // confusing failure than a missing clip.
  const clips = candidate.audioClips;
  const hasAudio = [clips?.songUrl, clips?.callUrl, clips?.alarmUrl].some(
    (url) => typeof url === 'string' && url.length > 0,
  );
  if (!hasAudio) {
    throw new Error('No recording is available for this bird.');
  }

  return value as SpeciesDossier;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return 'Something went wrong loading this round.';
}

/* ------------------------------------------------------------------ */
/* Practice pool                                                       */
/* ------------------------------------------------------------------ */

/**
 * The structural subset of a species seed this module needs. Declared locally
 * rather than imported so the seam does not depend on which of the two data
 * files declares `SpeciesSeed`; the real seeds satisfy it.
 */
interface PoolSeed {
  id: string;
  scientificName: string;
  inatTaxonId: number | null;
}

function pickPracticeSeed(
  pool: 'curated' | 'master',
  region: RegionId,
  beginner: boolean,
  seen: readonly string[],
  excludeId: string | null,
): PoolSeed | null {
  // Region first, then the seen-list preference below. A region with a thin
  // pool falls back to its continent rather than handing back nothing —
  // "South-western Europe" should still be playable on the curated list.
  let source: readonly PoolSeed[] = speciesForRegion(pool, region, { beginner });
  if (source.length < MIN_REGION_POOL) {
    const continentRoot: RegionId = getRegion(region)?.continent === 'eu' ? 'europe' : 'north-america';
    source = speciesForRegion(pool, continentRoot, { beginner });
  }
  if (source.length === 0) {
    source = pool === 'master' ? allSpecies() : CURATED_SPECIES;
  }
  if (source.length === 0) return null;

  const seenIds = new Set(seen);

  // Preference order: unseen and not the bird just played, then anything but
  // the bird just played, then anything at all. A player who has worked
  // through the whole pool still gets a round.
  let candidates = source.filter((seed) => seed.id !== excludeId && !seenIds.has(seed.id));
  if (candidates.length === 0) {
    candidates = source.filter((seed) => seed.id !== excludeId);
  }
  if (candidates.length === 0) {
    candidates = [...source];
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function markSeen(speciesId: string): void {
  const persisted = loadState();
  if (persisted.seenSpeciesIds.includes(speciesId)) return;

  const seen = [...persisted.seenSpeciesIds, speciesId];
  saveState({ ...persisted, seenSpeciesIds: seen.slice(-SEEN_LIMIT) });
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

const GameContext = createContext<GameContextValue | null>(null);
GameContext.displayName = 'GameContext';

export function GameProvider(props: { mode: GameMode; children: ReactNode }): JSX.Element {
  // Falls back rather than throwing: the route already validates the segment,
  // and a provider that renders nothing is worse than one that renders the
  // default puzzle.
  const config = useMemo<ModeConfig>(
    () => getMode(props.mode) ?? MODES['daily-standard'],
    [props.mode],
  );

  const [state, dispatch] = useReducer(gameReducer, config.id, initialRoundState);
  const { status, startedAt, secondsRemaining, currentAttempt, species, result, endedAt } = state;

  const abortRef = useRef<AbortController | null>(null);
  /** Guards against a slow first fetch resolving after a re-roll superseded it. */
  const roundTokenRef = useRef(0);
  const dateKeyRef = useRef<string | null>(null);
  /** The round already banked, so a re-run of the persist effect is a no-op. */
  const persistedRoundRef = useRef<string | null>(null);

  const runLoad = useCallback(
    async (excludeSpeciesId: string | null): Promise<void> => {
      // Read at load time rather than held in state: these can change in
      // another tab, and a round should open with whatever is stored now.
      const region = loadRegion();
      const beginner = loadBeginner();

      const token = roundTokenRef.current + 1;
      roundTokenRef.current = token;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // RESET first so a mode change carries the new mode into the fresh state;
      // LOAD_START rebuilds from whatever mode the reducer is holding.
      dispatch({ type: 'RESET', mode: config.id });
      dispatch({ type: 'LOAD_START' });

      try {
        let dossier: SpeciesDossier;
        let dateKey = todayKey();
        let servedSeedId: string | null = null;

        if (config.daily) {
          const payload = await fetchJson(
            `/api/daily?mode=${encodeURIComponent(config.id)}&region=${encodeURIComponent(region)}` +
              (beginner ? '&beginner=1' : ''),
            controller.signal,
            "Today's puzzle",
          );
          if (typeof payload !== 'object' || payload === null) {
            throw new Error("Today's puzzle came back empty.");
          }
          const envelope = payload as { date?: unknown; species?: unknown };
          if (typeof envelope.date === 'string' && DATE_KEY_PATTERN.test(envelope.date)) {
            // The server's date is authoritative for the streak: it is the key
            // the puzzle was drawn for, which is not always the client's today.
            dateKey = envelope.date;
          }
          dossier = asDossier(envelope.species);
        } else {
          const persisted = loadState();
          const seed = pickPracticeSeed(
            config.pool,
            region,
            beginner,
            persisted.seenSpeciesIds,
            excludeSpeciesId,
          );
          if (seed === null) {
            throw new Error('No species are available in this pool.');
          }

          const query =
            seed.inatTaxonId === null
              ? `name=${encodeURIComponent(seed.scientificName)}`
              : `id=${encodeURIComponent(String(seed.inatTaxonId))}`;

          dossier = asDossier(
            await fetchJson(`/api/species?${query}`, controller.signal, 'That species'),
          );
          servedSeedId = seed.id;
        }

        if (token !== roundTokenRef.current) return;

        // Recorded only once the round is actually the one on screen — a
        // superseded fetch must not burn a species out of the shuffle.
        if (servedSeedId !== null) markSeen(servedSeedId);

        dateKeyRef.current = dateKey;
        persistedRoundRef.current = null;
        dispatch({ type: 'LOAD_SUCCESS', species: dossier });
      } catch (error) {
        if (token !== roundTokenRef.current || isAbortError(error)) return;
        dispatch({ type: 'LOAD_ERROR', error: describeError(error) });
      }
    },
    [config],
  );

  useEffect(() => {
    void runLoad(null);
    return () => {
      abortRef.current?.abort();
    };
  }, [runLoad]);

  // The clock. `currentAttempt` is a dependency so each attempt gets a full
  // first second rather than inheriting the previous attempt's tick phase.
  useEffect(() => {
    if (status !== 'playing') return;
    if (startedAt === null) return;
    if (config.secondsPerAttempt === null) return;

    const interval = window.setInterval(() => {
      dispatch({ type: 'TICK' });
    }, TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [status, startedAt, currentAttempt, config.secondsPerAttempt]);

  // Expiry is dispatched from an effect rather than from inside the interval so
  // it reads the committed state, never a value closed over a tick ago.
  useEffect(() => {
    if (status !== 'playing') return;
    if (startedAt === null) return;
    if (secondsRemaining === null || secondsRemaining > 0) return;

    dispatch({ type: 'TIMEOUT', at: Date.now() });
  }, [status, startedAt, secondsRemaining]);

  // The one write per round.
  useEffect(() => {
    if (status !== 'won' && status !== 'lost') return;
    if (result === null || species === null) return;

    const roundKey = `${species.id}@${endedAt ?? 0}`;
    if (persistedRoundRef.current === roundKey) return;
    persistedRoundRef.current = roundKey;

    saveState(
      recordRoundResult(loadState(), {
        mode: config.id,
        result,
        speciesId: species.id,
        dateKey: dateKeyRef.current ?? todayKey(),
      }),
    );
  }, [status, result, species, endedAt, config.id]);

  const startRound = useCallback((): void => {
    if (status !== 'playing' || startedAt !== null) return;
    dispatch({ type: 'START_ROUND', at: Date.now() });
  }, [status, startedAt]);

  const submitGuess = useCallback(
    (raw: string): void => {
      if (status !== 'playing' || species === null) return;

      const value = raw.trim();
      if (value.length === 0) return;

      dispatch({
        type: 'GUESS',
        raw: value,
        correct: isCorrectGuess(value, {
          commonName: species.commonName,
          scientificName: species.scientificName,
        }),
        at: Date.now(),
      });
    },
    [status, species],
  );

  const skipAttempt = useCallback((): void => {
    if (status !== 'playing') return;
    dispatch({ type: 'SKIP', at: Date.now() });
  }, [status]);

  // Revealing the next clue spends the attempt — that exchange is the game.
  // Kept distinct from `skipAttempt` so the two buttons can be labelled
  // honestly ("Reveal next clue" vs "Skip") without the UI inventing the rule.
  const revealNextHint = useCallback((): void => {
    if (status !== 'playing') return;
    dispatch({ type: 'SKIP', at: Date.now() });
  }, [status]);

  const loadNewRound = useCallback((): void => {
    if (config.daily) return;
    void runLoad(species?.id ?? null);
  }, [config.daily, runLoad, species]);

  const unlockedStages = useMemo<HintStage[]>(() => {
    // A finished round shows the whole dossier — there is nothing left to hide.
    if (status === 'won' || status === 'lost') return [...HINT_STAGES];
    return HINT_STAGES.slice(0, currentAttempt);
  }, [status, currentAttempt]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      submitGuess,
      skipAttempt,
      revealNextHint,
      startRound,
      loadNewRound,
      unlockedStages,
      config,
    }),
    [
      state,
      submitGuess,
      skipAttempt,
      revealNextHint,
      startRound,
      loadNewRound,
      unlockedStages,
      config,
    ],
  );

  return <GameContext.Provider value={value}>{props.children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) {
    throw new Error('useGame() must be called inside a <GameProvider>.');
  }
  return value;
}
