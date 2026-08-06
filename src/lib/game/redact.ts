/**
 * Description redaction.
 *
 * Wikipedia summaries name the bird in the first six words, so the visual hint
 * would otherwise be a giveaway rather than a clue. Everything that could
 * identify the species is blacked out before the text reaches the client.
 */

export const REDACTION_TOKEN = '[REDACTED]';

/**
 * Words too generic to be worth blacking out. Redacting them would turn
 * "a common bird of North American gardens" into a row of bars that tells the
 * player nothing and reads as broken.
 */
export const GENERIC_BIRD_WORDS: ReadonlySet<string> = new Set([
  'bird',
  'species',
  'family',
  'genus',
  'north',
  'american',
  'common',
  'greater',
  'lesser',
]);

/** Words this short carry no identifying signal ("of", "the", "red"). */
const MIN_WORD_LENGTH = 4;

/**
 * Marks a redacted span while the passes run. Using a placeholder rather than
 * the token itself means a later pattern cannot match inside an earlier
 * replacement and shred it.
 */
const SENTINEL = '\u0000';

const WORD_CHAR = /\w/;

/**
 * Escapes a literal for interpolation into a `RegExp`. Species names are full
 * of characters the regex engine reads as syntax — the abbreviated binomial
 * carries a `.`, and `[]()` show up in scraped attribution text.
 *
 * `-` is deliberately not escaped: outside a character class it is already a
 * literal, and `\-` is a syntax error under the `u` flag.
 */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whitespace inside a term is matched as `\s+`, so a name broken across a line
 * in the source text still matches. Word boundaries are only applied on sides
 * that actually end in a word character, since `\b` next to punctuation asserts
 * the opposite of what it looks like it asserts.
 */
function termPattern(term: string): RegExp | null {
  const trimmed = term.trim();
  if (trimmed.length === 0) return null;

  const body = trimmed.split(/\s+/).map(escapeRegExp).join('\\s+');
  const lead = WORD_CHAR.test(trimmed.charAt(0)) ? '\\b' : '';
  const tail = WORD_CHAR.test(trimmed.charAt(trimmed.length - 1)) ? '\\b' : '';

  return new RegExp(`${lead}${body}${tail}`, 'gi');
}

/**
 * The redaction terms, in the order they must be applied.
 *
 * Order is load-bearing: the longest forms go first. Redact the genus before
 * the binomial and "Tyrannus forficatus" becomes "[REDACTED] forficatus" —
 * two bars and a legible epithet instead of one clean bar.
 */
export function redactionTermsFor(species: {
  commonName: string;
  scientificName: string;
}): string[] {
  const commonName = (species.commonName ?? '').trim();
  const scientificName = (species.scientificName ?? '').trim();

  const terms: string[] = [];
  const seen = new Set<string>();

  const push = (term: string): void => {
    const value = term.trim();
    const key = value.toLowerCase();
    if (value.length === 0 || seen.has(key)) return;
    seen.add(key);
    terms.push(value);
  };

  push(commonName);
  push(scientificName);

  const binomialParts = scientificName.split(/\s+/).filter((p) => p.length > 0);
  const genus = binomialParts[0] ?? '';
  const epithets = binomialParts.slice(1);

  // "T. forficatus" — the abbreviated form Wikipedia switches to after the
  // first mention, and the one that most often survives a naive redactor.
  if (genus.length > 0 && epithets.length > 0) {
    push(`${genus.charAt(0)}. ${epithets.join(' ')}`);
  }

  push(genus);
  for (const epithet of epithets) push(epithet);

  for (const word of commonName.split(/[\s\u2010\u2011\u2012\u2013\u2014-]+/)) {
    const cleaned = word.replace(/[^\p{L}\p{N}'\u2019]/gu, '');
    if (cleaned.length < MIN_WORD_LENGTH) continue;
    if (GENERIC_BIRD_WORDS.has(cleaned.toLowerCase())) continue;
    push(cleaned);

    // Eponyms are the awkward case: our data says "Wilson's" with a straight
    // quote, the encyclopaedia says "Wilson’s" with a curly one. Redacting the
    // stem catches both and leaves only the possessive tail behind.
    const stem = cleaned.split(/['\u2019]/)[0] ?? '';
    if (stem.length >= MIN_WORD_LENGTH && !GENERIC_BIRD_WORDS.has(stem.toLowerCase())) {
      push(stem);
    }
  }

  return terms;
}

/**
 * Case-insensitive, whole-word, global. Returns the text with every
 * identifying mention replaced by the literal `[REDACTED]`.
 */
export function redactDescription(
  text: string,
  species: { commonName: string; scientificName: string },
): string {
  if (typeof text !== 'string' || text.length === 0) return '';

  // The sentinel must not already occur in the source, or stray nulls would
  // surface as phantom redactions.
  let working = text.split(SENTINEL).join('');

  for (const term of redactionTermsFor(species)) {
    const pattern = termPattern(term);
    if (pattern === null) continue;
    working = working.replace(pattern, SENTINEL);
  }

  return working.split(SENTINEL).join(REDACTION_TOKEN);
}
