import { describe, expect, it } from 'vitest';
import { FINAL_WORD_COUNT, ROUND_WORD_COUNTS } from '../game/config';
import { CONTENT } from './content';
import { validateFinalGrid, validateGrid, validateGridSet, validateQuestions } from './validate';

const GRIDS_PER_ROUND = 15;
const FINAL_GRIDS = 20;

describe('round grids', () => {
  it.each([1, 2])('has enough valid grids for round %i', (round) => {
    const grids = CONTENT.roundGrids[round - 1] ?? [];
    const wordCount = ROUND_WORD_COUNTS[round - 1] ?? 0;
    expect(grids.length).toBeGreaterThanOrEqual(GRIDS_PER_ROUND);
    expect(grids.flatMap((grid) => validateGrid(grid, wordCount))).toEqual([]);
  });
});

describe('final grids', () => {
  it('has enough valid grids, each with a theme', () => {
    expect(CONTENT.finalGrids.length).toBeGreaterThanOrEqual(FINAL_GRIDS);
    expect(CONTENT.finalGrids.flatMap((grid) => validateFinalGrid(grid, FINAL_WORD_COUNT))).toEqual(
      [],
    );
  });
});

describe('all grids', () => {
  it('never use a word twice, so that no word comes back in a game', () => {
    const grids = [...CONTENT.roundGrids.flat(), ...CONTENT.finalGrids];
    expect(validateGridSet(grids)).toEqual([]);
  });
});

describe('question bank', () => {
  it('is valid', () => {
    expect(validateQuestions(CONTENT.questions)).toEqual([]);
  });
});
