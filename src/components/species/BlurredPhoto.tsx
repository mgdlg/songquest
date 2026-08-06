'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';

import styles from './BlurredPhoto.module.css';

export interface BlurredPhotoProps {
  src: string;
  alt: string;
  blurPx?: number;
  revealed?: boolean;
  attribution?: string;
  license?: string;
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Client-side because a remote photo can 404 after the dossier is assembled;
 * the `onError` swap to the paper placeholder needs local state.
 *
 * `revealed` resolves to `blur(0px)` rather than `none` — `filter` cannot
 * interpolate from a keyword, and the reveal has to actually animate.
 */
export function BlurredPhoto({
  src,
  alt,
  blurPx = 18,
  revealed = false,
  attribution,
  license,
}: BlurredPhotoProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const hasSource = isPresent(src);
  const showPlaceholder = !hasSource || failed;
  const radius = revealed ? 0 : Math.max(0, blurPx);

  const credit = [attribution, license].filter(isPresent).join(' · ');

  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>
        {showPlaceholder ? (
          <div
            className={styles.placeholder}
            role="img"
            aria-label={`No photograph available for ${alt}`}
          >
            <span className={styles.placeholderLabel} aria-hidden="true">
              no photograph available
            </span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element --
             next/image would need every upstream photo host registered in
             next.config.mjs, and iNaturalist serves from several. */
          <img
            className={styles.image}
            src={src}
            alt={alt}
            /* The overscale exists only so the blur kernel never samples past
               the frame. At zero radius it has no job left and would just be an
               8% crop of the plate, so it is released as the photo sharpens. */
            data-sharp={radius === 0}
            style={{ filter: `blur(${radius}px)` }}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {credit.length > 0 ? <figcaption className={styles.caption}>{credit}</figcaption> : null}
    </figure>
  );
}
