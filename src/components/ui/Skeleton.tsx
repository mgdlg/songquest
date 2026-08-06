import type * as React from 'react';

import styles from './Skeleton.module.css';

export interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  className?: string;
}

/** Bare numbers are pixels; strings pass through as authored CSS lengths. */
function toLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Decorative placeholder — hidden from assistive tech. Callers should mark
 * the surrounding region `aria-busy="true"` so the wait is announced once
 * rather than once per bar.
 */
export function Skeleton({
  height = '1rem',
  width = '100%',
  className,
}: SkeletonProps): React.JSX.Element {
  const classes = [styles.skeleton, className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      style={{ height: toLength(height), width: toLength(width) }}
      aria-hidden="true"
    />
  );
}
