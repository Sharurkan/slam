import { CONTENT } from '../content/content';
import {
  FINAL_DURATION_MS,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  ROUND_COUNT,
} from '../game/config';
import type { PhoneAction } from '../protocol/actions';
import type { PlayMode, RoomView } from '../protocol/room';
import { createElement } from '../shared/dom';
import { canStartMultiGame } from './controls';
import type { ScreenContext } from './screens';
import { PHONE_TEXTS as texts } from './texts';
import { button, note, screen, textInput } from './widgets';

function modeSwitch(ctx: ScreenContext, mode: PlayMode): HTMLElement {
  const label = mode === 'single' ? texts.toSingleMode : texts.toMultiMode;
  return button(label, 'link-button', ctx.enabled, () => {
    ctx.sendRoom({ type: 'chooseMode', mode });
  });
}

export function chooseModeScreen(ctx: ScreenContext): HTMLElement {
  const choice = (mode: PlayMode, label: string, hint: string): HTMLElement[] => [
    button(label, 'big-button', ctx.enabled, () => {
      ctx.sendRoom({ type: 'chooseMode', mode });
    }),
    note(hint),
  ];
  return screen([
    createElement('p', { className: 'headline', text: texts.chooseMode }),
    ...choice('single', texts.singleMode, texts.singleModeHint),
    ...choice('multi', texts.multiMode, texts.multiModeHint),
  ]);
}

function select(
  label: string,
  options: { value: string; text: string }[],
  value: string,
  onChange: (value: string) => void,
): HTMLElement {
  const element = createElement(
    'select',
    { className: 'select' },
    options.map((option) => {
      const item = createElement('option', { text: option.text });
      item.value = option.value;
      return item;
    }),
  );
  element.value = value;
  element.addEventListener('change', () => {
    onChange(element.value);
  });
  return createElement('label', { className: 'label', text: label }, [element]);
}

/** Test shortcuts (&test in the address): starting round and forced grid. */
function testOptions(ctx: ScreenContext): HTMLElement[] {
  const { setup } = ctx;
  if (!setup.testMode) return [];
  const rounds = Array.from({ length: ROUND_COUNT + 1 }, (_, i) => i + 1);
  const grids =
    setup.firstRound > ROUND_COUNT
      ? CONTENT.finalGrids
      : (CONTENT.roundGrids[setup.firstRound - 1] ?? []);
  return [
    select(
      texts.testFirstRound,
      rounds.map((round) => ({
        value: String(round),
        text: texts.roundChoice(round, round > ROUND_COUNT),
      })),
      String(setup.firstRound),
      (value) => {
        setup.firstRound = Number(value);
        setup.gridId = '';
        ctx.refresh();
      },
    ),
    select(
      texts.testGrid,
      [
        { value: '', text: texts.randomGrid },
        ...grids.map((grid) => ({ value: grid.id, text: grid.id })),
      ],
      setup.gridId,
      (value) => {
        setup.gridId = value;
      },
    ),
  ];
}

/** With or without the final timer: without it, the master ends the final. */
function finalTimerChoice(ctx: ScreenContext): HTMLElement[] {
  const { setup } = ctx;
  const option = (timed: boolean, label: string): HTMLElement =>
    button(label, timed === setup.timedFinal ? 'choice selected' : 'choice', true, () => {
      setup.timedFinal = timed;
      ctx.refresh();
    });
  return [
    createElement('div', { className: 'label', text: texts.finalTimer }),
    createElement('div', { className: 'choices' }, [
      option(true, texts.withTimer(FINAL_DURATION_MS / 1000)),
      option(false, texts.withoutTimer),
    ]),
  ];
}

function startAction(ctx: ScreenContext, teamNames: string[]): PhoneAction {
  const { setup } = ctx;
  const { timedFinal } = setup;
  if (!setup.testMode) return { type: 'startGame', teamNames, timedFinal };
  const gridId = setup.gridId === '' ? undefined : setup.gridId;
  return { type: 'startGame', teamNames, firstRound: setup.firstRound, gridId, timedFinal };
}

