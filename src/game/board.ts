import { POINTS_PER_LETTER } from './config';
import { cellKey, wordCells, type Grid, type GridWord } from './grid';

/** A grid being played: which cells are shown, which words were tried, which letters were lost. */
export interface Board<G extends Grid = Grid> {
  grid: G;
  /** Cell keys ("row,col") whose letter is shown. */
  revealed: string[];
  /** Words proposed wrong: not playable until another of their letters is revealed. */
  tried: number[];
  /** Letters nobody found: never asked again in this grid. */
  lost: string[];
}

export function newBoard<G extends Grid>(grid: G): Board<G> {
  return { grid, revealed: [], tried: [], lost: [] };
}

export function findWord(board: Board, number: number): GridWord | undefined {
  return board.grid.words.find((word) => word.number === number);
}

export function isWordComplete(board: Board, word: GridWord): boolean {
  return wordCells(word).every((cell) => board.revealed.includes(cellKey(cell)));
}

export function incompleteWords(board: Board): GridWord[] {
  return board.grid.words.filter((word) => !isWordComplete(board, word));
}

export function isBoardComplete(board: Board): boolean {
  return incompleteWords(board).length === 0;
}

export function wordPoints(word: GridWord): number {
  return word.answer.length * POINTS_PER_LETTER;
}

/** Points of every word not found yet: what a SLAM is worth. */
export function remainingPoints(board: Board): number {
  return incompleteWords(board).reduce((total, word) => total + wordPoints(word), 0);
}

/** Letters still hidden somewhere in the grid and not lost: the ones a question may ask. */
export function usableLetters(board: Board): string[] {
  const letters = new Set<string>();
  for (const word of board.grid.words) {
    wordCells(word).forEach((cell, index) => {
      if (!board.revealed.includes(cellKey(cell))) letters.add(word.answer.charAt(index));
    });
  }
  return [...letters].filter((letter) => !board.lost.includes(letter)).sort();
}

export interface Reveal<G extends Grid> {
  board: Board<G>;
  /** Words completed by this reveal, in number order. */
  completed: GridWord[];
}

/** Shows cells. A tried word becomes playable again when one of its cells appears. */
function revealCells<G extends Grid>(board: Board<G>, keys: readonly string[]): Reveal<G> {
  const fresh = keys.filter(
    (key, index) => !board.revealed.includes(key) && keys.indexOf(key) === index,
  );
  const next = { ...board, revealed: [...board.revealed, ...fresh] };
  const touched = (word: GridWord): boolean =>
    wordCells(word).some((cell) => fresh.includes(cellKey(cell)));
  next.tried = board.tried.filter((number) => {
    const word = findWord(board, number);
    return word !== undefined && !touched(word);
  });
  const completed = board.grid.words.filter(
    (word) => !isWordComplete(board, word) && isWordComplete(next, word),
  );
  return { board: next, completed };
}

/** Shows every cell holding one of the letters. */
export function revealLetters<G extends Grid>(
  board: Board<G>,
  letters: readonly string[],
): Reveal<G> {
  const keys = board.grid.words.flatMap((word) =>
    wordCells(word)
      .filter((_, index) => letters.includes(word.answer.charAt(index)))
      .map(cellKey),
  );
  return revealCells(board, keys);
}

export function revealWord<G extends Grid>(board: Board<G>, word: GridWord): Reveal<G> {
  return revealCells(board, wordCells(word).map(cellKey));
}

/** Words the player may pick after finding a letter: they hold it and are still open. */
export function playableWords(board: Board, letter: string): GridWord[] {
  return incompleteWords(board).filter(
    (word) => word.answer.includes(letter) && !board.tried.includes(word.number),
  );
}
