import type * as React from 'react';

import { FieldLabel } from './FieldLabel';
import styles from './Panel.module.css';

export interface PanelProps {
  children: React.ReactNode;
  label?: string;
  tone?: 'paper' | 'warm' | 'sage' | 'slate' | 'clay';
  raised?: boolean;
  className?: string;
}

/**
 * A sheet of paper. When `label` is present the panel becomes a labelled
 * group — the visible label is hidden from assistive tech because the same
 * string is already carried by `aria-label`, and hearing it twice is noise.
 */
export function Panel({
  children,
  label,
  tone = 'paper',
  raised = false,
  className,
}: PanelProps): React.JSX.Element {
  const classes = [
    styles.panel,
    styles[tone],
    raised ? styles.raised : null,
    label ? styles.labelled : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hasLabel = typeof label === 'string' && label.trim().length > 0;

  return (
    <div
      className={classes}
      role={hasLabel ? 'group' : undefined}
      aria-label={hasLabel ? label : undefined}
    >
      {hasLabel ? (
        <div className={styles.labelRow} aria-hidden="true">
          <FieldLabel className={styles.label}>{label}</FieldLabel>
        </div>
      ) : null}
      {children}
    </div>
  );
}
