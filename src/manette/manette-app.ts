import './manette.css';
import { startClient } from '../net/client';
import type { ConnectionStatus } from '../net/connection-status';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../net/room-code';
import type { PhoneAction } from '../protocol/actions';
import {
  actionMessage,
  chooseModeMessage,
  HEARTBEAT,
  helloMessage,
  joinTeamMessage,
  parseTvMessage,
  removeTeamMessage,
  type PhoneMessage,
  type TvMessage,
} from '../protocol/messages';
import type { RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { watchOnline } from '../shared/network';
import { loadClientId } from '../storage/client-id-store';
import { clearRoomCode, loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { activeTeam, describeScreen, type Screen } from './controls';
import { readCodeFromUrl, writeCodeToUrl } from './room-url';
import { isTestMode } from '../shared/mode';
import { emptyDraft, renderScreen, type RoomRequest, type SetupDraft } from './screens';
import { messageFor, PHONE_TEXTS, statusLabel, type BannerMessage } from './texts';

/** If the TV never answers an action, buttons come back after this delay. */
const PENDING_TIMEOUT_MS = 5000;

const texts = PHONE_TEXTS;

const PHONE_ROOM_CODE_KEY = 'slam.phoneRoomCode';

/** Until the TV tells otherwise: no mode chosen, no player. */
const UNKNOWN_ROOM: RoomView = { mode: null, isMaster: false, team: null, seats: [] };

function roomMessage(request: RoomRequest): PhoneMessage {
  switch (request.type) {
    case 'chooseMode':
      return chooseModeMessage(request.mode);
    case 'joinTeam':
      return joinTeamMessage(request.name);
    case 'removeTeam':
      return removeTeamMessage(request.team);
  }
}

/**
 * Another phone joining or leaving rebuilds the screen: what is being typed and
 * the keyboard focus must survive it.
 */
function replaceKeepingInputs(
  container: HTMLElement,
  next: HTMLElement,
  sameScreen: boolean,
): void {
  const before = Array.from(container.querySelectorAll('input'));
  const focused = before.findIndex((input) => input === document.activeElement);
  container.replaceChildren(next);
  if (!sameScreen) return;
  const after = Array.from(container.querySelectorAll('input'));
  before.forEach((input, index) => {
    const target = after[index];
    if (target === undefined || target.value !== '' || input.value === '') return;
    target.value = input.value;
    target.dispatchEvent(new Event('input'));
  });
  if (focused >= 0) after[focused]?.focus();
}

/** With one phone per player, the player this phone plays for. */
function ownName(view: PublicView, room: RoomView): string | null {
  if (room.mode !== 'multi' || room.team === null) return null;
  const inGame = view.phase === 'setup' ? undefined : view.teams[room.team]?.name;
  const joined = room.seats[room.team]?.name ?? '';
  return inGame ?? (joined === '' ? texts.playerPlaceholder(room.team) : joined);
}

/** The code from the QR code wins; otherwise the phone reconnects to the last TV. */
function initialCode(): string | null {
  const fromUrl = readCodeFromUrl();
  if (fromUrl !== null) return fromUrl;
  const saved = loadRoomCode(PHONE_ROOM_CODE_KEY);
  if (saved === null || !isValidRoomCode(saved)) return null;
  writeCodeToUrl(saved);
  return saved;
}

export function startManette(root: HTMLElement): void {
  const code = initialCode();
  if (code === null) showCodeForm(root);
  else showController(root, code);
}

function showCodeForm(root: HTMLElement): void {
  const input = createElement('input', { className: 'text-input code-input' });
  input.maxLength = ROOM_CODE_LENGTH;
  input.placeholder = texts.codePlaceholder;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'characters');
  const error = createElement('p', { className: 'note error' });
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: texts.codeLabel }, [input]),
    createElement('button', { className: 'big-button', text: texts.connect }),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = normalizeRoomCode(input.value);
    if (!isValidRoomCode(code)) {
      error.textContent = texts.invalidCode;
      return;
    }
    writeCodeToUrl(code);
    showController(root, code);
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('h1', { text: texts.title }),
      form,
    ]),
  );
  input.focus();
}

