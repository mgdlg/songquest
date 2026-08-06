'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { GuessRecord, HintStage as HintStageId, RoundState } from '@/types/domain';
import { Button, Panel, Skeleton } from '@/components/ui';
import { SpeciesCard } from '@/components/species';
import { useGame } from '@/state/GameContext';
import { AttemptTracker, toRoman } from './AttemptTracker';
import { CountdownTimer } from './CountdownTimer';
import { GuessInput } from './GuessInput';
import { HintStage } from './HintStage';
import styles from './GameBoard.module.css';

const STAGE_ORDER: readonly HintStageId[] = ['audio', 'geography', 'taxonomy', 'visual'];

/**
 * The stages that live in the right-hand column. `visual` is absent because the
 * field-marks plate is docked on the left for the whole round — it is still the
 * fourth attempt's reward, but the reward is sharpness, not appearance.
 */
const COLUMN_STAGES: readonly HintStageId[] = ['audio', 'geography', 'taxonomy'];

/**
 * Blur radius by attempt. Attempt IV lands at a value where a good birder can
 * work the silhouette and the wing bars but not simply read the bird off the
 * screen — the plate is a clue, not the answer.
 */
const PHOTO_BLUR_BY_ATTEMPT: Record<1 | 2 | 3 | 4, number> = {
  1: 30,
  2: 22,
  3: 14,
  // Attempt IV hands over the plate. It is the last attempt, the fourth clue is
  // supposed to be the strongest one, and a still-blurred photograph on the
  // final guess is a clue withheld rather than a clue given.
  4: 0,
};

/** How long the "copied" confirmation stays on screen. */
const SHARE_NOTE_MS = 4000;

/** Glyphs for the share string. Text, not emoji — this is a field guide. */
const SHARE_GLYPH: Record<GuessRecord['kind'] | 'correct' | 'unused', string> = {
  correct: '✔',
  guess: '✘',
  skip: '–',
  timeout: '○',
  unused: '·',
};

function buildShareText(state: RoundState, modeLabel: string): string {
  const result = state.result;
  const strip = STAGE_ORDER.map((_, i) => {
    const record = state.guesses.find((g) => g.attempt === i + 1);
    if (!record) return SHARE_GLYPH.unused;
    return record.correct ? SHARE_GLYPH.correct : SHARE_GLYPH[record.kind];
  }).join(' ');

  const verdict =
    result && result.won && result.solvedOnAttempt
      ? `Identified on attempt ${toRoman(result.solvedOnAttempt)}`
      : 'Not identified';
  const score = result ? `${result.score.total.toLocaleString('en-US')} pts` : '0 pts';

  return `SONG QUEST · ${modeLabel}\n${strip}\n${verdict} · ${score}`;
}

