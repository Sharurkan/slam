import { FINAL_LETTER_PICKS, ROUND_COUNT } from '../game/config';
import type { GridView, PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import {
  activeTeam,
  blankCount,
  fillPattern,
  standInOffer,
  wordPattern,
  type Screen,
} from './controls';
import type { Confirmable, ScreenContext } from './screens';
import { PHONE_TEXTS as texts } from './texts';
import { button, headline, note, patternText, screen, wordTiles } from './widgets';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

type View<P extends PublicView['phase']> = Extract<PublicView, { phase: P }>;

function teamName(view: PublicView, team: number | null): string {
  if (team === null || view.phase === 'setup') return '';
  return view.teams[team]?.name ?? '';
}

function gridOf(view: PublicView): GridView | null {
  return view.phase === 'round' || view.phase === 'final' || view.phase === 'roundOver'
    ? view.grid
    : null;
}

function questionText(view: PublicView): string {
  if (view.phase === 'tiebreak') return view.text;
  if (view.phase === 'round' && view.step.kind === 'question') return view.step.text;
  return '';
}

function card(heading: string, text: string): HTMLElement {
  return createElement('div', { className: 'card' }, [
    ...(heading === '' ? [] : [createElement('div', { className: 'card-heading', text: heading })]),
    createElement('div', { className: 'card-text', text }),
  ]);
}

/** Asks once more before an action that cannot be undone. */
function confirmable(
  ctx: ScreenContext,
  which: Confirmable,
  label: string,
  question: string,
  yes: string,
  className: string,
  run: () => void,
): HTMLElement[] {
  if (ctx.draft.confirming !== which) {
    return [
      button(label, className, ctx.enabled, () => {
        ctx.draft.confirming = which;
        ctx.refresh();
      }),
    ];
  }
  return [
    note(question, 'note warning'),
    button(yes, 'danger-button', ctx.enabled, () => {
      ctx.draft.confirming = null;
      run();
    }),
    button(texts.cancel, 'secondary-button', true, () => {
      ctx.draft.confirming = null;
      ctx.refresh();
    }),
  ];
}

function slamButton(ctx: ScreenContext): HTMLElement[] {
  return confirmable(
    ctx,
    'slam',
    texts.slam,
    texts.confirmSlam,
    texts.confirmYes,
    'slam-button',
    () => {
      ctx.send({ type: 'startSlam' });
    },
  );
}

function buzzScreen(ctx: ScreenContext, current: Extract<Screen, { kind: 'buzz' }>): HTMLElement {
  const label = current.slam ? texts.buzzSlam : texts.buzz;
  const question = questionText(ctx.view);
  const top = [
    ...(current.slam ? [headline(texts.slamBuzzHint)] : []),
    ...(question === '' ? [] : [card('', question)]),
  ];
  if (ctx.room.mode === 'multi') {
    const team = current.teams[0] ?? 0;
    return screen([
      ...top,
      button(label, 'big-button own-buzz', ctx.enabled, () => {
        ctx.send({ type: 'buzz', team });
      }),
    ]);
  }
  return screen([
    ...top,
    headline(texts.whoBuzzed),
    note(texts.buzzHint),
    ...current.teams.map((team) =>
      button(teamName(ctx.view, team), 'big-button', ctx.enabled, () => {
        ctx.send({ type: 'buzz', team });
      }),
    ),
  ]);
}

function letterScreen(ctx: ScreenContext): HTMLElement {
  const { draft } = ctx;
  const keys = Array.from(ALPHABET, (letter) =>
    button(letter, letter === draft.letter ? 'key selected' : 'key', ctx.enabled, () => {
      draft.letter = letter;
      ctx.refresh();
    }),
  );
  return screen([
    headline(texts.letterFor(teamName(ctx.view, activeTeam(ctx.view)))),
    card('', questionText(ctx.view)),
    createElement('div', { className: 'keyboard' }, keys),
    button(texts.validate, 'big-button', ctx.enabled && draft.letter !== '', () => {
      ctx.send({ type: 'submitLetter', letter: draft.letter });
    }),
  ]);
}

function chooseWordScreen(ctx: ScreenContext, view: View<'round'>): HTMLElement {
  if (view.step.kind !== 'choosingWord') return screen([]);
  const { step } = view;
  const words = view.grid.words.filter((word) => !word.found);
  return screen([
    headline(texts.chooseWordFor(teamName(view, step.team), step.letter)),
    createElement(
      'div',
      { className: 'word-list' },
      words.map((word) =>
        button(
          texts.wordButton(word.number, patternText(wordPattern(view.grid, word.number))),
          'word-button',
          ctx.enabled && step.playable.includes(word.number),
          () => {
            ctx.send({ type: 'chooseWord', word: word.number });
          },
        ),
      ),
    ),
    ...slamButton(ctx),
  ]);
}

/** The tiles to fill, a hint until every blank is filled, and Valider with the whole word. */
function wordField(
  ctx: ScreenContext,
  grid: GridView,
  number: number,
  onValidate: (answer: string) => void,
): HTMLElement[] {
  const pattern = wordPattern(grid, number);
  const missing = (typed: string): number => blankCount(pattern) - typed.length;
  const hintText = (typed: string): string =>
    missing(typed) > 0 ? texts.lettersMissing(missing(typed)) : '';
  const validate = button(
    texts.validate,
    'big-button',
    ctx.enabled && missing(ctx.draft.word) === 0,
    () => {
      onValidate(fillPattern(pattern, ctx.draft.word).join(''));
    },
  );
  const hint = note(hintText(ctx.draft.word));
  const tiles = wordTiles(pattern, ctx.draft.word, (typed) => {
    ctx.draft.word = typed;
    hint.textContent = hintText(typed);
    validate.disabled = !ctx.enabled || missing(typed) > 0;
  });
  tiles.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !validate.disabled) validate.click();
  });
  return [tiles, hint, validate];
}

