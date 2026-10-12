import { describe, expect, it } from 'vitest';
import { SINGLE_PHONE_ROOM, type RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { canStartMultiGame, describeScreen } from './controls';

const setup: PublicView = { phase: 'setup', lastEvents: [] };
const over: PublicView = { phase: 'gameOver', teams: [], ranking: [], final: null, lastEvents: [] };
const noMode: RoomView = { mode: null, isMaster: true, team: null, seats: [] };
const multi: RoomView = {
  mode: 'multi',
  isMaster: false,
  team: 1,
  seats: [
    { name: 'Alice', connected: true },
    { name: 'Bob', connected: true },
  ],
};

describe('describeScreen', () => {
  it('lets only the master choose the mode', () => {
    expect(describeScreen(setup, noMode)).toEqual({ kind: 'chooseMode' });
    expect(describeScreen(setup, { ...noMode, isMaster: false })).toEqual({ kind: 'waitForMode' });
  });

  it('shows the setup of the chosen mode', () => {
    expect(describeScreen(setup, SINGLE_PHONE_ROOM)).toEqual({ kind: 'singleSetup' });
    expect(describeScreen(setup, multi)).toEqual({ kind: 'multiLobby' });
  });

  it('shows the game screen once the game started', () => {
    expect(describeScreen(over, multi)).toEqual({ kind: 'inGame', over: true });
  });
});

describe('canStartMultiGame', () => {
  const master: RoomView = { ...multi, isMaster: true, team: 0 };

  it('needs the master, seated, with enough players', () => {
    expect(canStartMultiGame(master, 2)).toBe(true);
    expect(canStartMultiGame(multi, 2)).toBe(false);
    expect(canStartMultiGame({ ...master, team: null }, 2)).toBe(false);
    expect(canStartMultiGame(master, 3)).toBe(false);
  });
});
