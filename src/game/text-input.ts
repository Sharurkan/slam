import { normalizeWord } from '../shared/text';

/** The single letter typed, uppercase and without accent, or null. */
export function normalizeLetter(input: string): string | null {
  const letter = normalizeWord(input);
  return /^[A-Z]$/.test(letter) ? letter : null;
}

/** A typed word, compared leniently: no case, no accents, no spaces or hyphens. */
export function normalizeAnswer(input: string): string {
  return normalizeWord(input);
}