function answerWordScreen(ctx: ScreenContext, view: View<'round'>): HTMLElement {
  if (view.step.kind !== 'answeringWord') return screen([]);
  const field = wordField(ctx, view.grid, view.step.word, (answer) => {
    ctx.send({ type: 'submitWord', answer });
  });
  return screen([
    card(
      texts.wordHeading(view.step.word, wordPattern(view.grid, view.step.word).length),
      view.step.clue,
    ),
    ...field,
    button(texts.cancel, 'secondary-button', ctx.enabled, () => {
      ctx.send({ type: 'cancelWord' });
    }),
    ...slamButton(ctx),
  ]);
}

function slamScreen(ctx: ScreenContext, view: View<'round'>): HTMLElement {
  if (view.step.kind !== 'slam') return screen([]);
  const numbers = view.step.words;
  const { slam } = ctx.draft;
  const patterns = new Map(numbers.map((n) => [n, wordPattern(view.grid, n)]));
  const answerOf = (n: number): string[] => fillPattern(patterns.get(n) ?? [], slam[n] ?? '');
  const complete = (): boolean => numbers.every((n) => !answerOf(n).includes(''));
  const validate = button(texts.slamValidate, 'big-button', ctx.enabled && complete(), () => {
    ctx.send({
      type: 'submitSlam',
      answers: numbers.map((word) => ({ word, answer: answerOf(word).join('') })),
    });
  });
  const rows = numbers.map((number) => {
    const pattern = patterns.get(number) ?? [];
    return createElement('div', { className: 'slam-row' }, [
      createElement('div', { className: 'label', text: texts.wordHeading(number, pattern.length) }),
      wordTiles(pattern, slam[number] ?? '', (typed) => {
        slam[number] = typed;
        validate.disabled = !ctx.enabled || !complete();
      }),
    ]);
  });
  return screen([headline(texts.slamTitle), ...rows, validate]);
}

function pickNumbersScreen(ctx: ScreenContext, view: View<'final'>): HTMLElement {
  const left = FINAL_LETTER_PICKS - view.picked.length;
  const numbers = Array.from({ length: view.choices }, (_, index) => {
    const picked = view.picked.includes(index);
    return button(String(index + 1), picked ? 'key picked' : 'key', ctx.enabled && !picked, () => {
      ctx.send({ type: 'pickFinalNumber', index });
    });
  });
  return screen([
    headline(texts.pickNumbers(left)),
    createElement('div', { className: 'numbers' }, numbers),
  ]);
}

/** Every word not found yet, to fill in any order. */
function finalWordList(ctx: ScreenContext, view: View<'final'>): HTMLElement[] {
  const words = view.grid.words.filter((word) => !word.found);
  return [
    headline(texts.chooseFinalWord),
    createElement(
      'div',
      { className: 'word-list' },
      words.map((word) =>
        button(
          texts.wordButton(word.number, patternText(wordPattern(view.grid, word.number))),
          'word-button',
          ctx.enabled,
          () => {
            ctx.send({ type: 'selectFinalWord', word: word.number });
          },
        ),
      ),
    ),
  ];
}

function finalWordInput(ctx: ScreenContext, view: View<'final'>, number: number): HTMLElement[] {
  const field = wordField(ctx, view.grid, number, (answer) => {
    ctx.send({ type: 'submitFinalWord', answer });
  });
  return [
    headline(texts.wordHeading(number, wordPattern(view.grid, number).length)),
    ...field,
    button(texts.backToWords, 'secondary-button', ctx.enabled, () => {
      ctx.send({ type: 'cancelFinalWord' });
    }),
  ];
}

function finalWordScreen(ctx: ScreenContext, view: View<'final'>): HTMLElement {
  if (view.step.kind !== 'playing') return screen([]);
  const { step } = view;
  const timer = createElement('div', {
    className: 'timer',
    text: texts.seconds(Math.ceil(step.remainingMs / 1000)),
  });
  // Updated in place every second, so that the keyboard stays open while typing.
  timer.dataset['role'] = 'timer';
  return screen([
    timer,
    note(texts.finalTheme(view.theme)),
    ...(step.selected === null
      ? finalWordList(ctx, view)
      : finalWordInput(ctx, view, step.selected)),
  ]);
}

