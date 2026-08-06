import type * as React from 'react';

import type { SpeciesDossier } from '@/types/domain';

import styles from './TaxonomyPanel.module.css';

export interface TaxonomyPanelProps {
  taxonomy: SpeciesDossier['taxonomy'];
  scientificName?: string;
  /**
   * Defaults to `false`: this panel also renders as the attempt-3 taxonomy
   * hint, where printing the binomial would hand over the answer. Only the
   * end-of-round species card opts in.
   */
  revealSpecies?: boolean;
}

const EM_DASH = '—';

function orDash(value: string | undefined | null): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : EM_DASH;
}

export function TaxonomyPanel({
  taxonomy,
  scientificName,
  revealSpecies = false,
}: TaxonomyPanelProps): React.JSX.Element {
  const showSpecies =
    revealSpecies === true && typeof scientificName === 'string' && scientificName.trim().length > 0;

  return (
    <table className={styles.table}>
      <caption className={`fieldLabel ${styles.caption}`}>Classification</caption>
      <tbody>
        <tr className={styles.row}>
          <th scope="row" className={styles.rank}>
            Order
          </th>
          <td className={styles.value}>{orDash(taxonomy?.order)}</td>
        </tr>
        <tr className={styles.row}>
          <th scope="row" className={styles.rank}>
            Family
          </th>
          <td className={styles.value}>{orDash(taxonomy?.family)}</td>
        </tr>
        <tr className={styles.row}>
          <th scope="row" className={styles.rank}>
            Genus
          </th>
          <td className={`${styles.value} ${styles.italic}`}>{orDash(taxonomy?.genus)}</td>
        </tr>
        {showSpecies ? (
          <tr className={styles.row}>
            <th scope="row" className={styles.rank}>
              Species
            </th>
            <td className={`${styles.value} binomial`}>{scientificName.trim()}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
