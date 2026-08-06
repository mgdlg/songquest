import type * as React from 'react';
import { Fragment } from 'react';

import styles from './RedactedText.module.css';

export interface RedactedTextProps {
  text: string;
  className?: string;
}

/**
 * The literal token produced by `redactDescription` in the game layer. It must
 * never reach the DOM as text — a curious player would read the answer out of
 * the markup.
 */
const REDACTION_TOKEN = '[REDACTED]';

/**
 * Non-breaking spaces, not ordinary ones: the bar is `color: transparent`, and
 * a run of collapsible whitespace would give it zero width. Nine characters is
 * about the width of a plausible species word.
 */
const BAR_FILL = String.fromCharCode(0x00a0).repeat(9);

/** Paragraph breaks in the source survive as separate `<p class="prose">`. */
function toParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function RedactedText({ text, className }: RedactedTextProps): React.JSX.Element {
  const paragraphs = typeof text === 'string' ? toParagraphs(text) : [];
  const rootClass = className ? `${styles.root} ${className}` : styles.root;

  if (paragraphs.length === 0) {
    return (
      <div className={rootClass}>
        <p className={styles.empty}>No description available for this species.</p>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const segments = paragraph.split(REDACTION_TOKEN);

        return (
          <p key={`p-${paragraphIndex}`} className={`prose ${styles.paragraph}`}>
            {segments.map((segment, segmentIndex) => (
              <Fragment key={`s-${paragraphIndex}-${segmentIndex}`}>
                {segment}
                {segmentIndex < segments.length - 1 ? (
                  <span className="redacted" role="img" aria-label="redacted word">
                    {BAR_FILL}
                  </span>
                ) : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
