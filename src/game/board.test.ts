import { describe, expect, it } from 'vitest';
import {
  findWord,
  incompleteWords,
  isBoardComplete,
  newBoard,
  playableWords,
  remainingPoints,
  revealLetters,
  revealWord,
  usableLetters,
} from './board';
import type { GridWord } from './grid';
import { ANIMALS } from './test-fixtures';

function word(number: number): GridWord {
  const found = findWord(newBoard(ANIMALS), number);
  if (found === undefined) throw new Error(`No word ${String(number)}`);
  return found;
}

const CHAT = word(1);
const CHIEN = word(2);
const TOUR = word(3);

describe('revealLetters', () => {
  it('shows every cell holding the letter, in all words', () => {
    const { board, completed } = revealLetters(newBoard(ANIMALS), ['H']);
    expect(board.revealed).toEqual(['0,1', '1,0']);
    expect(completed).toEqual([]);
  });

  it('reports the words a reveal completes', () => {
    expect(revealLetters(newBoard(ANIMALS), Array.from('CHAT')).completed).toEqual([CHAT]);
  });

  it('makes a tried word playable again when one of its cells appears', () => {
    const board = { ...newBoard(ANIMALS), tried: [2, 3] };
    expect(revealLetters(board, ['N']).board.tried).toEqual([3]);
  });
});

describe('revealWord', () => {
  it('completes the word', () => {
    expect(revealWord(newBoard(ANIMALS), CHAT).completed).toEqual([CHAT]);
  });

  it('also completes a crossing word it fills', () => {
    const almost = revealLetters(newBoard(ANIMALS), Array.from('HIEN')).board;
    expect(revealWord(almost, CHAT).completed).toEqual([CHAT, CHIEN]);
  });
});

describe('usableLetters', () => {
  it('lists the hidden letters, without the lost ones', () => {
    const board = { ...revealWord(newBoard(ANIMALS), CHAT).board, lost: ['O'] };
    expect(usableLetters(board)).toEqual(['E', 'H', 'I', 'N', 'R', 'U']);
  });
});

describe('playableWords', () => {
  it('keeps the open words holding the letter, not tried', () => {
    const board = { ...newBoard(ANIMALS), tried: [1] };
    expect(playableWords(board, 'T')).toEqual([TOUR]);
    // TOUR shows the T of CHAT: CHAT may be tried again.
    expect(playableWords(revealWord(board, TOUR).board, 'T')).toEqual([CHAT]);
  });
});

describe('remainingPoints', () => {
  it('adds the letters of every open word', () => {
    const board = newBoard(ANIMALS);
    expect(remainingPoints(board)).toBe(4 + 5 + 4);
    expect(remainingPoints(revealWord(board, CHIEN).board)).toBe(4 + 4);
  });

  it('is 0 once the grid is complete', () => {
    const board = revealLetters(newBoard(ANIMALS), Array.from('CHATIENOUR')).board;
    expect(isBoardComplete(board)).toBe(true);
    expect(incompleteWords(board)).toEqual([]);
    expect(remainingPoints(board)).toBe(0);
  });
});
