'use client';

import type * as React from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';

import type { ScoreBreakdown } from '@/types/domain';

import styles from './ScoreBreakdownPanel.module.css';

export interface ScoreBreakdownPanelProps {
  score: ScoreBreakdown;
  className?: string;
}

const MINUS_SIGN = '−';
const MULTIPLICATION_SIGN = '×';

/**
 * Locale-independent grouping. `toLocaleString` would resolve differently on
 * the server and in the browser and trip a hydration mismatch.
 */
export function formatPoints(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = safe < 0 ? MINUS_SIGN : '';
  return sign + String(Math.abs(safe)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `useLayoutEffect` warns during SSR; the count-up must not flash the final value. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;
  if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return true;
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Durations live in globals.css; read the token rather than restating it here. */
function readDurationToken(name: string): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return 0;
  if (raw.endsWith('ms')) return amount;
  if (raw.endsWith('s')) return amount * 1000;
  return 0;
}

function useCountUp(target: number): number {
  const [value, setValue] = useState(target);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }

    const duration = readDurationToken('--dur-slow');
    // A hidden tab does not composite, so `requestAnimationFrame` never fires
    // and the counter would sit at the 0 it is seeded with. Land on the final
    // figure instead: an un-animated total is fine, a total that reads 0 after
    // a win is not.
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (duration <= 0 || target <= 0 || hidden) {
      setValue(target);
      return undefined;
    }

    let frame = 0;
    const started = performance.now();
    setValue(0);

    const step = (now: number): void => {
      const t = Math.min(1, (now - started) / duration);
      // Cubic ease-out: the tally decelerates into its total instead of snapping.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

export function ScoreBreakdownPanel({
  score,
  className,
}: ScoreBreakdownPanelProps): React.JSX.Element {
  const total = Number.isFinite(score?.total) ? score.total : 0;
  const tallied = useCountUp(total);

  const base = Number.isFinite(score?.base) ? score.base : 0;
  const multiplier = Number.isFinite(score?.multiplier) ? score.multiplier : 0;
  const penalty = Number.isFinite(score?.timePenalty) ? Math.max(0, score.timePenalty) : 0;
  const seconds = Number.isFinite(score?.secondsElapsed) ? Math.max(0, score.secondsElapsed) : 0;

  return (
    <table className={className ? `${styles.table} ${className}` : styles.table}>
      <caption className={`fieldLabel ${styles.caption}`}>Tally</caption>
      <tbody>
        <tr>
          <th scope="row" className={styles.label}>
            Base
          </th>
          <td className={styles.figure}>{formatPoints(base)}</td>
        </tr>
        <tr>
          <th scope="row" className={styles.label}>
            Attempt multiplier
          </th>
          <td className={styles.figure}>
            {MULTIPLICATION_SIGN}
            {multiplier.toFixed(2)}
          </td>
        </tr>
        <tr>
          <th scope="row" className={styles.label}>
            Time penalty
            <span className={styles.note}>{seconds}s elapsed</span>
          </th>
          <td className={styles.figure}>
            {penalty > 0 ? `${MINUS_SIGN}${formatPoints(penalty)}` : formatPoints(0)}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr className={styles.totalRow}>
          <th scope="row" className={styles.totalLabel}>
            Total
          </th>
          <td className={styles.total}>
            <span aria-hidden="true">{formatPoints(tallied)}</span>
            <span className="srOnly">{`${formatPoints(total)} points`}</span>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
