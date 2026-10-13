import { describe, expect, it } from 'vitest';
import { reduce } from './reducer';
import { INITIAL_STATE, type GameAction } from './state';
import { play, startedRound, testDeps } from './test-fixtures';

const deps = testDeps();

function start(action: Partial<Extract<GameAction, { type: 'startGame' }>> = {}) {
  return reduce(INITIAL_STATE, { type: 'startGame', teamNames: ['Alice', 'Bob'], ...action }, deps);
}

describe('startGame', () => {
  it('starts round 1 with every player', () => {
    const result = start();
    expect(result.state).toMatchObject({ phase: 'round', round: 1, players: [0, 1] });
    expect(result.events.slice(0, 2)).toEqual([
      { type: 'gameStarted' },
      { type: 'roundStarted', round: 1 },
    ]);
  });

  it('names players left blank and trims long names', () => {
    const result = start({ teamNames: ['  ', 'x'.repeat(30)] });
    if (result.state.phase !== 'round') throw new Error('Not started');
    expect(result.state.teams.map((team) => team.name)).toEqual(['Joueur 1', 'x'.repeat(20)]);
  });

  it.each([[['Solo']], [['A', 'B', 'C', 'D', 'E']]])('refuses %j players', (teamNames) => {
    expect(start({ teamNames }).events).toEqual([
      { type: 'actionRejected', reason: 'invalidTeamCount' },
    ]);
  });

  it('can start at round 2 or at the final, for testing', () => {
    expect(start({ firstRound: 2 }).state).toMatchObject({ phase: 'round', round: 2 });
    expect(start({ firstRound: 3 }).state).toMatchObject({ phase: 'final', finalist: 0 });
    expect(start({ firstRound: 4 }).events).toEqual([
      { type: 'actionRejected', reason: 'invalidRound' },
    ]);
  });

  it('can force a grid of the first stage, for testing', () => {
    expect(start({ firstRound: 3, gridId: 'f-animals' }).state).toMatchObject({ phase: 'final' });
    expect(start({ gridId: 'f-animals' }).events).toEqual([
      { type: 'actionRejected', reason: 'unknownGrid' },
    ]);
  });

  it('is refused once a game is running', () => {
    const state = startedRound();
    expect(reduce(state, { type: 'startGame', teamNames: ['A', 'B'] }, deps).state).toBe(state);
  });
});

describe('phase checks', () => {
  it.each<GameAction>([
    { type: 'buzz', team: 0 },
    { type: 'submitLetter', letter: 'A' },
    { type: 'chooseWord', word: 1 },
    { type: 'pickFinalNumber', index: 0 },
    { type: 'finalTick' },
    { type: 'nextRound' },
    { type: 'abandonGame' },
    { type: 'newGame' },
  ])('refuses %j before the game starts', (action) => {
    const result = reduce(INITIAL_STATE, action, deps);
    expect(result.state).toBe(INITIAL_STATE);
    expect(result.events).toEqual([{ type: 'actionRejected', reason: 'wrongPhase' }]);
  });

  it('refuses final actions during a round', () => {
    expect(reduce(startedRound(), { type: 'selectFinalWord', word: 1 }, deps).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});

describe('abandonGame', () => {
  it('ends the game at once, without a final', () => {
    const result = reduce(startedRound(), { type: 'abandonGame' }, deps);
    expect(result.state).toMatchObject({ phase: 'gameOver', final: null });
    expect(result.events).toEqual([{ type: 'gameOver' }]);
  });
});

describe('newGame', () => {
  it('goes back to the setup after the game', () => {
    const over = play(startedRound(), [{ type: 'abandonGame' }]);
    expect(reduce(over, { type: 'newGame' }, deps).state).toEqual(INITIAL_STATE);
  });

  it('is refused during a game', () => {
    expect(reduce(startedRound(), { type: 'newGame' }, deps).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});
