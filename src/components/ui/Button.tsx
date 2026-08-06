import type * as React from 'react';

import styles from './Button.module.css';

/**
 * No `'use client'`: this component owns no state and touches no browser API,
 * so it compiles into whichever bundle its importer belongs to. Client callers
 * may pass `onClick`; server callers must not.
 */
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  fullWidth = false,
  className,
}: ButtonProps): React.JSX.Element {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
    >
      <span className={styles.inner}>{children}</span>
    </button>
  );
}
