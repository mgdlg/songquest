import type * as React from 'react';

import styles from './Seal.module.css';

export interface SealProps {
  children: React.ReactNode;
  size?: number;
  tone?: 'brass' | 'sage' | 'clay';
  className?: string;
}

/**
 * Brass wax-seal medallion used for rank tiers and the end-of-round stamp.
 * The diameter arrives as a custom property so the CSS can derive the type
 * size from it and the medallion stays proportional at any size.
 */
export function Seal({
  children,
  size = 72,
  tone = 'brass',
  className,
}: SealProps): React.JSX.Element {
  const classes = [styles.seal, styles[tone], className].filter(Boolean).join(' ');

  // Custom properties are not part of the CSSProperties index signature.
  const style = { ['--seal-size']: `${Math.max(24, size)}px` } as React.CSSProperties;

  return (
    <span className={classes} style={style}>
      <span className={styles.face}>{children}</span>
    </span>
  );
}
