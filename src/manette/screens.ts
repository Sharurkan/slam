import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS, MIN_TEAMS } from '../game/config';
import type { PhoneAction } from '../protocol/actions';
import type { PlayMode, RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { canStartMultiGame, type Screen } from './controls';
import { PHONE_TEXTS as texts } from './texts';

/** Messages that change the room rather than the game. */
export type RoomRequest =
  | { type: 'chooseMode'; mode: PlayMode }
  | { type: 'joinTeam'; name: string }
  | { type: 'removeTeam'; team: number };

/** What is being set up on the phone, kept across renders. */
export interface SetupDraft {
  teamCount: number;
  names: string[];
  ownName: string;
}

export interface ScreenContext {
  view: PublicView;
  room: RoomView;
  /** False while disconnected or waiting for the TV. */
  enabled: boolean;
  send(action: PhoneAction): void;
  sendRoom(request: RoomRequest): void;
  setup: SetupDraft;
  refresh(): void;
}

function button(
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

function textInput(value: string, placeholder: string, onInput: (value: string) => void) {
  const input = createElement('input', { className: 'text-input' });
  input.maxLength = MAX_TEAM_NAME_LENGTH;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.addEventListener('input', () => {
    onInput(input.value);
  });
  return input;
}

function screen(children: HTMLElement[]): HTMLElement {
  return createElement('div', { className: 'screen' }, children);
}

function modeSwitch(ctx: ScreenContext, mode: PlayMode): HTMLElement {
  const label = mode === 'single' ? texts.toSingleMode : texts.toMultiMode;
  return button(label, 'link-button', ctx.enabled, () => {
    ctx.sendRoom({ type: 'chooseMode', mode });
  });
}

function chooseModeScreen(ctx: ScreenContext): HTMLElement {
  const choice = (mode: PlayMode, label: string, hint: string): HTMLElement[] => [
    button(label, 'big-button', ctx.enabled, () => {
      ctx.sendRoom({ type: 'chooseMode', mode });
    }),
    createElement('p', { className: 'note', text: hint }),
  ];
  return screen([
    createElement('p', { className: 'headline', text: texts.chooseMode }),
    ...choice('single', texts.singleMode, texts.singleModeHint),
    ...choice('multi', texts.multiMode, texts.multiModeHint),
  ]);
}

function singleSetupScreen(ctx: ScreenContext): HTMLElement {
  const { setup } = ctx;
  const counts = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i);
  const countButtons = counts.map((count) =>
    button(String(count), count === setup.teamCount ? 'choice selected' : 'choice', true, () => {
      setup.teamCount = count;
      ctx.refresh();
    }),
  );
  const inputs = Array.from({ length: setup.teamCount }, (_, index) =>
    textInput(setup.names[index] ?? '', texts.playerPlaceholder(index), (value) => {
      setup.names[index] = value;
    }),
  );
  const start = button(texts.start, 'big-button', ctx.enabled, () => {
    const teamNames = Array.from({ length: setup.teamCount }, (_, i) => setup.names[i] ?? '');
    ctx.send({ type: 'startGame', teamNames });
  });
  return screen([
    createElement('div', { className: 'label', text: texts.playerCount }),
    createElement('div', { className: 'choices' }, countButtons),
    ...inputs,
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

function multiLobbyScreen(ctx: ScreenContext): HTMLElement {
  const { room, setup } = ctx;
  const joined = room.team !== null;
  const full = !joined && room.seats.length >= MAX_TEAMS;
  const name = textInput(setup.ownName, texts.ownName, (value) => {
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
      ? [createElement('p', { className: 'note', text: texts.noPlayerYet })]
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
        button(texts.start, 'big-button', ctx.enabled && canStartMultiGame(room, MIN_TEAMS), () => {
          // The TV replaces the names with the ones the players joined with.
          ctx.send({ type: 'startGame', teamNames: room.seats.map((seat) => seat.name) });
        }),
        modeSwitch(ctx, 'single'),
      ]
    : [];
  return screen([
    createElement('label', { className: 'label', text: texts.ownName }, [name]),
    join,
    ...(full ? [createElement('p', { className: 'note error', text: texts.seatsFull })] : []),
    createElement('div', { className: 'label', text: texts.joinedPlayers }),
    ...seats,
    ...(hint === null ? [] : [createElement('p', { className: 'note', text: hint })]),
    ...masterControls,
  ]);
}

/** Placeholder until the controller game screens (phase 6): the master can still end the game. */
function inGameScreen(ctx: ScreenContext, over: boolean): HTMLElement {
  const masterButton = over
    ? button(texts.newGame, 'secondary-button', ctx.enabled, () => {
        ctx.send({ type: 'newGame' });
      })
    : button(texts.abandonGame, 'secondary-button', ctx.enabled, () => {
        ctx.send({ type: 'abandonGame' });
      });
  return screen([
    createElement('p', { className: 'note', text: texts.screenComing }),
    ...(ctx.room.isMaster ? [masterButton] : []),
  ]);
}

export function renderScreen(current: Screen, ctx: ScreenContext): HTMLElement {
  switch (current.kind) {
    case 'chooseMode':
      return chooseModeScreen(ctx);
    case 'waitForMode':
      return screen([createElement('p', { className: 'note', text: texts.masterChoosesMode })]);
    case 'singleSetup':
      return singleSetupScreen(ctx);
    case 'multiLobby':
      return multiLobbyScreen(ctx);
    case 'inGame':
      return inGameScreen(ctx, current.over);
  }
}
