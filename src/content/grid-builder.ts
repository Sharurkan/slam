/**
 * Builds crossword grids offline (scripts/generate-grids.ts), never during a game.
 * Relative imports keep their .ts extension: Node loads this file directly.
 */
import {
  cellKey,
  compareWordStarts,
  wordCells,
  type Cell,
  type Direction,
  type Grid,
  type GridWord,
} from '../game/grid.ts';

export interface WordEntry {
  answer: string;
  clue: string;
}

export interface BuildOptions {
  wordCount: number;
  maxWidth: number;
  maxHeight: number;
  /** Returns a number in [0, 1), like Math.random: a seeded one gives the same grids each time. */
  random: () => number;
  /** Fresh starts tried; the best grid found wins. */
  attempts: number;
}

interface Placed extends WordEntry {
  row: number;
  col: number;
  direction: Direction;
}

interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

interface Board {
  placed: Placed[];
  cells: Map<string, { letter: string; directions: Direction[] }>;
  bounds: Bounds;
}

interface Move {
  placed: Placed;
  crossings: number;
  score: number;
}

/** Each crossing is worth more than any growth of the grid area. */
const CROSSING_WEIGHT = 1000;

const OTHER: Record<Direction, Direction> = { across: 'down', down: 'across' };

function emptyBoard(): Board {
  const bounds = { minRow: 0, maxRow: -1, minCol: 0, maxCol: -1 };
  return { placed: [], cells: new Map(), bounds };
}

function isEmpty(board: Board, cell: Cell): boolean {
  return !board.cells.has(cellKey(cell));
}

function boundsWith(bounds: Bounds, cells: Cell[], first: boolean): Bounds {
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);
  return first
    ? {
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
        minCol: Math.min(...cols),
        maxCol: Math.max(...cols),
      }
    : {
        minRow: Math.min(bounds.minRow, ...rows),
        maxRow: Math.max(bounds.maxRow, ...rows),
        minCol: Math.min(bounds.minCol, ...cols),
        maxCol: Math.max(bounds.maxCol, ...cols),
      };
}

function area(bounds: Bounds): number {
  return (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1);
}

/** The cells just before and after a word must stay empty. */
function endsAreFree(board: Board, word: Placed): boolean {
  const step = word.direction === 'across' ? { row: 0, col: 1 } : { row: 1, col: 0 };
  const length = word.answer.length;
  return (
    isEmpty(board, { row: word.row - step.row, col: word.col - step.col }) &&
    isEmpty(board, { row: word.row + step.row * length, col: word.col + step.col * length })
  );
}

/** Number of crossings, or null when the word cannot go there. */
function countCrossings(board: Board, word: Placed): number | null {
  if (!endsAreFree(board, word)) return null;
  let crossings = 0;
  for (const [index, cell] of wordCells(word).entries()) {
    const existing = board.cells.get(cellKey(cell));
    if (existing !== undefined) {
      if (existing.letter !== word.answer.charAt(index)) return null;
      if (existing.directions.includes(word.direction)) return null;
      crossings += 1;
      continue;
    }
    // A new letter next to another word would glue them into a run that is not a word.
    const side = word.direction === 'across' ? { row: 1, col: 0 } : { row: 0, col: 1 };
    const before = { row: cell.row - side.row, col: cell.col - side.col };
    const after = { row: cell.row + side.row, col: cell.col + side.col };
    if (!isEmpty(board, before) || !isEmpty(board, after)) return null;
  }
  return crossings;
}

function evaluate(board: Board, word: Placed, options: BuildOptions): Move | null {
  const crossings = countCrossings(board, word);
  if (crossings === null || crossings === 0) return null;
  const bounds = boundsWith(board.bounds, wordCells(word), false);
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  if (width > options.maxWidth || height > options.maxHeight) return null;
  // A little randomness breaks ties, so that each attempt explores another grid.
  const score =
    crossings * CROSSING_WEIGHT - (area(bounds) - area(board.bounds)) + options.random();
  return { placed: word, crossings, score };
}

