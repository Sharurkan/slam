import { describe, expect, it } from 'vitest';
import { canAct } from './permissions';
import type { GameAction } from './state';

const master = { team: 0, isMaster: true };
const player = { team: 1, isMaster: false };
const allConnected = (): boolean => true;
const noneConnected = (): boolean => false;

describe('canAct', () => {
  it('lets only the master run the game', () => {
    const start: GameAction = { type: 'startGame', teamNames: ['A', 'B'] };
    expect(canAct(start, master, allConnected)).toBe(true);
    expect(canAct(start, player, allConnected)).toBe(false);
    expect(canAct({ type: 'resetBuzz' }, player, allConnected)).toBe(false);
  });

  it('lets each player buzz for themselves only', () => {
    expect(canAct({ type: 'buzz', team: 1 }, player, allConnected)).toBe(true);
    expect(canAct({ type: 'buzz', team: 2 }, player, allConnected)).toBe(false);
  });

  it('never lets the master buzz for someone else, even disconnected', () => {
    expect(canAct({ type: 'buzz', team: 1 }, master, noneConnected)).toBe(false);
  });
});
