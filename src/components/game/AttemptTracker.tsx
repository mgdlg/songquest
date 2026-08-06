import type { JSX } from 'react';
import type { AttemptNumber, GuessRecord } from '@/types/domain';
import styles from './AttemptTracker.module.css';

/** Attempts are 1-indexed; the game ships four, but `total` keeps this honest. */
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

/** Shared with GameBoard's share string so both spell attempts the same way. */
export function toRoman(n: number): string {
  return NUMERALS[n - 1] ?? String(n);
}

type PipState = 'pending' | 'current' | 'correct' | 'incorrect' | 'skipped' | 'timeout';

const SPOKEN: Record<PipState, string> = {
  pending: 'not yet attempted',
  current: 'current attempt',
  correct: 'correct',
  incorrect: 'incorrect guess',
  skipped: 'skipped',
  timeout: 'timed out',
};

/**
 * Marks are drawn rather than typed: Times New Roman has no dependable check
 * glyph, and a missing-glyph box would destroy the only non-colour state cue.
 */
function Mark({ state }: { state: PipState }): JSX.Element | null {
  if (state === 'pending') return null;

  const common = {
    className: styles.mark,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    focusable: 'false' as const,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (state) {
    case 'correct':
      return (
        <svg {...common}>
          <path d="M4 13.2 9.4 18.5 20 6.5" />
        </svg>
      );
    case 'incorrect':
      return (
        <svg {...common}>
          <path d="M6 6 18 18M18 6 6 18" />
        </svg>
      );
    case 'skipped':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'timeout':
      return (
        <svg {...common}>
          <circle cx="12" cy="12.8" r="7.6" />
          <path d="M12 8.6v4.4l3 1.8M9 3h6" />
        </svg>
      );
    case 'current':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="12" cy="12" r="4.4" />
        </svg>
      );
    default:
      return null;
  }
}

export function AttemptTracker(props: {
  current: AttemptNumber;
  guesses: GuessRecord[];
  total?: number;
}): JSX.Element {
  const total = props.total ?? 4;
  const guesses = props.guesses ?? [];

  const pips = Array.from({ length: total }, (_, i) => {
    const attempt = i + 1;
    const record = guesses.find((g) => g.attempt === attempt);

    let state: PipState;
    if (record) {
      if (record.correct) state = 'correct';
      else if (record.kind === 'skip') state = 'skipped';
      else if (record.kind === 'timeout') state = 'timeout';
      else state = 'incorrect';
    } else if (attempt === props.current) {
      state = 'current';
    } else {
      state = 'pending';
    }

    // Reading the rejected guess aloud is the whole value of the label for a
    // screen-reader user, who cannot see the strike-through log.
    const detail =
      state === 'incorrect' && record && record.raw.trim() !== ''
        ? `${SPOKEN.incorrect}, ${record.raw.trim()}`
        : SPOKEN[state];

    return { attempt, state, label: `Attempt ${toRoman(attempt)}: ${detail}` };
  });

  return (
    <ol className={styles.track} aria-label="Attempts">
      {pips.map((pip) => (
        <li
          key={pip.attempt}
          className={`${styles.pip} ${styles[pip.state]}`}
          aria-label={pip.label}
          title={pip.label}
        >
          <span className={styles.ring} aria-hidden="true">
            <Mark state={pip.state} />
          </span>
          <span className={styles.numeral} aria-hidden="true">
            {toRoman(pip.attempt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
