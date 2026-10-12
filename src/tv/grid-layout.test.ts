import { describe, expect, it } from 'vitest';
import { newBoard, revealLetters } from '../game/board';
import { ANIMALS } from '../game/test-fixtures';
import { layoutCells, newlyRevealed } from './grid-layout';

const hidden = { active: null, showAll: false };

describe('layoutCells', () => {
  it('lists each letter cell once, with the numbers of the words starting there', () => {
    const cells = layoutCells(newBoard(ANIMALS), hidden);
    expect(cells).toHaveLength(11);
    expect(cells[0]).toMatchObject({ key: '0,0', numbers: [1, 2], letter: '' });
    expect(cells.find((cell) => cell.key === '0,3')?.numbers).toEqual([3]);
  });

  it('only shows the revealed letters during the game', () => {
    const board = revealLetters(newBoard(ANIMALS), ['T']).board;
    const letters = layoutCells(board, hidden).filter((cell) => cell.letter !== '');
    expect(letters).toEqual([expect.objectContaining({ key: '0,3', letter: 'T' })]);
  });

  it('marks found, tried and active words', () => {
    const board = { ...revealLetters(newBoard(ANIMALS), Array.from('CHAT')).board, tried: [3] };
    const cells = layoutCells(board, { active: 2, showAll: false });
    const at = (key: string) => cells.find((cell) => cell.key === key);
    expect(at('0,1')).toMatchObject({ found: true, tried: false, active: false });
    expect(at('0,3')).toMatchObject({ found: true, tried: false });
    expect(at('1,3')).toMatchObject({ found: false, tried: true });
    expect(at('2,0')).toMatchObject({ active: true });
  });

  it('shows every letter at the end, the corrected ones apart', () => {
    const board = revealLetters(newBoard(ANIMALS), ['T']).board;
    const cells = layoutCells(board, { active: null, showAll: true });
    expect(cells.every((cell) => cell.letter !== '')).toBe(true);
    expect(cells.find((cell) => cell.key === '0,3')?.corrected).toBe(false);
    expect(cells.find((cell) => cell.key === '0,0')?.corrected).toBe(true);
  });
});

describe('newlyRevealed', () => {
  it('keeps the cells shown by the last action', () => {
    expect(newlyRevealed(['0,0'], ['0,0', '0,1', '0,2'])).toEqual(['0,1', '0,2']);
  });
});
