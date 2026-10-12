import { describe, expect, it } from 'vitest';
import { normalizeText, normalizeWord } from './text';

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
