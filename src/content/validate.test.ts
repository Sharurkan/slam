import { describe, expect, it } from 'vitest';
import type { Grid, GridWord } from '../game/grid';
import {
  ALPHABET,
  validateFinalGrid,
  validateGrid,
  validateGridSet,
  validateQuestions,
  type QuestionBank,
} from './validate';

/**
 * CHAT
 * H..O
 * I..U
 * E..R
 * N...
 */
const WORDS: GridWord[] = [
  { number: 1, row: 0, col: 0, direction: 'across', answer: 'CHAT', clue: 'Il miaule' },
  { number: 2, row: 0, col: 0, direction: 'down', answer: 'CHIEN', clue: 'Il aboie' },
  { number: 3, row: 0, col: 3, direction: 'down', answer: 'TOUR', clue: 'Celle de Pise penche' },
];
const GRID: Grid = { id: 'test', width: 4, height: 5, words: WORDS };

function withWords(words: GridWord[], size: Partial<Grid> = {}): Grid {
  return { ...GRID, ...size, words };
}

describe('validateGrid', () => {
  it('accepts a valid grid', () => {
    expect(validateGrid(GRID, 3)).toEqual([]);
  });

  it('reports a wrong number of words', () => {
    expect(validateGrid(GRID, 4)).toContain('test: 3 words instead of 4');
  });

  it('reports letters that disagree where words cross', () => {
    const words = [WORDS[0], WORDS[1], { ...WORDS[2], answer: 'SOUR' }] as GridWord[];
    expect(validateGrid(withWords(words), 3)).toContain('test: cell 0,3: T and S cross');
  });

  it('reports words that touch side by side', () => {
    const rue: GridWord = {
      number: 4,
      row: 4,
      col: 1,
      direction: 'across',
      answer: 'RUE',
      clue: 'Voie',
    };
    const errors = validateGrid(withWords([...WORDS, rue]), 4);
    expect(errors).toContain('test: letters at 4,0,across,4 do not form a word of the grid');
    expect(errors).toContain('test: word RUE touches another word');
  });

  it('reports words that are not connected', () => {
    const words: GridWord[] = [
      { number: 1, row: 0, col: 0, direction: 'across', answer: 'CHAT', clue: 'Il miaule' },
      { number: 2, row: 2, col: 0, direction: 'across', answer: 'LOUP', clue: 'Il hurle' },
    ];
    expect(validateGrid(withWords(words, { height: 3 }), 2)).toContain(
      'test: words are not all connected',
    );
  });

  it('reports a clue that gives the answer', () => {
    const words = [{ ...WORDS[0], clue: "Le chat de l'oncle" }, WORDS[1], WORDS[2]] as GridWord[];
    expect(validateGrid(withWords(words), 3)).toContain(
      'test: word 1 (CHAT): the clue gives the answer',
    );
  });

  it('reports a clue that names another word of the grid, even in the plural', () => {
    const words = [WORDS[0], { ...WORDS[1], clue: 'Il court après les chats' }, WORDS[2]];
    expect(validateGrid(withWords(words as GridWord[]), 3)).toContain(
      'test: word 2 (CHIEN): the clue gives away CHAT',
    );
  });

  it('reports lowercase, accents and short words', () => {
    const words = [WORDS[0], WORDS[1], { ...WORDS[2], answer: 'Tô' }] as GridWord[];
    const errors = validateGrid(withWords(words), 3);
    expect(errors).toContain('test: word 3 (Tô): letters A to Z only');
    expect(errors).toContain('test: word 3 (Tô): too short');
  });

  it('reports numbers out of reading order', () => {
    const words = [WORDS[1], WORDS[0], WORDS[2]].map((word, index) => ({
      ...word,
      number: index + 1,
    })) as GridWord[];
    expect(validateGrid(withWords(words), 3)).toContain(
      'test: words are not numbered in reading order',
    );
  });

  it('reports words outside the grid and empty edges', () => {
    expect(validateGrid(withWords(WORDS, { height: 4 }), 3)).toContain(
      'test: word 2 (CHIEN): outside the grid',
    );
    expect(validateGrid(withWords(WORDS, { width: 6 }), 3)).toContain(
      'test: empty rows or columns on an edge',
    );
  });

  it('reports a grid too large for the TV', () => {
    expect(validateGrid(withWords(WORDS, { width: 16 }), 3)).toContain(
      'test: width 16 out of range',
    );
  });
});

describe('validateFinalGrid', () => {
  it('needs a theme and enough different letters', () => {
    expect(validateFinalGrid({ ...GRID, theme: 'Animaux' }, 3)).toEqual([]);
    const words: GridWord[] = [
      { number: 1, row: 0, col: 0, direction: 'across', answer: 'ANANAS', clue: 'Fruit' },
      { number: 2, row: 0, col: 1, direction: 'down', answer: 'NAN', clue: 'Pain indien' },
    ];
    const errors = validateFinalGrid(
      { ...withWords(words, { width: 6, height: 3 }), theme: ' ' },
      2,
    );
    expect(errors).toEqual(['test: empty theme', 'test: fewer than 8 different letters']);
  });
});

describe('validateGridSet', () => {
  it('reports ids and words used twice', () => {
    const other: Grid = { ...GRID, id: 'other' };
    expect(validateGridSet([GRID, other, GRID])).toEqual([
      'other: word CHAT already in test',
      'other: word CHIEN already in test',
      'other: word TOUR already in test',
      'test: id used twice',
      'test: word CHAT already in other',
      'test: word CHIEN already in other',
      'test: word TOUR already in other',
    ]);
  });
});

function bank(perLetter: number): Record<string, string[]> {
  return Object.fromEntries(
    Array.from(ALPHABET, (letter) => [
      letter,
      Array.from({ length: perLetter }, (_, i) => `Question ${String(i)} pour ${letter} ?`),
    ]),
  );
}

describe('validateQuestions', () => {
  it('accepts a full bank', () => {
    expect(validateQuestions(bank(12))).toEqual([]);
  });

  it('needs enough questions per letter and in total', () => {
    const small: QuestionBank = { ...bank(12), Z: ['Dernière lettre ?'] };
    expect(validateQuestions(small)).toContain('Z: 1 questions, 6 needed');
    expect(validateQuestions(bank(6))).toContain('156 questions, 300 needed');
  });

  it('reports duplicates, missing question marks and unknown letters', () => {
    const errors = validateQuestions({
      ...bank(12),
      A: [...(bank(12).A ?? []), 'Question 0 pour A ?', 'Sans point'],
      '1': ['Chiffre ?'],
    });
    expect(errors).toContain('A: "Question 0 pour A ?" appears twice');
    expect(errors).toContain('A: "Sans point" must be trimmed and end with " ?"');
    expect(errors).toContain('unknown letter 1');
  });
});
