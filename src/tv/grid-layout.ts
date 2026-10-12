import { isWordComplete, type Board } from '../game/board';
import { cellKey, wordCells, type GridWord } from '../game/grid';

/** How one cell of the TV grid looks. */
export interface CellLook {
  key: string;
  row: number;
  col: number;
  /** The letter to show, or '' while it is hidden. */
  letter: string;
  /** Word numbers starting in this cell. */
  numbers: number[];
  /** Belongs to a found word. */
  found: boolean;
  /** Belongs to a word tried wrong, not found. */
  tried: boolean;
  /** Belongs to the word being answered. */
  active: boolean;
  /** Hidden during the game, shown by the correction at the end. */
  corrected: boolean;
}

export interface LayoutOptions {
  /** Word being answered or played, highlighted. */
  active: number | null;
  /** End of the round or of the game: every letter is shown. */
  showAll: boolean;
}

function cellOf(looks: Map<string, CellLook>, word: GridWord, index: number): CellLook {
  const cell = wordCells(word)[index] ?? { row: 0, col: 0 };
  const key = cellKey(cell);
  const existing = looks.get(key);
  if (existing !== undefined) return existing;
  const look: CellLook = {
    key,
    ...cell,
    letter: '',
    numbers: [],
    found: false,
    tried: false,
    active: false,
    corrected: false,
  };
  looks.set(key, look);
  return look;
}

/** Every letter cell of the grid with its look, in reading order. */
export function layoutCells(board: Board, options: LayoutOptions): CellLook[] {
  const looks = new Map<string, CellLook>();
  for (const word of board.grid.words) {
    const found = isWordComplete(board, word);
    const tried = board.tried.includes(word.number);
    for (let index = 0; index < word.answer.length; index += 1) {
      const look = cellOf(looks, word, index);
      const revealed = board.revealed.includes(look.key);
      if (revealed || options.showAll) look.letter = word.answer.charAt(index);
      look.corrected = options.showAll && !revealed;
      look.found ||= found;
      look.tried ||= tried;
      look.active ||= word.number === options.active;
      if (index === 0) look.numbers.push(word.number);
    }
  }
  // A cell shared with a found word shows as found, even if the other word was tried.
  return [...looks.values()]
    .map((look) => ({ ...look, tried: look.tried && !look.found }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Cells shown by the last action, in reading order: they appear one by one. */
export function newlyRevealed(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((key) => !before.includes(key));
}