function headerText(view: PublicView): string {
  switch (view.phase) {
    case 'setup':
      return texts.setupTitle;
    case 'round':
      return texts.round(view.round);
    case 'roundOver':
      return texts.roundOver(view.round);
    case 'tiebreak':
      return texts.tiebreak;
    case 'final':
      return texts.final;
    case 'gameOver':
      return texts.ranking;
  }
}

/** Scores of the players still in the game, for the current round. */
function scoreStrip(view: PublicView): string {
  if (view.phase === 'setup' || view.phase === 'gameOver') return '';
  const playing =
    view.phase === 'final'
      ? [view.finalist]
      : view.phase === 'tiebreak'
        ? view.contenders
        : view.players;
  return playing
    .map((index) => {
      const team = view.teams[index];
      return team === undefined
        ? ''
        : texts.score(team.name, team.scores[team.scores.length - 1] ?? 0);
    })
    .join(' · ');
}

/** The view without the time left, so that the screen is not rebuilt every second. */
function withoutTimer(view: PublicView): PublicView {
  if (view.phase !== 'final' || view.step.kind !== 'playing') return view;
  return { ...view, step: { ...view.step, remainingMs: 0 } };
}

/** Changes whenever the step moves on: what was typed for the previous one is dropped. */
function stepKey(view: PublicView, screen: Screen): string {
  const current = withoutTimer(view);
  const step =
    current.phase === 'round' || current.phase === 'final'
      ? current.step
      : current.phase === 'tiebreak'
        ? current.buzzer
        : null;
  return JSON.stringify({ screen, phase: view.phase, step });
}

function secondsLeft(view: PublicView): number | null {
  return view.phase === 'final' && view.step.kind === 'playing' && view.step.remainingMs !== null
    ? Math.ceil(view.step.remainingMs / 1000)
    : null;
}

/** With one phone, another phone took over: this one waits until asked to take over again. */
function showReplaced(root: HTMLElement, code: string): void {
  const takeOver = createElement('button', { className: 'big-button', text: texts.takeOver });
  takeOver.addEventListener('click', () => {
    showController(root, code);
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('div', { className: 'room', text: texts.room(code) }),
      createElement('p', { className: 'headline', text: texts.replaced }),
      takeOver,
    ]),
  );
}

