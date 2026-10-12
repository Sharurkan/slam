import type { PlayMode, RoomView } from '../protocol/room';
import { createElement } from '../shared/dom';
import { createQrCode } from './qr';
import { TV_TEXTS } from './texts';

export interface SetupScreen {
  element: HTMLElement;
  soundButton: HTMLButtonElement;
  showRoom(code: string, controllerUrl: string): void;
  showConnection(label: string, kind: string): void;
  showLobby(mode: PlayMode | null, seats: RoomView['seats']): void;
}

function lobbyHint(mode: PlayMode | null): string {
  if (mode === null) return TV_TEXTS.lobby.choosing;
  return mode === 'single' ? TV_TEXTS.lobby.single : TV_TEXTS.lobby.multi;
}

function seatRow(seat: RoomView['seats'][number], index: number): HTMLElement {
  const state = seat.connected ? TV_TEXTS.lobby.connected : TV_TEXTS.lobby.disconnected;
  return createElement('li', { className: seat.connected ? 'seat' : 'seat offline' }, [
    createElement('span', { className: 'seat-name', text: TV_TEXTS.seatName(seat.name, index) }),
    createElement('span', { className: 'seat-state', text: state }),
  ]);
}

export function createSetupScreen(): SetupScreen {
  const code = createElement('div', { className: 'setup-code' });
  const qrSlot = createElement('div', { className: 'setup-qr' });
  const url = createElement('div', { className: 'setup-url' });
  const connection = createElement('div', { className: 'connection' });
  const hint = createElement('p', { className: 'muted', text: lobbyHint(null) });
  const seatList = createElement('ul', { className: 'seats' });
  const soundButton = createElement('button', {
    className: 'sound-button',
    text: TV_TEXTS.soundButton,
  });
  const element = createElement('section', { className: 'setup' }, [
    createElement('h1', { text: TV_TEXTS.title }),
    code,
    createElement('div', { className: 'setup-join' }, [
      qrSlot,
      createElement('div', { className: 'setup-help' }, [
        createElement('p', { text: TV_TEXTS.scanToPlay }),
        createElement('p', { className: 'muted', text: TV_TEXTS.orOpen }),
        url,
      ]),
    ]),
    connection,
    hint,
    seatList,
    soundButton,
  ]);
  return {
    element,
    soundButton,
    showRoom: (roomCode, controllerUrl) => {
      code.textContent = roomCode;
      url.textContent = controllerUrl;
      qrSlot.replaceChildren(createQrCode(controllerUrl));
    },
    showConnection: (label, kind) => {
      connection.textContent = label;
      connection.dataset['kind'] = kind;
    },
    showLobby: (mode, seats) => {
      hint.textContent = lobbyHint(mode);
      seatList.hidden = mode !== 'multi';
      seatList.replaceChildren(
        ...(seats.length === 0
          ? [createElement('li', { className: 'muted', text: TV_TEXTS.lobby.noTeam })]
          : seats.map(seatRow)),
      );
    },
  };
}
