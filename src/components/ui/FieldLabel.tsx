import type * as React from 'react';

import styles from './FieldLabel.module.css';

export interface FieldLabelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The engraved small-caps label that heads every field-guide section.
 * Inline-block so it can sit as a flex item between two hairline rules.
 */
export function FieldLabel({ children, className }: FieldLabelProps): React.JSX.Element {
  const classes = [styles.fieldLabel, className].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