function showController(root: HTMLElement, code: string): void {
  const remembered = saveRoomCode(code, PHONE_ROOM_CODE_KEY);
  const clientId = loadClientId(Math.random).id;
  let view: PublicView | null = null;
  let room: RoomView = UNKNOWN_ROOM;
  let status: ConnectionStatus = { kind: 'waiting' };
  let message: BannerMessage | null = null;
  let versionError = false;
  let online = true;
  let pending = false;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let renderedKey = '';
  let renderedScreen = '';
  let renderedStep = '';
  /** Player the master plays for, while that phone is disconnected. */
  let standingIn: number | null = null;
  let draft = emptyDraft();
  const setup: SetupDraft = {
    teamCount: 2,
    names: [],
    ownName: '',
    testMode: isTestMode(window.location.search),
    firstRound: 1,
    gridId: '',
    timedFinal: true,
  };

  const statusElement = createElement('div', { className: 'connection' });
  const header = createElement('div', { className: 'header' });
  const ownElement = createElement('div', { className: 'own-team' });
  const scoresElement = createElement('div', { className: 'score-strip' });
  const messageElement = createElement('div', { className: 'message' });
  const body = createElement('div', { className: 'body' });
  const changeButton = createElement('button', {
    className: 'link-button',
    text: texts.changeCode,
  });

  function setPending(value: boolean): void {
    pending = value;
    clearTimeout(pendingTimer);
    if (value) {
      pendingTimer = setTimeout(() => {
        setPending(false);
        message = { text: texts.noAnswer, isError: true };
        render();
      }, PENDING_TIMEOUT_MS);
    }
  }

  function sendMessage(outgoing: PhoneMessage): void {
    if (pending || status.kind !== 'connected') return;
    setPending(true);
    client.send(outgoing);
    render();
  }

  function send(action: PhoneAction): void {
    sendMessage(actionMessage(action));
  }

  function renderBody(current: PublicView): void {
    const screen = describeScreen(current, room, standingIn);
    const step = stepKey(current, screen);
    if (step !== renderedStep) draft = emptyDraft();
    renderedStep = step;
    const enabled = status.kind === 'connected' && !pending;
    // Rebuilding the screen would wipe what is being typed: only do it when something changed.
    const key = JSON.stringify({
      screen,
      enabled,
      room,
      // Events only feed the message line: a new list alone must not rebuild the screen.
      view: { ...withoutTimer(current), lastEvents: [] },
      setup: [setup.teamCount, setup.firstRound, setup.timedFinal],
      draft: [draft.letter, draft.confirming],
    });
    updateTimer(current);
    if (key === renderedKey) return;
    renderedKey = key;
    const screenKey = JSON.stringify(screen);
    const sameScreen = screenKey === renderedScreen;
    renderedScreen = screenKey;
    replaceKeepingInputs(
      body,
      renderScreen(screen, {
        view: current,
        room,
        enabled,
        send,
        sendRoom: (request) => {
          sendMessage(roomMessage(request));
        },
        setup,
        draft,
        standIn: (team) => {
          standingIn = team;
          render();
        },
        refresh: render,
      }),
      sameScreen,
    );
    updateTimer(current);
  }

  function updateTimer(current: PublicView): void {
    const seconds = secondsLeft(current);
    const timer = body.querySelector<HTMLElement>('[data-role="timer"]');
    if (timer !== null && seconds !== null) timer.textContent = texts.seconds(seconds);
  }

  function render(): void {
    const problem = !online ? texts.offline : versionError ? texts.updatePage : null;
    statusElement.textContent = problem ?? statusLabel(status);
    statusElement.dataset['kind'] = problem === null ? status.kind : 'error';
    messageElement.textContent = message?.text ?? '';
    messageElement.classList.toggle('error', message?.isError ?? false);
    if (view === null) return;
    header.textContent = headerText(view);
    const name = ownName(view, room);
    ownElement.textContent = name === null ? '' : texts.youAre(name);
    scoresElement.textContent = scoreStrip(view);
    renderBody(view);
  }

  function receiveState(next: PublicView, nextRoom: RoomView): void {
    const moved = view === null || next.phase !== view.phase;
    // Standing in lasts for one turn: it stops when the hand moves on.
    if (activeTeam(next) !== standingIn) standingIn = null;
    view = next;
    room = nextRoom;
    versionError = false;
    setPending(false);
    if (next.lastEvents.length > 0 || moved) {
      message = messageFor(next.lastEvents, (team) =>
        next.phase === 'setup' ? '' : (next.teams[team]?.name ?? ''),
      );
    }
    render();
  }

  const client = startClient<TvMessage, PhoneMessage>({
    code,
    decode: parseTvMessage,
    heartbeat: HEARTBEAT,
    onMessage: (incoming) => {
      if (incoming.type === 'state') receiveState(incoming.view, incoming.room);
      if (incoming.type === 'replaced') {
        client.stop();
        setPending(false);
        showReplaced(root, code);
      }
    },
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      versionError = true;
      render();
    },
    onStatus: (next) => {
      status = next;
      setPending(false);
      if (next.kind === 'connected') client.send(helloMessage(clientId));
      render();
    },
  });

  changeButton.addEventListener('click', () => {
    client.stop();
    setPending(false);
    writeCodeToUrl(null);
    clearRoomCode(PHONE_ROOM_CODE_KEY);
    showCodeForm(root);
  });

  watchOnline((isOnline) => {
    online = isOnline;
    render();
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('div', { className: 'room', text: texts.room(code) }),
      statusElement,
      header,
      ownElement,
      scoresElement,
      messageElement,
      body,
      ...(remembered
        ? []
        : [createElement('p', { className: 'note', text: texts.codeNotRemembered })]),
      changeButton,
    ]),
  );
  render();
}
