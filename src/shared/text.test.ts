import { describe, expect, it } from 'vitest';
import { normalizeText, normalizeWord, splitAnswer } from './text';

describe('normalizeText', () => {
  it('uppercases', () => {
    expect(normalizeText('bonjour')).toBe('BONJOUR');
  });

  it('removes accents', () => {
    expect(normalizeText('Élève à la fenêtre, ça où')).toBe('ELEVE A LA FENETRE, CA OU');
  });

  it('expands ligatures, lowercase or uppercase', () => {
    expect(normalizeText('cœur Œuf ex æquo')).toBe('COEUR OEUF EX AEQUO');
  });

  it('keeps apostrophes, hyphens and punctuation', () => {
    expect(normalizeText("l'arc-en-ciel !")).toBe("L'ARC-EN-CIEL !");
  });
});

describe('normalizeWord', () => {
  it('keeps only the letters', () => {
    expect(normalizeWord(" l'Arc-en-ciel ! ")).toBe('LARCENCIEL');
  });

  it('expands ligatures', () => {
    expect(normalizeWord('sœur')).toBe('SOEUR');
  });
});

describe('splitAnswer', () => {
  it('highlights the first matching letter, accents ignored', () => {
    expect(splitAnswer('Dimanche', 'D')).toEqual({ before: '', letter: 'D', after: 'imanche' });
    expect(splitAnswer('Tour Eiffel', 'E')).toEqual({
      before: 'Tour ',
      letter: 'E',
      after: 'iffel',
    });
    expect(splitAnswer('Été', 'E')).toEqual({ before: '', letter: 'É', after: 'té' });
    expect(splitAnswer('Œuf', 'O')).toEqual({ before: '', letter: 'Œ', after: 'uf' });
  });

  it('highlights the letter marked with brackets', () => {
    expect(splitAnswer('Arc-en-[c]iel', 'C')).toEqual({
      before: 'Arc-en-',
      letter: 'c',
      after: 'iel',
    });
  });

  it('refuses a missing letter or badly placed brackets', () => {
    expect(splitAnswer('Azote', 'N')).toBeNull();
    expect(splitAnswer('Arc-en-[i]ciel', 'C')).toBeNull();
    expect(splitAnswer('[ab]c', 'A')).toBeNull();
    expect(splitAnswer('[a]b[c]', 'A')).toBeNull();
    expect(splitAnswer('Arc]', 'A')).toBeNull();
  });
});
