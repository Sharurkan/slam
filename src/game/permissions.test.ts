import { describe, expect, it } from 'vitest';
import { canAct, turnTeam } from './permissions';
import { INITIAL_STATE, type GameAction, type RoundState } from './state';
import { play, startedRound, withQuestion } from './test-fixtures';

const master = { team: 0, isMaster: true };
const bob = { team: 1, isMaster: false };
const chloe = { team: 2, isMaster: false };
const allConnected = (): boolean => true;
const noneConnected = (): boolean => false;

/** Bob found the letter T and has the hand. */
function bobHasTheHand(): RoundState {
  const state = play(withQuestion(startedRound(), 'T'), [
    { type: 'buzz', team: 1 },
    { type: 'submitLetter', letter: 'T' },
  ]);
  if (state.phase !== 'round') throw new Error('Expected a round');
  return state;
}

describe('turnTeam', () => {
  it('is the buzzer, then the player with the hand', () => {
    const question = startedRound();
    expect(turnTeam(question)).toBeNull();
    expect(turnTeam(play(question, [{ type: 'buzz', team: 2 }]))).toBe(2);
    expect(turnTeam(bobHasTheHand())).toBe(1);
    expect(turnTeam(INITIAL_STATE)).toBeNull();
  });
});

describe('canAct', () => {
  it('lets only the master run the game', () => {
    const state = startedRound();
    for (const action of [
      { type: 'skipQuestion' },
      { type: 'revealGrid' },
      { type: 'stopFinal' },
      { type: 'abandonGame' },
    ] as const) {
      expect(canAct(state, action, master, allConnected)).toBe(true);
      expect(canAct(state, action, bob, allConnected)).toBe(false);
    }
  });

  it('lets each player buzz for themselves only, even the master', () => {
    const state = startedRound();
    expect(canAct(state, { type: 'buzz', team: 1 }, bob, allConnected)).toBe(true);
    expect(canAct(state, { type: 'buzz', team: 2 }, bob, allConnected)).toBe(false);
    expect(canAct(state, { type: 'buzz', team: 1 }, master, noneConnected)).toBe(false);
  });

  it('lets only the player with the hand play', () => {
    const state = bobHasTheHand();
    const choose: GameAction = { type: 'chooseWord', word: 3 };
    expect(canAct(state, choose, bob, allConnected)).toBe(true);
    expect(canAct(state, choose, chloe, allConnected)).toBe(false);
    expect(canAct(state, { type: 'startSlam' }, chloe, allConnected)).toBe(false);
  });

  it('lets the master play for a disconnected player', () => {
    const state = bobHasTheHand();
    expect(canAct(state, { type: 'chooseWord', word: 3 }, master, allConnected)).toBe(false);
    expect(canAct(state, { type: 'chooseWord', word: 3 }, master, noneConnected)).toBe(true);
  });

  it('never lets a phone send the timer actions', () => {
    const state = startedRound();
    expect(canAct(state, { type: 'finalTick' }, master, allConnected)).toBe(false);
    expect(canAct(state, { type: 'resumeFinal' }, master, allConnected)).toBe(false);
  });
});