export function GameBoard(): JSX.Element {
  const { state, submitGuess, skipAttempt, revealNextHint, loadNewRound, unlockedStages, config } =
    useGame();

  const [shareNote, setShareNote] = useState('');
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (shareTimer.current) clearTimeout(shareTimer.current);
    },
    [],
  );

  const unlocked = useMemo(() => new Set<HintStageId>(unlockedStages), [unlockedStages]);

  /** Newest clue first, then the closed plates in their printed order. */
  const orderedStages = useMemo(() => {
    const open = COLUMN_STAGES.filter((s) => unlocked.has(s)).reverse();
    const closed = COLUMN_STAGES.filter((s) => !unlocked.has(s));
    return [...open, ...closed];
  }, [unlocked]);

  const lastGuess = state.guesses.length > 0 ? state.guesses[state.guesses.length - 1] : null;
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!lastGuess) {
      setFeedback('');
      return;
    }
    if (lastGuess.correct) {
      setFeedback('Correct.');
      return;
    }
    const opening =
      lastGuess.kind === 'timeout'
        ? 'Time expired'
        : lastGuess.kind === 'skip'
          ? 'Attempt skipped'
          : `Not ${lastGuess.raw.trim() || 'a match'}`;
    setFeedback(`${opening}. Attempt ${toRoman(state.currentAttempt)} of ${STAGE_ORDER.length}.`);
  }, [lastGuess, state.currentAttempt]);

  const handleRetry = useCallback(() => {
    // `loadNewRound` is a no-op on daily modes by contract, so the only way back
    // from a failed daily fetch is a fresh request for the route.
    if (config.daily) {
      if (typeof window !== 'undefined') window.location.reload();
      return;
    }
    loadNewRound();
  }, [config.daily, loadNewRound]);

  const handleShare = useCallback(async () => {
    const text = buildShareText(state, config.label);
    if (shareTimer.current) clearTimeout(shareTimer.current);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        setShareNote('Result copied to the clipboard.');
      } else {
        setShareNote('Copying is unavailable in this browser.');
      }
    } catch {
      setShareNote('Copying was blocked by the browser.');
    }
    shareTimer.current = setTimeout(() => setShareNote(''), SHARE_NOTE_MS);
  }, [state, config.label]);

  // Hoisted so the null check narrows inside the stage map callback.
  const species = state.species;

  const wrongGuesses = state.guesses.filter(
    (g) => !g.correct && g.kind === 'guess' && g.raw.trim() !== '',
  );

  const showTimer =
    config.secondsPerAttempt !== null && state.status === 'playing' && state.secondsRemaining !== null;

  const resolved = state.status === 'won' || state.status === 'lost';

  return (
    // A region rather than <main>: the app shell owns the main landmark, and two
    // would be a landmark conflict.
    <section className={styles.board} aria-label="Play surface">
      {/* No masthead here. The play route's own header already names the mode
          and lists its constraints; repeating the title and blurb pushed the
          first clip below the fold on a laptop. This header carries only the
          live state — attempts and, in hardcore, the clock. */}
      <header className={styles.header}>
        <div className={styles.gauges}>
          <AttemptTracker
            current={state.currentAttempt}
            guesses={state.guesses}
            total={STAGE_ORDER.length}
          />
          {showTimer ? (
            <CountdownTimer
              secondsRemaining={state.secondsRemaining ?? 0}
              total={config.secondsPerAttempt ?? 0}
            />
          ) : null}
        </div>
      </header>

      <div className={styles.headerRule} aria-hidden="true" />

      {state.status === 'idle' || state.status === 'loading' ? (
        <div className={styles.loading} aria-busy="true" aria-label="Preparing the round">
          <Panel tone="paper" className={styles.loadingPanel}>
            <Skeleton height="var(--space-4)" width="30%" />
            <Skeleton height="var(--space-8)" />
            <Skeleton height="var(--space-6)" />
          </Panel>
          <Panel tone="warm" className={styles.loadingPanel}>
            <Skeleton height="var(--space-4)" width="24%" />
            <Skeleton height="var(--space-6)" />
          </Panel>
          <p className={styles.loadingNote}>Pulling recordings, plates, and range data…</p>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Panel tone="clay" label="Transmission failed" className={styles.errorPanel}>
          <p className={styles.errorText}>
            {state.error ?? 'The round could not be assembled from the archives.'}
          </p>
          <p className={styles.errorHint}>
            Recordings come from Xeno-canto and plates from iNaturalist; either can be briefly
            unreachable.
          </p>
          <Button variant="primary" onClick={handleRetry}>
            Try again
          </Button>
        </Panel>
      ) : null}

      {resolved && species && state.result ? (
        <div className={styles.cardDock}>
          <SpeciesCard
            species={species}
            result={state.result}
            mode={config}
            onNext={config.daily ? undefined : loadNewRound}
            onShare={() => {
              void handleShare();
            }}
          />
          <p className={styles.shareNote} role="status" aria-live="polite">
            {shareNote}
          </p>
        </div>
      ) : null}

      {resolved && (!species || !state.result) ? (
        <Panel tone="clay" label="Round incomplete" className={styles.errorPanel}>
          <p className={styles.errorText}>
            The round ended before its species record finished loading.
          </p>
          <Button variant="primary" onClick={handleRetry}>
            Start again
          </Button>
        </Panel>
      ) : null}

      {state.status === 'playing' && species ? (
        <div className={styles.arena}>
          {/* The plate is docked, not unlocked. Having the specimen on screen
              from the first second gives the round something to look at while
              the ear does the work; the difficulty lives in the blur, which
              sharpens as attempts are spent, rather than in a closed panel. */}
          <aside className={styles.plate} aria-label="Field marks">
            <p className={styles.plateLabel}>Field marks</p>
            <HintStage
              stage="visual"
              species={species}
              unlocked
              bare
              config={config}
              photoBlurPx={PHOTO_BLUR_BY_ATTEMPT[state.currentAttempt]}
            />
          </aside>

          <div className={styles.controls}>
            <div className={styles.dock}>
              {wrongGuesses.length > 0 ? (
                <ul className={styles.log} aria-label="Rejected identifications">
                  {wrongGuesses.map((g) => (
                    <li key={`${g.attempt}-${g.raw}`} className={styles.logItem}>
                      {g.raw.trim()}
                    </li>
                  ))}
                </ul>
              ) : null}

              <GuessInput
                pool={config.pool}
                onSubmit={submitGuess}
                onSkip={skipAttempt}
                disabled={state.status !== 'playing'}
                autoFocus
              />

              {unlockedStages.length < STAGE_ORDER.length ? (
                <div className={styles.revealRow}>
                  <Button variant="ghost" size="sm" onClick={revealNextHint}>
                    Reveal the next clue
                  </Button>
                </div>
              ) : null}
            </div>

            <section className={styles.stack} aria-label="Clues">
              {orderedStages.map((stage) => {
                const isOpen = unlocked.has(stage);
                return (
                  <div
                    key={stage}
                    className={`${styles.stageSlot} ${isOpen ? styles.stageOpen : ''}`}
                  >
                    <HintStage stage={stage} species={species} unlocked={isOpen} config={config} />
                  </div>
                );
              })}
            </section>
          </div>

          <div className="srOnly" role="status" aria-live="polite">
            {feedback}
          </div>
        </div>
      ) : null}
    </section>
  );
}
