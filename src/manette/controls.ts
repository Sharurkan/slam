import type { RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';

/** What the phone shows, decided from the view and the room only. */
export type Screen =
  | { kind: 'chooseMode' }
  | { kind: 'waitForMode' }
  | { kind: 'singleSetup' }
  | { kind: 'multiLobby' }
  /** One phone: a button per player, tapped by whoever holds the phone. */
  | { kind: 'singleBuzz' }
  /** One phone per player: this phone's own BUZZ button. */
  | { kind: 'ownBuzz'; team: number }
  /** One phone per player, but this phone has no player in the game. */
  | { kind: 'spectator' };

export function describeScreen(view: PublicView, room: RoomView): Screen {
  if (view.phase === 'setup') {
    if (room.mode === null) return room.isMaster ? { kind: 'chooseMode' } : { kind: 'waitForMode' };
    return room.mode === 'single' ? { kind: 'singleSetup' } : { kind: 'multiLobby' };
  }
  if (room.mode !== 'multi') return { kind: 'singleBuzz' };
  return room.team === null ? { kind: 'spectator' } : { kind: 'ownBuzz', team: room.team };
}

/** With one phone per player, the master may start once it joined, with enough players. */
export function canStartMultiGame(room: RoomView, minPlayers: number): boolean {
  return room.isMaster && room.team !== null && room.seats.length >= minPlayers;
}
