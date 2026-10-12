import { createElement } from '../shared/dom';
import type { Display, Pick, ScoreRow } from './game-display';
import { createGridView } from './grid-view';
import { TV_TEXTS } from './texts';

/** The final timer turns red and ticks for the last seconds. */
export const TIMER_WARNING_SECONDS = 10;
/** How long the SLAM effect stays on screen. */
const SLAM_EFFECT_MS = 2500;

export interface GameScreen {
  element: HTMLElement;
  /** fresh: grid cells shown by the last action, animated one by one. */
  render(display: Display, fresh?: readonly string[]): void;
  showBanner(text: string): void;
  showSlam(): void;
}

function scoreRow(row: ScoreRow): HTMLElement {
  const classes = ['score-row'];
  if (row.active) classes.push('active');
  if (row.faded) classes.push('faded');
  return createElement('li', { className: classes.join(' ') }, [
    ...(row.rank === ''
      ? []
      : [createElement('span', { className: 'score-rank', text: row.rank })]),
    createElement('span', { className: 'score-name', text: row.name }),
    createElement('span', { className: 'score-points', text: row.score }),
    ...(row.note === ''
      ? []
      : [createElement('span', { className: 'score-note', text: row.note })]),
  ]);
}

function pickTile(pick: Pick): HTMLElement {
  const classes = ['pick'];
  if (pick.picked) classes.push('picked');
  if (pick.letter !== '') classes.push('open');
  return createElement('div', {
    className: classes.join(' '),
    text: pick.letter === '' ? pick.label : pick.letter,
  });
}

export function createGameScreen(): GameScreen {
  const grid = createGridView();
  const title = createElement('div', { className: 'game-title' });
  const heading = createElement('div', { className: 'card-heading' });
  const text = createElement('div', { className: 'card-text' });
  const timer = createElement('div', { className: 'timer' });
  const picks = createElement('div', { className: 'picks' });
  const lostLetters = createElement('span', { className: 'lost-letters' });
  const lost = createElement('div', { className: 'lost' }, [
    createElement('span', { className: 'lost-label', text: TV_TEXTS.lost }),
    lostLetters,
  ]);
  const scores = createElement('ul', { className: 'scores' });
  const banner = createElement('div', { className: 'banner' });
  const slam = createElement('div', { className: 'slam-effect', text: TV_TEXTS.slamBanner });
  const board = createElement('div', { className: 'game-board' }, [grid.element]);
  const element = createElement('section', { className: 'game' }, [
    title,
    board,
    createElement('aside', { className: 'game-side' }, [
      createElement('div', { className: 'card' }, [heading, text]),
      timer,
      picks,
      lost,
      scores,
    ]),
    banner,
    slam,
  ]);
  slam.hidden = true;
  let slamTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    element,
    render: (display, fresh = []) => {
      title.textContent = display.title;
      element.classList.toggle('no-board', display.board === null);
      if (display.board !== null) grid.render(display.board, display.layout, fresh);
      heading.textContent = display.heading;
      text.textContent = display.text;
      timer.hidden = display.timer === null;
      timer.textContent = display.timer === null ? '' : TV_TEXTS.seconds(display.timer);
      timer.classList.toggle(
        'warning',
        display.timer !== null && display.timer <= TIMER_WARNING_SECONDS,
      );
      picks.hidden = display.picks.length === 0;
      picks.replaceChildren(...display.picks.map(pickTile));
      lost.hidden = display.lost.length === 0;
      lostLetters.textContent = display.lost.join(' ');
      scores.replaceChildren(...display.scores.map(scoreRow));
    },
    showBanner: (message) => {
      banner.textContent = message;
    },
    showSlam: () => {
      clearTimeout(slamTimer);
      slam.hidden = false;
      slamTimer = setTimeout(() => {
        slam.hidden = true;
      }, SLAM_EFFECT_MS);
    },
  };
}