function waitScreen(ctx: ScreenContext, current: Extract<Screen, { kind: 'wait' }>): HTMLElement {
  const offer = standInOffer(ctx.view, ctx.room);
  const name = teamName(ctx.view, current.team);
  const grid = gridOf(ctx.view);
  const question = questionText(ctx.view);
  return screen([
    headline(texts.waiting(current.reason, name), 'headline turn-notice'),
    ...(question === '' ? [] : [card('', question)]),
    ...(offer === null
      ? []
      : [
          note(texts.phoneGone(teamName(ctx.view, offer)), 'note warning'),
          button(texts.standIn(teamName(ctx.view, offer)), 'secondary-button', ctx.enabled, () => {
            ctx.standIn(offer);
          }),
        ]),
    ...(grid === null ? [] : [note(texts.lookAtTv)]),
  ]);
}

function scoreList(view: View<'roundOver'>): HTMLElement {
  const rows = [...view.players]
    .map((team) => ({
      name: teamName(view, team),
      score: view.teams[team]?.scores[view.round - 1] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
  return createElement(
    'ul',
    { className: 'score-list' },
    rows.map((row) => createElement('li', { text: `${row.name} · ${texts.points(row.score)}` })),
  );
}

function roundOverScreen(ctx: ScreenContext, view: View<'roundOver'>): HTMLElement {
  const label = view.round >= ROUND_COUNT ? texts.toFinal : texts.nextRound;
  return screen([
    scoreList(view),
    ctx.room.isMaster
      ? button(label, 'big-button', ctx.enabled, () => {
          ctx.send({ type: 'nextRound' });
        })
      : note(texts.masterMovesOn),
  ]);
}

function rankingScreen(ctx: ScreenContext, view: View<'gameOver'>): HTMLElement {
  const final = view.final;
  const result =
    final === null
      ? texts.abandoned
      : texts.finalResult(teamName(view, final.finalist), final.prize);
  const lines = view.ranking.map(({ team, rank }) => {
    const current = view.teams[team];
    const score =
      final !== null && team === final.finalist
        ? texts.euros(final.prize)
        : texts.points(current?.scores[current.scores.length - 1] ?? 0);
    return createElement('li', {
      text: texts.rankLine(texts.rank(rank), current?.name ?? '', score),
    });
  });
  return screen([
    card('', result),
    createElement('ol', { className: 'score-list' }, lines),
    ...(ctx.room.isMaster
      ? [
          button(texts.newGame, 'big-button', ctx.enabled, () => {
            ctx.send({ type: 'newGame' });
          }),
        ]
      : []),
  ]);
}

function canSkip(view: PublicView): boolean {
  if (view.phase === 'tiebreak') return view.buzzer === null;
  return view.phase === 'round' && view.step.kind === 'question' && view.step.buzzer === null;
}

/** The master's buttons under every game screen. */
export function masterBar(ctx: ScreenContext): HTMLElement[] {
  const { view } = ctx;
  if (!ctx.room.isMaster || view.phase === 'setup' || view.phase === 'gameOver') return [];
  const skip = canSkip(view)
    ? [
        button(texts.nobodyKnows, 'secondary-button', ctx.enabled, () => {
          ctx.send({ type: 'skipQuestion' });
        }),
      ]
    : [];
  const reveal =
    view.phase === 'round'
      ? confirmable(
          ctx,
          'revealGrid',
          texts.revealGrid,
          texts.confirmRevealGrid,
          texts.confirm,
          'secondary-button',
          () => {
            ctx.send({ type: 'revealGrid' });
          },
        )
      : [];
  const abandon = confirmable(
    ctx,
    'abandon',
    texts.abandonGame,
    texts.confirmAbandon,
    texts.confirm,
    'link-button',
    () => {
      ctx.send({ type: 'abandonGame' });
    },
  );
  return [createElement('div', { className: 'master-bar' }, [...skip, ...reveal, ...abandon])];
}

export function gameScreen(current: Screen, ctx: ScreenContext): HTMLElement | null {
  const { view } = ctx;
  switch (current.kind) {
    case 'buzz':
      return buzzScreen(ctx, current);
    case 'letter':
      return letterScreen(ctx);
    case 'chooseWord':
      return view.phase === 'round' ? chooseWordScreen(ctx, view) : null;
    case 'answerWord':
      return view.phase === 'round' ? answerWordScreen(ctx, view) : null;
    case 'slam':
      return view.phase === 'round' ? slamScreen(ctx, view) : null;
    case 'pickNumbers':
      return view.phase === 'final' ? pickNumbersScreen(ctx, view) : null;
    case 'finalWord':
      return view.phase === 'final' ? finalWordScreen(ctx, view) : null;
    case 'wait':
      return waitScreen(ctx, current);
    case 'roundOver':
      return view.phase === 'roundOver' ? roundOverScreen(ctx, view) : null;
    case 'ranking':
      return view.phase === 'gameOver' ? rankingScreen(ctx, view) : null;
    case 'chooseMode':
    case 'waitForMode':
    case 'singleSetup':
    case 'multiLobby':
      return null;
  }
}
