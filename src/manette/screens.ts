import type { PhoneAction } from '../protocol/actions';
import type { PlayMode, RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import type { Screen } from './controls';
import { gameScreen, masterBar } from './game-screens';
import { chooseModeScreen, multiLobbyScreen, singleSetupScreen } from './setup-screens';
import { PHONE_TEXTS as texts } from './texts';
import { screen } from './widgets';

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
  /** &test in the address: starting round and forced grid can be chosen. */
  testMode: boolean;
  firstRound: number;
  /** '' for a grid drawn at random. */
  gridId: string;
  timedFinal: boolean;
}

/** Actions asked twice before they are sent. */
export type Confirmable = 'slam' | 'revealGrid' | 'stopFinal' | 'abandon';

/** What is being typed or chosen on a game screen. Cleared when the screen changes. */
export interface GameDraft {
  letter: string;
  word: string;
  slam: Record<number, string>;
  confirming: Confirmable | null;
}

export function emptyDraft(): GameDraft {
  return { letter: '', word: '', slam: {}, confirming: null };
}

export interface ScreenContext {
  view: PublicView;
  room: RoomView;
  /** False while disconnected or waiting for the TV. */
  enabled: boolean;
  send(action: PhoneAction): void;
  sendRoom(request: RoomRequest): void;
  setup: SetupDraft;
  draft: GameDraft;
  /** The master plays this turn for a disconnected player. */
  standIn(team: number): void;
  refresh(): void;
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
    default:
      return createElement('div', { className: 'game-body' }, [
        gameScreen(current, ctx) ?? screen([]),
        ...masterBar(ctx),
      ]);
  }
}
