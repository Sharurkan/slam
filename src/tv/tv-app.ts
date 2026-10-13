import './tv.css';
import { CONTENT } from '../content/content';
import type { Board } from '../game/board';
import { findWord } from '../game/board';
import { FINAL_TICK_MS } from '../game/config';
import type { GameEvent } from '../game/events';
import { canAct } from '../game/permissions';
import { reduce, type GameDeps } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import type { ConnectionStatus } from '../net/connection-status';
import { startHost, type LinkId } from '../net/host';
import { generateRoomCode, isValidRoomCode } from '../net/room-code';
import {
  HEARTBEAT,
  parsePhoneMessage,
  REPLACED,
  stateMessage,
  type PhoneMessage,
  type RoomMessage,
  type TvMessage,
} from '../protocol/messages';
import { toPublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { watchOnline } from '../shared/network';
import { loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { loadGame, saveGame } from '../storage/game-store';
import { loadRoom, saveRoom } from '../storage/room-store';
import {
  actorFor,
  chooseMode,
  dropLink,
  EMPTY_ROOM,
  greet,
  isMaster,
  isTeamConnected,
  joinTeam,
  removeTeam,
  roomViewFor,
  seatsView,
  type Room,
  type RoomChange,
} from './room';
import { createSetupScreen } from './screens';
import { describeDisplay } from './game-display';
import { createGameScreen, TIMER_WARNING_SECONDS } from './game-screen';
import { newlyRevealed } from './grid-layout';
import { createSound, type Sound } from './sound';
import { eventMessage, statusLabel, TV_TEXTS } from './texts';
import { keepScreenOn } from './wake-lock';

/** Leaves a replaced phone the time to read why before its link is closed. */
const DISMISS_DELAY_MS = 1000;

const GAME_DEPS: GameDeps = { random: Math.random, now: Date.now, content: CONTENT };

function controllerUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?mode=manette&code=${code}`;
}

function initialRoomCode(): string {
  const saved = loadRoomCode();
  return saved !== null && isValidRoomCode(saved) ? saved : generateRoomCode(Math.random);
}

function initialRoom(state: GameState): Room {
  const saved = loadRoom();
  const room: Room = saved === null ? EMPTY_ROOM : { ...saved, links: [] };
  // A game in progress needs a mode: without a saved room, it was played with one phone.
  return room.mode === null && state.phase !== 'setup' ? { ...room, mode: 'single' } : room;
}

/** The grid on screen, if any: the round grid, or the final grid until the ranking. */
function boardOf(state: GameState): Board | null {
  switch (state.phase) {
    case 'round':
    case 'roundOver':
    case 'final':
      return state.board;
    case 'gameOver':
      return state.final?.board ?? null;
    case 'setup':
    case 'tiebreak':
      return null;
  }
}

type SoundEffect = Exclude<keyof Sound, 'unlock' | 'isUnlocked'>;

/** One sound per action: the most telling event wins. */
function soundFor(events: readonly GameEvent[]): SoundEffect | null {
  const types = new Set(events.map((event) => event.type));
  if (types.has('slamWon')) return 'slam';
  if (types.has('finalOver'))
    return events.some((e) => e.type === 'finalOver' && e.complete) ? 'slam' : 'timeUp';
  if (
    types.has('slamFailed') ||
    types.has('wrongLetter') ||
    types.has('wrongWord') ||
    types.has('finalWrongWord') ||
    types.has('letterLost')
  ) {
    return 'wrong';
  }
  if (types.has('letterFound') || types.has('wordFound') || types.has('finalWordFound'))
    return 'right';
  if (types.has('roundStarted') || types.has('finalStarted') || types.has('tiebreakStarted'))
    return 'roundStart';
  if (types.has('buzzed')) return 'buzz';
  if (types.has('questionAsked') || types.has('finalNumberPicked')) return 'beep';
  return null;
}

function isTimedFinal(state: GameState): boolean {
  return state.phase === 'final' && state.step.kind === 'playing';
}

function secondsLeft(state: GameState): number | null {
  return state.phase === 'final' && state.step.kind === 'playing'
    ? Math.ceil(state.step.remainingMs / 1000)
    : null;
}

function setupSound(sound: Sound | null, onChange: () => void): void {
  const unlock = (): void => {
    if (sound === null || sound.isUnlocked()) return;
    void sound.unlock().then(onChange);
  };
  // The Fire TV remote "OK" button arrives as Enter, or as a click on the focused button.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') unlock();
  });
  document.addEventListener('click', unlock);
}

export function startTv(root: HTMLElement): void {
  const sound = createSound();
  const setup = createSetupScreen();
  const gameScreen = createGameScreen();
  const corner = createElement('div', { className: 'corner' });

  const warnings = { offline: '', room: '', teams: '', game: '', controller: '' };
  const saved = loadGame();
  if (saved.kind === 'unreadable') warnings.game = TV_TEXTS.saveUnreadable;
  let state: GameState = saved.kind === 'loaded' ? saved.state : INITIAL_STATE;
  let code = initialRoomCode();
  let room = initialRoom(state);
  let connection: ConnectionStatus = { kind: 'waiting' };
  let tickTimer: ReturnType<typeof setTimeout> | undefined;

  function updateCorner(): void {
    const soundHint = sound !== null && !sound.isUnlocked() ? TV_TEXTS.soundHint : '';
    corner.textContent = [
      TV_TEXTS.roomCode(code),
      statusLabel(connection),
      soundHint,
      ...Object.values(warnings),
    ]
      .filter((part) => part !== '')
      .join(' · ');
    setup.soundButton.textContent = soundHint === '' ? TV_TEXTS.soundOn : TV_TEXTS.soundButton;
  }

  function showRoom(): void {
    setup.showRoom(code, controllerUrl(code));
    warnings.room = saveRoomCode(code) ? '' : TV_TEXTS.storageFailed;
    updateCorner();
  }

  function offlineTeams(): number[] {
    if (room.mode !== 'multi' || state.phase === 'setup') return [];
    return state.teams.map((_, team) => team).filter((team) => !isTeamConnected(room, team));
  }

  function render(fresh: readonly string[] = []): void {
    setup.element.hidden = state.phase !== 'setup';
    gameScreen.element.hidden = state.phase === 'setup';
    if (state.phase !== 'setup') gameScreen.render(describeDisplay(state, offlineTeams()), fresh);
  }

  function present(action: GameAction, events: readonly GameEvent[]): void {
    const board = boardOf(state);
    const context = {
      teamName: (team: number) => ('teams' in state ? (state.teams[team]?.name ?? '') : ''),
      wordAnswer: (word: number) => (board === null ? '' : (findWord(board, word)?.answer ?? '')),
    };
    const messages = events.map((event) => eventMessage(event, context)).filter((m) => m !== null);
    if (messages.length > 0) gameScreen.showBanner(messages);
    if (events.some((event) => event.type === 'slamWon')) gameScreen.showSlam();
    const name = soundFor(events);
    if (name !== null) sound?.[name]();
    const seconds = secondsLeft(state);
    if (action.type === 'finalTick' && seconds !== null && seconds <= TIMER_WARNING_SECONDS)
      sound?.tick();
  }

  function scheduleTick(): void {
    clearTimeout(tickTimer);
    if (!isTimedFinal(state)) return;
    tickTimer = setTimeout(() => {
      if (isTimedFinal(state)) dispatch({ type: 'finalTick' });
    }, FINAL_TICK_MS);
  }

  function sendView(events: readonly GameEvent[], to: readonly LinkId[] = host.links()): void {
    const view = toPublicView(state, events);
    for (const link of to) host.send(link, stateMessage(view, roomViewFor(room, link)));
  }

  /** The phone is told first, so that it does not come back and take over in turn. */
  function dismiss(link: LinkId): void {
    host.send(link, REPLACED);
    setTimeout(() => {
      host.close(link);
    }, DISMISS_DELAY_MS);
  }

  function updateRoom(next: Room, close: readonly LinkId[] = []): void {
    room = next;
    for (const link of close) dismiss(link);
    warnings.teams = saveRoom(room) ? '' : TV_TEXTS.saveFailed;
    updateCorner();
    setup.showLobby(room.mode, seatsView(room));
    render();
    sendView(
      [],
      host.links().filter((link) => !close.includes(link)),
    );
  }

  function mayAct(link: LinkId, action: GameAction): boolean {
    switch (room.mode) {
      case null:
        return false;
      case 'single':
        return isMaster(room, link);
      case 'multi': {
        const actor = actorFor(room, link);
        const connected = (team: number): boolean => isTeamConnected(room, team);
        return actor !== null && canAct(state, action, actor, connected);
      }
    }
  }

  /** With one phone per player, the players are the ones that joined, whatever the phone sent. */
  function withSeatNames(action: GameAction): GameAction {
    if (action.type !== 'startGame' || room.mode !== 'multi') return action;
    return { ...action, teamNames: room.seats.map((seat) => seat.name) };
  }

  /** Changes to the room, only between games. */
  function roomChange(message: RoomMessage, link: LinkId): RoomChange | null {
    if (state.phase !== 'setup') return null;
    if (message.type === 'chooseMode') return chooseMode(room, link, message.mode);
    const next =
      message.type === 'joinTeam'
        ? joinTeam(room, link, message.name)
        : removeTeam(room, link, message.team);
    return next === null ? null : { room: next, close: [] };
  }

  function receive(message: PhoneMessage, link: LinkId): void {
    switch (message.type) {
      case 'hello': {
        const change = greet(room, link, message.clientId);
        updateRoom(change.room, change.close);
        return;
      }
      case 'chooseMode':
      case 'joinTeam':
      case 'removeTeam': {
        const change = roomChange(message, link);
        // A refused phone still gets an answer, so that it stops waiting.
        if (change === null) sendView([], [link]);
        else updateRoom(change.room, change.close);
        return;
      }
      case 'action':
        if (mayAct(link, message.action)) dispatch(withSeatNames(message.action));
        else sendView([], [link]);
        return;
      case 'heartbeat':
        return;
    }
  }

  function dispatch(action: GameAction): void {
    const before = boardOf(state)?.revealed ?? [];
    const result = reduce(state, action, GAME_DEPS);
    state = result.state;
    warnings.game = saveGame(state) ? '' : TV_TEXTS.gameSaveFailed;
    updateCorner();
    render(newlyRevealed(before, boardOf(state)?.revealed ?? []));
    present(action, result.events);
    sendView(result.events);
    scheduleTick();
  }

  const host = startHost<PhoneMessage, TvMessage>({
    code,
    createCode: () => generateRoomCode(Math.random),
    onCodeChange: (newCode) => {
      code = newCode;
      showRoom();
    },
    onStatus: (status) => {
      connection = status;
      setup.showConnection(statusLabel(status), status.kind);
      updateCorner();
      if (status.kind !== 'connected') return;
      warnings.controller = '';
      sendView([]);
    },
    decode: parsePhoneMessage,
    heartbeat: HEARTBEAT,
    onLinkLost: (link) => {
      updateRoom(dropLink(room, link));
    },
    onMessage: receive,
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      warnings.controller = TV_TEXTS.updateController;
      updateCorner();
    },
  });

  setupSound(sound, updateCorner);
  keepScreenOn();
  watchOnline((online) => {
    warnings.offline = online ? '' : TV_TEXTS.offline;
    updateCorner();
  });
  root.replaceChildren(
    createElement('main', { className: 'game-tv' }, [setup.element, gameScreen.element, corner]),
  );
  showRoom();
  setup.showConnection(statusLabel(connection), connection.kind);
  setup.showLobby(room.mode, seatsView(room));
  render();
  setup.soundButton.focus();
  resume();

  /** After a reload in the middle of a game: say so, and restart the final timer where it was. */
  function resume(): void {
    if (state.phase === 'setup') return;
    gameScreen.showBanner([{ text: TV_TEXTS.gameResumed }]);
    if (isTimedFinal(state)) dispatch({ type: 'resumeFinal' });
  }
}
