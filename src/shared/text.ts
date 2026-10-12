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
