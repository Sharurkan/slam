import './tv.css';
import { CONTENT } from '../content/content';
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
import { createGameScreen, createSetupScreen } from './screens';
import { createSound, type Sound } from './sound';
import { statusLabel, TV_TEXTS } from './texts';
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

function initialRoom(): Room {
  const saved = loadRoom();
  return saved === null ? EMPTY_ROOM : { ...saved, links: [] };
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

  const warnings = { offline: '', room: '', teams: '', controller: '' };
  let state: GameState = INITIAL_STATE;
  let code = initialRoomCode();
  let room = initialRoom();
  let connection: ConnectionStatus = { kind: 'waiting' };

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

  function render(): void {
    setup.element.hidden = state.phase !== 'setup';
    gameScreen.element.hidden = state.phase === 'setup';
    if (state.phase !== 'setup') gameScreen.render(state, offlineTeams());
  }

  function playSounds(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'buzzed') sound?.buzz();
      if (event.type === 'questionAsked') sound?.beep();
    }
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
    const result = reduce(state, action, GAME_DEPS);
    state = result.state;
    render();
    playSounds(result.events);
    sendView(result.events);
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
}
