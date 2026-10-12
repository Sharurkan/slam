import type { Board } from '../game/board';
import { createElement } from '../shared/dom';
import { layoutCells, type LayoutOptions } from './grid-layout';

/** Delay between two letters appearing, so that a reveal reads one letter at a time. */
const LETTER_STAGGER_MS = 120;

export interface GridView {
  element: HTMLElement;
  /** fresh: cells shown by the last action, animated one by one. */
  render(board: Board, options: LayoutOptions, fresh?: readonly string[]): void;
}

interface CellElements {
  root: HTMLElement;
  letter: HTMLElement;
  numbers: HTMLElement;
}

function createCell(row: number, col: number): CellElements {
  const letter = createElement('span', { className: 'cell-letter' });
  const numbers = createElement('span', { className: 'cell-numbers' });
  const root = createElement('div', { className: 'cell' }, [numbers, letter]);
  root.style.gridRow = String(row + 1);
  root.style.gridColumn = String(col + 1);
  return { root, letter, numbers };
}

/** Built once per grid; later renders only change texts and classes, cheap on the Fire Stick. */
export function createGridView(): GridView {
  const element = createElement('div', { className: 'grid' });
  let gridId = '';
  let cells = new Map<string, CellElements>();

  function build(board: Board): void {
    gridId = board.grid.id;
    element.style.setProperty('--cols', String(board.grid.width));
    element.style.setProperty('--rows', String(board.grid.height));
    cells = new Map();
    for (const look of layoutCells(board, { active: null, showAll: false })) {
      cells.set(look.key, createCell(look.row, look.col));
    }
    element.replaceChildren(...[...cells.values()].map((cell) => cell.root));
  }

  return {
    element,
    render: (board, options, fresh = []) => {
      if (board.grid.id !== gridId) build(board);
      for (const look of layoutCells(board, options)) {
        const cell = cells.get(look.key);
        if (cell === undefined) continue;
        cell.letter.textContent = look.letter;
        cell.numbers.textContent = look.numbers.join('·');
        cell.root.classList.toggle('found', look.found);
        cell.root.classList.toggle('tried', look.tried);
        cell.root.classList.toggle('active', look.active);
        cell.root.classList.toggle('corrected', look.corrected);
        const order = fresh.indexOf(look.key);
        cell.root.classList.toggle('fresh', order >= 0);
        cell.letter.style.animationDelay =
          order >= 0 ? `${String(order * LETTER_STAGGER_MS)}ms` : '';
      }
    },
  };
}
