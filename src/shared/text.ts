const LIGATURES: Readonly<Record<string, string>> = { Œ: 'OE', Æ: 'AE' };

/** Uppercase, accents removed, ligatures expanded: "Cœur à l'été" → "COEUR A L'ETE". */
export function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[ŒÆ]/g, (ligature) => LIGATURES[ligature] ?? ligature)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Keeps only the letters A to Z, for a lenient comparison of typed words. */
export function normalizeWord(text: string): string {
  return normalizeText(text).replace(/[^A-Z]/g, '');
}

/** An answer word cut around its highlighted letter, as written (accents kept). */
export interface AnswerParts {
  before: string;
  letter: string;
  after: string;
}

const MARKED = /^([^[\]]*)\[([^[\]])\]([^[\]]*)$/;

/**
 * Cuts the answer around the letter: the one marked with brackets ("Arc-en-[c]iel"),
 * else the first that matches without accents. Null when the letter is missing.
 */
export function splitAnswer(answer: string, letter: string): AnswerParts | null {
  const matches = (char: string): boolean => normalizeText(char).includes(letter);
  if (/[[\]]/.test(answer)) {
    const marked = MARKED.exec(answer);
    if (marked === null) return null;
    const [, before = '', char = '', after = ''] = marked;
    return matches(char) ? { before, letter: char, after } : null;
  }
  const chars = Array.from(answer);
  const index = chars.findIndex(matches);
  if (index < 0) return null;
  return {
    before: chars.slice(0, index).join(''),
    letter: chars[index] ?? '',
    after: chars.slice(index + 1).join(''),
  };
}
