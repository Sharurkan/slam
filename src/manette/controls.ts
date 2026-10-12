import type { RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';

/** What the phone shows, decided from the view and the room only. */
export type Screen =
  | { kind: 'chooseMode' }
  | { kind: 'waitForMode' }
  | { kind: 'singleSetup' }
  | { kind: 'multiLobby' }
  /** Placeholder until the controller game screens (phase 6). */
  | { kind: 'inGame'; over: boolean };

export function describeScreen(view: PublicView, room: RoomView): Screen {
  if (view.phase !== 'setup') return { kind: 'inGame', over: view.phase === 'gameOver' };
  if (room.mode === null) return room.isMaster ? { kind: 'chooseMode' } : { kind: 'waitForMode' };
  return room.mode === 'single' ? { kind: 'singleSetup' } : { kind: 'multiLobby' };
}

/** With one phone per player, the master may start once it joined, with enough players. */
export function canStartMultiGame(room: RoomView, minPlayers: number): boolean {
  return room.isMaster && room.team !== null && room.seats.length >= minPlayers;
}
