import { createElement } from '../shared/dom';

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

/** A word input: no spell check or autocorrect, capitals, as on a crossword. */
export function wordInput(
  value: string,
  maxLength: number,
  placeholder: string,
  onInput: (value: string) => void,
): HTMLInputElement {
  const input = textInput(value, placeholder, maxLength, onInput);
  input.classList.add('word-input');
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('autocorrect', 'off');
  return input;
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

/** Letters of a word as tiles: known letters shown, blanks for the others. */
export function patternTiles(pattern: readonly string[]): HTMLElement {
  return createElement(
    'div',
    { className: 'pattern' },
    pattern.map((letter) =>
      createElement('span', { className: letter === '' ? 'tile' : 'tile known', text: letter }),
    ),
  );
}

/** "P _ _ N", for a button label. */
export function patternText(pattern: readonly string[]): string {
  return pattern.map((letter) => (letter === '' ? '_' : letter)).join(' ');
}
