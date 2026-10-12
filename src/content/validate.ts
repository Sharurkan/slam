/**
 * Checks the grids and the question bank. Run by the tests, and by the grid
 * script before it writes anything. Relative imports keep their .ts extension:
 * Node loads this file directly.
 */
import {
  FINAL_LETTER_CHOICES,
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  MIN_QUESTIONS,
  MIN_QUESTIONS_PER_LETTER,
  MIN_WORD_LENGTH,
} from '../game/config.ts';
import {
  cellKey,
  compareWordStarts,
  gridLetters,
  wordCells,
  type Direction,
  type FinalGrid,
  type Grid,
  type GridWord,
} from '../game/grid.ts';
import { normalizeText, normalizeWord } from '../shared/text.ts';
import type { QuestionBank } from '../game/common.ts';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type { QuestionBank } from '../game/common.ts';

function wordErrors(word: GridWord, grid: Grid): string[] {
  const errors: string[] = [];
  const name = `word ${String(word.number)} (${word.answer})`;
  if (!/^[A-Z]+$/.test(word.answer)) errors.push(`${name}: letters A to Z only`);
  if (word.answer.length < MIN_WORD_LENGTH) errors.push(`${name}: too short`);
  if (word.clue.trim() === '' || word.clue !== word.clue.trim()) {
    errors.push(`${name}: empty or untrimmed clue`);
  }
  const clueWords = word.clue.split(/[\s'’-]+/).map(normalizeWord);
  const mentions = (answer: string): boolean =>
    clueWords.some((clueWord) => [answer, `${answer}S`, `${answer}X`].includes(clueWord));
  if (mentions(word.answer)) errors.push(`${name}: the clue gives the answer`);
  for (const other of grid.words) {
    if (other !== word && mentions(other.answer)) {
      errors.push(`${name}: the clue gives away ${other.answer}`);
    }
  }
  const outside = wordCells(word).some(
    (cell) => cell.row < 0 || cell.col < 0 || cell.row >= grid.height || cell.col >= grid.width,
  );
  if (outside) errors.push(`${name}: outside the grid`);
  return errors;
}

/** Letters by cell; reports two words that disagree on a shared cell. */
function fillCells(grid: Grid, errors: string[]): Map<string, string> {
  const cells = new Map<string, string>();
  for (const word of grid.words) {
    wordCells(word).forEach((cell, index) => {
      const letter = word.answer.charAt(index);
      const key = cellKey(cell);
      const existing = cells.get(key);
      if (existing !== undefined && existing !== letter) {
        errors.push(`cell ${key}: ${existing} and ${letter} cross`);
      }
      cells.set(key, letter);
    });
  }
  return cells;
}

/** Every run of 2 or more letters, as "row,col,direction,length". */
function letterRuns(grid: Grid, cells: Map<string, string>): Set<string> {
  const runs = new Set<string>();
  const scan = (direction: Direction, lines: number, length: number): void => {
    for (let line = 0; line < lines; line += 1) {
      let start = -1;
      for (let i = 0; i <= length; i += 1) {
        const cell = direction === 'across' ? { row: line, col: i } : { row: i, col: line };
        const filled = i < length && cells.has(cellKey(cell));
        if (filled && start < 0) start = i;
        if (!filled && start >= 0) {
          if (i - start >= 2) {
            const [row, col] = direction === 'across' ? [line, start] : [start, line];
            runs.add(`${String(row)},${String(col)},${direction},${String(i - start)}`);
          }
          start = -1;
        }
      }
    }
  };
  scan('across', grid.height, grid.width);
  scan('down', grid.width, grid.height);
  return runs;
}

function runKey(word: GridWord): string {
  return `${String(word.row)},${String(word.col)},${word.direction},${String(word.answer.length)}`;
}

/** Words touching side by side would form letter runs that are not words. */
function layoutErrors(grid: Grid, cells: Map<string, string>): string[] {
  const runs = letterRuns(grid, cells);
  const wordRuns = new Set(grid.words.map(runKey));
  const errors = [...runs]
    .filter((run) => !wordRuns.has(run))
    .map((run) => `letters at ${run} do not form a word of the grid`);
  for (const word of grid.words) {
    if (!runs.has(runKey(word))) errors.push(`word ${word.answer} touches another word`);
  }
  return errors;
}

function isConnected(words: readonly GridWord[]): boolean {
  const first = words[0];
  if (first === undefined) return true;
  const reached = new Set<GridWord>([first]);
  const queue = [first];
  for (let word = queue.pop(); word !== undefined; word = queue.pop()) {
    const keys = new Set(wordCells(word).map(cellKey));
    for (const other of words) {
      if (reached.has(other) || !wordCells(other).some((cell) => keys.has(cellKey(cell)))) {
        continue;
      }
      reached.add(other);
      queue.push(other);
    }
  }
  return reached.size === words.length;
}

function hasTightBounds(grid: Grid, cells: Map<string, string>): boolean {
  const filled = [...cells.keys()].map((key) => key.split(',').map(Number));
  const rows = filled.map(([row]) => row ?? -1);
  const cols = filled.map(([, col]) => col ?? -1);
  return (
    Math.min(...rows) === 0 &&
    Math.min(...cols) === 0 &&
    Math.max(...rows) === grid.height - 1 &&
    Math.max(...cols) === grid.width - 1
  );
}

function numberingErrors(grid: Grid): string[] {
  const errors: string[] = [];
  grid.words.forEach((word, index) => {
    if (word.number !== index + 1)
      errors.push(`word ${word.answer}: number should be ${String(index + 1)}`);
  });
  const sorted = [...grid.words].sort(compareWordStarts);
  if (sorted.some((word, index) => word !== grid.words[index])) {
    errors.push('words are not numbered in reading order');
  }
  return errors;
}

function sizeErrors(grid: Grid, wordCount: number): string[] {
  const errors: string[] = [];
  if (grid.id.trim() === '') errors.push('empty id');
  if (!Number.isInteger(grid.width) || grid.width < 1 || grid.width > MAX_GRID_WIDTH) {
    errors.push(`width ${String(grid.width)} out of range`);
  }
  if (!Number.isInteger(grid.height) || grid.height < 1 || grid.height > MAX_GRID_HEIGHT) {
    errors.push(`height ${String(grid.height)} out of range`);
  }
  if (grid.words.length !== wordCount) {
    errors.push(`${String(grid.words.length)} words instead of ${String(wordCount)}`);
  }
  return errors;
}

/** All the problems of one grid, as readable messages (empty when the grid is valid). */
export function validateGrid(grid: Grid, wordCount: number): string[] {
  const errors = [...sizeErrors(grid, wordCount), ...numberingErrors(grid)];
  for (const word of grid.words) errors.push(...wordErrors(word, grid));
  const answers = grid.words.map((word) => word.answer);
  const duplicates = answers.filter((answer, index) => answers.indexOf(answer) !== index);
  for (const answer of new Set(duplicates)) errors.push(`word ${answer} appears twice`);
  const cells = fillCells(grid, errors);
  errors.push(...layoutErrors(grid, cells));
  if (!isConnected(grid.words)) errors.push('words are not all connected');
  if (cells.size > 0 && !hasTightBounds(grid, cells))
    errors.push('empty rows or columns on an edge');
  return errors.map((error) => `${grid.id}: ${error}`);
}

export function validateFinalGrid(grid: FinalGrid, wordCount: number): string[] {
  const errors = validateGrid(grid, wordCount);
  if (grid.theme.trim() === '') errors.push(`${grid.id}: empty theme`);
  if (gridLetters(grid).size < FINAL_LETTER_CHOICES) {
    errors.push(`${grid.id}: fewer than ${String(FINAL_LETTER_CHOICES)} different letters`);
  }
  return errors;
}

/** Ids and words must be unique across all grids, so that no word comes back in a game. */
export function validateGridSet(grids: readonly Grid[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const owners = new Map<string, string>();
  for (const grid of grids) {
    if (ids.has(grid.id)) errors.push(`${grid.id}: id used twice`);
    ids.add(grid.id);
    for (const word of grid.words) {
      const owner = owners.get(word.answer);
      if (owner !== undefined && owner !== grid.id) {
        errors.push(`${grid.id}: word ${word.answer} already in ${owner}`);
      }
      owners.set(word.answer, grid.id);
    }
  }
  return errors;
}

export function validateQuestions(bank: QuestionBank): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const [letter, questions] of Object.entries(bank)) {
    if (!ALPHABET.includes(letter) || letter.length !== 1) errors.push(`unknown letter ${letter}`);
    total += questions.length;
    for (const question of questions) {
      const key = normalizeText(question).replace(/\s+/g, ' ');
      if (seen.has(key)) errors.push(`${letter}: "${question}" appears twice`);
      seen.add(key);
      if (question !== question.trim() || !question.endsWith(' ?')) {
        errors.push(`${letter}: "${question}" must be trimmed and end with " ?"`);
      }
    }
  }
  for (const letter of ALPHABET) {
    const count = bank[letter]?.length ?? 0;
    if (count < MIN_QUESTIONS_PER_LETTER) {
      errors.push(
        `${letter}: ${String(count)} questions, ${String(MIN_QUESTIONS_PER_LETTER)} needed`,
      );
    }
  }
  if (total < MIN_QUESTIONS)
    errors.push(`${String(total)} questions, ${String(MIN_QUESTIONS)} needed`);
  return errors;
}
