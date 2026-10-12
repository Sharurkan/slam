/**
 * Crossword grids, built offline by scripts/generate-grids.ts.
 * No imports: the offline grid script loads this file directly with Node.
 */

export type Direction = 'across' | 'down';

export interface GridWord {
  /** Each word has its own number, 1 to N, in reading order of its first cell. */
  number: number;
  row: number;
  col: number;
  direction: Direction;
  /** Uppercase A to Z only. */
  answer: string;
  clue: string;
}

export interface Grid {
  id: string;
  width: number;
  height: number;
  words: readonly GridWord[];
}

export interface FinalGrid extends Grid {
  theme: string;
}

export interface Cell {
  row: number;
  col: number;
}

type Placement = Pick<GridWord, 'row' | 'col' | 'direction' | 'answer'>;

export function wordCells(word: Placement): Cell[] {
  return Array.from(word.answer, (_, index) => ({
    row: word.row + (word.direction === 'down' ? index : 0),
    col: word.col + (word.direction === 'across' ? index : 0),
  }));
}

export function cellKey(cell: Cell): string {
  return `${String(cell.row)},${String(cell.col)}`;
}

/** Reading order of first cells: top to bottom, left to right, across before down. */
export function compareWordStarts(a: Placement, b: Placement): number {
  if (a.row !== b.row) return a.row - b.row;
  if (a.col !== b.col) return a.col - b.col;
  return a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1;
}

/** Every different letter of the grid. */
export function gridLetters(grid: Grid): Set<string> {
  return new Set(grid.words.flatMap((word) => Array.from(word.answer)));
}
