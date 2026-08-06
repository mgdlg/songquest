/**
 * Guess matching.
 *
 * The tolerance is deliberately narrow. Birders type "Scissor-tailed
 * Flycatcher" at speed and deserve to survive a transposed letter; they do not
 * deserve to have "Willow Flycatcher" accepted for "Alder Flycatcher", which is
 * the single most consequential near-miss in the whole game.
 */

/** One permitted edit per this many characters of the target. */
export const EDITS_PER_CHARS = 8;

/** Diacritic combining marks, stripped after an NFD decomposition. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;
/** ASCII hyphen plus the typographic dashes that paste in from field guides. */
const HYPHENS = /[-\u2010\u2011\u2012\u2013\u2014\u2212]/g;
/** ASCII apostrophe plus the curly and accent-shaped variants. */
const APOSTROPHES = /['\u2018\u2019\u02bc`\u00b4]/g;
const WHITESPACE = /\s+/g;

/**
 * Lowercase, de-accented, de-punctuated, single-spaced.
 *
 * Hyphens are removed rather than replaced with a space, so "Scissor-tailed"
 * and "scissortailed" are identical and "scissor tailed" is one edit away.
 */
export function normalise(s: string): string {
  if (typeof s !== 'string' || s.length === 0) return '';

  return s
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(HYPHENS, '')
    .replace(APOSTROPHES, '')
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();
}

/** Edits allowed against a normalised target of the given length. */
export function toleranceFor(target: string): number {
  return Math.ceil(target.length / EDITS_PER_CHARS);
}

/**
 * Optimal string alignment distance — Levenshtein plus adjacent transposition.
 *
 * Iterative with three rolling rows; the transposition case needs the row two
 * back, which is why this is not the usual two-row implementation. OSA rather
 * than unrestricted Damerau is intentional: at these tolerances the difference
 * never shows, and OSA needs no alphabet-sized bookkeeping.
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let twoBack = new Int32Array(n + 1);
  let oneBack = new Int32Array(n + 1);
  let current = new Int32Array(n + 1);

  for (let j = 0; j <= n; j += 1) oneBack[j] = j;

  for (let i = 1; i <= m; i += 1) {
    current[0] = i;
    const ai = a.charCodeAt(i - 1);
    const aPrev = i > 1 ? a.charCodeAt(i - 2) : -1;

    for (let j = 1; j <= n; j += 1) {
      const bj = b.charCodeAt(j - 1);
      const substitution = oneBack[j - 1] + (ai === bj ? 0 : 1);
      const deletion = oneBack[j] + 1;
      const insertion = current[j - 1] + 1;

      let best = substitution < deletion ? substitution : deletion;
      if (insertion < best) best = insertion;

      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && aPrev === bj) {
        const transposition = twoBack[j - 2] + 1;
        if (transposition < best) best = transposition;
      }

      current[j] = best;
    }

    const recycled = twoBack;
    twoBack = oneBack;
    oneBack = current;
    current = recycled;
  }

  return oneBack[n];
}

/**
 * Correct if the guess normalises to the common name or the binomial exactly,
 * or lands within the per-target edit tolerance of either. Nothing else counts —
 * a bare genus or a bare epithet is ambiguous across the pool and is rejected.
 */
export function isCorrectGuess(
  guess: string,
  species: { commonName: string; scientificName: string },
): boolean {
  const attempt = normalise(guess);
  if (attempt.length === 0) return false;

  const targets = [normalise(species.commonName), normalise(species.scientificName)].filter(
    (t) => t.length > 0,
  );

  for (const target of targets) {
    if (attempt === target) return true;
  }

  for (const target of targets) {
    const tolerance = toleranceFor(target);
    // Length alone can rule it out, which also keeps a pasted paragraph from
    // running the full matrix.
    if (Math.abs(attempt.length - target.length) > tolerance) continue;
    if (damerauLevenshtein(attempt, target) <= tolerance) return true;
  }

  return false;
}
