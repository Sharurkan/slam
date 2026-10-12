import { createElement } from '../shared/dom';
import { normalizeWord } from '../shared/text';
import { blankCount, fillPattern } from './controls';

export function button(
  text: string,
  className: string,
  enabled: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const element = createElement('button', { className, text });
  element.type = 'button';
  element.disabled = !enabled;
  element.addEventListener('click', onClick);
  return element;
}

export function textInput(
  value: string,
  placeholder: string,
  maxLength: number,
  onInput: (value: string) => void,
): HTMLInputElement {
  const input = createElement('input', { className: 'text-input' });
  input.maxLength = maxLength;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.addEventListener('input', () => {
    onInput(input.value);
  });
  return input;
}

/** An invisible input over the tiles: no spell check or autocorrect, capitals. */
function hiddenWordInput(
  value: string,
  maxLength: number,
  onInput: (value: string) => void,
): HTMLInputElement {
  const input = textInput(value, '', maxLength, onInput);
  input.className = 'word-input';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('autocorrect', 'off');
  // The caret is invisible: keep it at the end so that letters always fill the next blank.
  const caretToEnd = (): void => {
    input.setSelectionRange(input.value.length, input.value.length);
  };
  input.addEventListener('click', caretToEnd);
  input.addEventListener('focus', caretToEnd);
  return input;
}

function tileClass(known: boolean, isNext: boolean): string {
  if (known) return 'tile known';
  return isNext ? 'tile next' : 'tile';
}

/**
 * The word as crossword tiles. Known letters stay; the player types only the missing ones,
 * which fill the blanks in order. `onInput` gets the typed letters only.
 */
export function wordTiles(
  pattern: readonly string[],
  value: string,
  onInput: (typed: string) => void,
): HTMLElement {
  const blanks = blankCount(pattern);
  const tiles = pattern.map(() => createElement('span'));
  const paint = (typed: string): void => {
    const filled = fillPattern(pattern, typed);
    const next = filled.findIndex((letter) => letter === '');
    tiles.forEach((tile, index) => {
      const letter = filled[index] ?? '';
      tile.className = tileClass(pattern[index] !== '', index === next);
      tile.textContent = letter;
    });
  };
  const input = hiddenWordInput(value, blanks, (raw) => {
    const typed = normalizeWord(raw).slice(0, blanks);
    if (input.value !== typed) input.value = typed;
    paint(typed);
    onInput(typed);
  });
  paint(value);
  return createElement('label', { className: 'word-tiles' }, [
    createElement('div', { className: 'pattern' }, tiles),
    input,
  ]);
}

export function screen(children: HTMLElement[]): HTMLElement {
  return createElement('div', { className: 'screen' }, children);
}

export function headline(text: string, className = 'headline'): HTMLElement {
  return createElement('p', { className, text });
}

export function note(text: string, className = 'note'): HTMLElement {
  return createElement('p', { className, text });
}

/** "P _ _ N", for a button label. */
export function patternText(pattern: readonly string[]): string {
  return pattern.map((letter) => (letter === '' ? '_' : letter)).join(' ');
}
