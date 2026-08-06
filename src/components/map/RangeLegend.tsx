import { RANGE_LEGEND } from './mapConfig';
import styles from './RangeLegend.module.css';

/**
 * Only a custom-property name may be interpolated into the swatch fill.
 * `cssVar` is data, and data that reaches a `style` attribute gets validated.
 */
const CSS_VAR = /^--[a-z0-9-]+$/i;

/**
 * The key block beneath a distribution plate.
 *
 * Rendered as a list rather than a row of divs so a screen reader announces the
 * item count; the swatches are decorative because the label carries the meaning
 * (House Rule 4 — never state by colour alone).
 */
export function RangeLegend(props: {
  /** Defaults to the four seasonal classes in `RANGE_LEGEND`. */
  entries?: typeof RANGE_LEGEND;
  /** The palette-convention caveat. Suppress only where it is stated nearby. */
  showNote?: boolean;
  className?: string;
}) {
  const { entries = RANGE_LEGEND, showNote = true, className } = props;

  const usable = entries.filter((entry) => CSS_VAR.test(entry.cssVar));
  if (usable.length === 0) return null;

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <ul className={styles.legend}>
        {usable.map((entry) => (
          <li className={styles.item} key={entry.cssVar}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: `var(${entry.cssVar})` }}
              aria-hidden="true"
            />
            <span className={styles.label}>{entry.label}</span>
          </li>
        ))}
      </ul>

      {showNote ? (
        <p className={styles.note}>
          Shading shows GBIF occurrence records, not a surveyed seasonal range.
          The key above is the field-guide palette convention.
        </p>
      ) : null}
    </div>
  );
}
