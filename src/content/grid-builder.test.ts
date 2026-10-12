import { describe, expect, it } from 'vitest';
import { buildGrid, drawGrid, type BuildOptions, type WordEntry } from './grid-builder';
import { validateGrid } from './validate';

/** Small seeded generator, so that the tests always build the same grids. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const ENTRIES: WordEntry[] = [
  'MAISON',
  'JARDIN',
  'POMME',
  'ORANGE',
  'TABLE',
  'CHAISE',
  'LAMPE',
  'PORTE',
  'FENETRE',
  'SALON',
  'CUISINE',
  'TAPIS',
].map((answer) => ({ answer, clue: `Indice en ${String(answer.length)} lettres` }));

function options(overrides: Partial<BuildOptions> = {}): BuildOptions {
  return {
    wordCount: 7,
    maxWidth: 15,
    maxHeight: 11,
    random: seeded(42),
    attempts: 20,
    ...overrides,
  };
}

describe('buildGrid', () => {
  it('builds a grid the validator accepts', () => {
    const grid = buildGrid('demo', ENTRIES, options());
    expect(grid).not.toBeNull();
    if (grid === null) return;
    expect(validateGrid(grid, 7)).toEqual([]);
    expect(grid.width).toBeLessThanOrEqual(15);
    expect(grid.height).toBeLessThanOrEqual(11);
  });

  it('always builds the same grid with the same seed', () => {
    expect(buildGrid('a', ENTRIES, options())).toEqual(buildGrid('a', ENTRIES, options()));
  });

  it('keeps the clues with their words', () => {
    const grid = buildGrid('demo', ENTRIES, options());
    for (const word of grid?.words ?? []) {
      expect(word.clue).toBe(`Indice en ${String(word.answer.length)} lettres`);
    }
  });

  it('gives up when the words cannot fit', () => {
    expect(buildGrid('tiny', ENTRIES, options({ maxWidth: 4, maxHeight: 4 }))).toBeNull();
    expect(buildGrid('many', ENTRIES, options({ wordCount: 30 }))).toBeNull();
  });
});

describe('drawGrid', () => {
  it('draws letters and empty cells', () => {
    const grid = {
      id: 'g',
      width: 4,
      height: 3,
      words: [
        { number: 1, row: 0, col: 0, direction: 'across', answer: 'CHAT', clue: 'Il miaule' },
        { number: 2, row: 0, col: 3, direction: 'down', answer: 'THE', clue: 'Boisson' },
      ],
    } as const;
    expect(drawGrid(grid)).toEqual(['C H A T', '. . . H', '. . . E']);
  });
});
