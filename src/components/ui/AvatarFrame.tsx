import type * as React from 'react';

import styles from './AvatarFrame.module.css';

export interface AvatarFrameProps {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}

/**
 * Oval brass frame around an Audubon-style plate.
 *
 * Plain `<img>` rather than `next/image`: the photos come from iNaturalist's
 * CDN and the remote-pattern allow-list lives in a config this component does
 * not own. An empty or blank `src` degrades to an engraved blank plate — the
 * dossier builder is allowed to return one when the photo lookup fails.
 */
export function AvatarFrame({
  src,
  alt,
  size = 96,
  className,
}: AvatarFrameProps): React.JSX.Element {
  const classes = [styles.frame, className].filter(Boolean).join(' ');

  // Custom properties are not part of the CSSProperties index signature.
  const style = { ['--avatar-size']: `${Math.max(24, size)}px` } as React.CSSProperties;

  const hasImage = typeof src === 'string' && src.trim().length > 0;

  return (
    <span className={classes} style={style}>
      <span className={styles.mount}>
        {hasImage ? (
          <img
            className={styles.plate}
            src={src}
            alt={alt}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={styles.blank} role="img" aria-label={alt} />
        )}
      </span>
    </span>
  );
}