/** Every way to cross the word with a letter already on the board. */
function movesFor(board: Board, entry: WordEntry, options: BuildOptions): Move[] {
  const moves: Move[] = [];
  for (const [key, cell] of board.cells) {
    if (cell.directions.length > 1) continue;
    const [row = 0, col = 0] = key.split(',').map(Number);
    const direction = OTHER[cell.directions[0] ?? 'down'];
    for (let index = 0; index < entry.answer.length; index += 1) {
      if (entry.answer.charAt(index) !== cell.letter) continue;
      const start = direction === 'across' ? { row, col: col - index } : { row: row - index, col };
      const move = evaluate(board, { ...entry, ...start, direction }, options);
      if (move !== null) moves.push(move);
    }
  }
  return moves;
}

function place(board: Board, word: Placed): void {
  const cells = wordCells(word);
  cells.forEach((cell, index) => {
    const key = cellKey(cell);
    const existing = board.cells.get(key);
    if (existing === undefined) {
      board.cells.set(key, { letter: word.answer.charAt(index), directions: [word.direction] });
    } else {
      existing.directions.push(word.direction);
    }
  });
  board.bounds = boundsWith(board.bounds, cells, board.placed.length === 0);
  board.placed.push(word);
}

function bestMove(board: Board, entries: readonly WordEntry[], options: BuildOptions): Move | null {
  let best: Move | null = null;
  for (const entry of entries) {
    for (const move of movesFor(board, entry, options)) {
      if (best === null || move.score > best.score) best = move;
    }
  }
  return best;
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(Math.floor(random() * (i + 1)), i);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

function attempt(entries: readonly WordEntry[], options: BuildOptions): Board | null {
  const [first, ...rest] = shuffle(entries, options.random);
  if (first === undefined || first.answer.length > options.maxWidth) return null;
  const board = emptyBoard();
  place(board, { ...first, row: 0, col: 0, direction: 'across' });
  let remaining = rest;
  while (board.placed.length < options.wordCount) {
    const move = bestMove(board, remaining, options);
    if (move === null) return null;
    place(board, move.placed);
    remaining = remaining.filter((entry) => entry.answer !== move.placed.answer);
  }
  return board;
}

/** More crossings first, then the smallest grid. */
function boardScore(board: Board): number {
  const crossings = [...board.cells.values()].filter((cell) => cell.directions.length > 1).length;
  return crossings * CROSSING_WEIGHT - area(board.bounds);
}

/** Moves the grid to row 0, column 0 and numbers the words in reading order. */
function toGridWords(board: Board): GridWord[] {
  const { minRow, minCol } = board.bounds;
  return board.placed
    .map((word) => ({ ...word, row: word.row - minRow, col: word.col - minCol }))
    .sort(compareWordStarts)
    .map((word, index) => ({
      number: index + 1,
      row: word.row,
      col: word.col,
      direction: word.direction,
      answer: word.answer,
      clue: word.clue,
    }));
}

/** The best grid of wordCount words taken from the entries, or null if none fits. */
export function buildGrid(
  id: string,
  entries: readonly WordEntry[],
  options: BuildOptions,
): Grid | null {
  let best: Board | null = null;
  for (let i = 0; i < options.attempts; i += 1) {
    const board = attempt(entries, options);
    if (board !== null && (best === null || boardScore(board) > boardScore(best))) best = board;
  }
  if (best === null) return null;
  const { minRow, maxRow, minCol, maxCol } = best.bounds;
  return { id, width: maxCol - minCol + 1, height: maxRow - minRow + 1, words: toGridWords(best) };
}

/** The grid drawn in text, for a quick look while proofreading: "." for an empty cell. */
export function drawGrid(grid: Grid): string[] {
  const rows = Array.from({ length: grid.height }, () => Array<string>(grid.width).fill('.'));
  for (const word of grid.words) {
    wordCells(word).forEach((cell, index) => {
      const row = rows[cell.row];
      if (row !== undefined) row[cell.col] = word.answer.charAt(index);
    });
  }
  return rows.map((row) => row.join(' '));
}