export function singleSetupScreen(ctx: ScreenContext): HTMLElement {
  const { setup } = ctx;
  const counts = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i);
  const countButtons = counts.map((count) =>
    button(String(count), count === setup.teamCount ? 'choice selected' : 'choice', true, () => {
      setup.teamCount = count;
      ctx.refresh();
    }),
  );
  const inputs = Array.from({ length: setup.teamCount }, (_, index) =>
    textInput(
      setup.names[index] ?? '',
      texts.playerPlaceholder(index),
      MAX_TEAM_NAME_LENGTH,
      (value) => {
        setup.names[index] = value;
      },
    ),
  );
  const start = button(texts.start, 'big-button', ctx.enabled, () => {
    const teamNames = Array.from({ length: setup.teamCount }, (_, i) => setup.names[i] ?? '');
    ctx.send(startAction(ctx, teamNames));
  });
  return screen([
    createElement('div', { className: 'label', text: texts.playerCount }),
    createElement('div', { className: 'choices' }, countButtons),
    ...inputs,
    ...finalTimerChoice(ctx),
    ...testOptions(ctx),
    start,
    modeSwitch(ctx, 'multi'),
  ]);
}

function seatItem(ctx: ScreenContext, seat: RoomView['seats'][number], index: number) {
  const parts = [seat.name === '' ? texts.playerPlaceholder(index) : seat.name];
  if (index === ctx.room.team) parts.push(texts.you);
  if (!seat.connected) parts.push(`(${texts.disconnected})`);
  const canRemove = ctx.room.isMaster && index !== ctx.room.team;
  return createElement('li', { text: parts.join(' ') }, [
    ...(canRemove
      ? [
          button(texts.remove, 'link-button', ctx.enabled, () => {
            ctx.sendRoom({ type: 'removeTeam', team: index });
          }),
        ]
      : []),
  ]);
}

function startHint(room: RoomView): string | null {
  if (!room.isMaster) return texts.masterStarts;
  if (room.team === null) return texts.masterMustJoin;
  if (room.seats.length < MIN_TEAMS) return texts.needPlayers(MIN_TEAMS);
  return null;
}

export function multiLobbyScreen(ctx: ScreenContext): HTMLElement {
  const { room, setup } = ctx;
  const joined = room.team !== null;
  const full = !joined && room.seats.length >= MAX_TEAMS;
  const name = textInput(setup.ownName, texts.ownName, MAX_TEAM_NAME_LENGTH, (value) => {
    setup.ownName = value;
  });
  const join = button(
    joined ? texts.rename : texts.join,
    'secondary-button',
    ctx.enabled && !full,
    () => {
      ctx.sendRoom({ type: 'joinTeam', name: setup.ownName });
    },
  );
  const seats =
    room.seats.length === 0
      ? [note(texts.noPlayerYet)]
      : [
          createElement(
            'ul',
            { className: 'seat-list' },
            room.seats.map((seat, index) => seatItem(ctx, seat, index)),
          ),
        ];
  const hint = startHint(room);
  const masterControls = room.isMaster
    ? [
        ...finalTimerChoice(ctx),
        ...testOptions(ctx),
        button(texts.start, 'big-button', ctx.enabled && canStartMultiGame(room, MIN_TEAMS), () => {
          // The TV replaces the names with the ones the players joined with.
          ctx.send(
            startAction(
              ctx,
              room.seats.map((seat) => seat.name),
            ),
          );
        }),
        modeSwitch(ctx, 'single'),
      ]
    : [];
  return screen([
    createElement('label', { className: 'label', text: texts.ownName }, [name]),
    join,
    ...(full ? [note(texts.seatsFull, 'note error')] : []),
    createElement('div', { className: 'label', text: texts.joinedPlayers }),
    ...seats,
    ...(hint === null ? [] : [note(hint)]),
    ...masterControls,
  ]);
}
