import { describe, expect, it } from 'vitest';
import { reduce } from './reducer';
import { INITIAL_STATE, type GameState } from './state';

function started(names: string[] = ['Alice', 'Bob', 'Chloé']): GameState {
  return reduce(INITIAL_STATE, { type: 'startGame', teamNames: names }).state;
}

describe('startGame', () => {
  it('creates the players with a score of 0', () => {
    expect(started(['Alice', 'Bob'])).toEqual({
      phase: 'buzzTest',
      teams: [
        { name: 'Alice', score: 0 },
        { name: 'Bob', score: 0 },
      ],
      buzzer: null,
    });
  });

  it('names players left blank and trims long names', () => {
    const state = started(['  ', 'x'.repeat(30)]);
    if (state.phase !== 'buzzTest') throw new Error('Not started');
    expect(state.teams.map((team) => team.name)).toEqual(['Joueur 1', 'x'.repeat(20)]);
  });

  it.each([[['Solo']], [['A', 'B', 'C', 'D', 'E']]])('refuses %j players', (names) => {
    const result = reduce(INITIAL_STATE, { type: 'startGame', teamNames: names });
    expect(result.state).toBe(INITIAL_STATE);
    expect(result.events).toEqual([{ type: 'actionRejected', reason: 'invalidTeamCount' }]);
  });

  it('is refused once a game is running', () => {
    const state = started();
    expect(reduce(state, { type: 'startGame', teamNames: ['A', 'B'] }).state).toBe(state);
  });
});

describe('buzz', () => {
  it('gives the hand to the first player who buzzes', () => {
    const result = reduce(started(), { type: 'buzz', team: 1 });
    expect(result.state).toMatchObject({ buzzer: 1 });
    expect(result.events).toEqual([{ type: 'buzzed', team: 1 }]);
  });

  it('ignores later buzzes', () => {
    const first = reduce(started(), { type: 'buzz', team: 1 }).state;
    const second = reduce(first, { type: 'buzz', team: 2 });
    expect(second.state).toBe(first);
    expect(second.events).toEqual([{ type: 'actionRejected', reason: 'wrongPhase' }]);
  });

  it.each([-1, 3, 1.5])('refuses the unknown player %d', (team) => {
    const state = started();
    expect(reduce(state, { type: 'buzz', team }).events).toEqual([
      { type: 'actionRejected', reason: 'invalidTeam' },
    ]);
  });

  it('is refused before the game starts', () => {
    expect(reduce(INITIAL_STATE, { type: 'buzz', team: 0 }).state).toBe(INITIAL_STATE);
  });
});

describe('resetBuzz', () => {
  it('opens the buzzers again', () => {
    const buzzed = reduce(started(), { type: 'buzz', team: 0 }).state;
    const result = reduce(buzzed, { type: 'resetBuzz' });
    expect(result.state).toMatchObject({ buzzer: null });
    expect(result.events).toEqual([{ type: 'buzzReset' }]);
  });
});

describe('newGame', () => {
  it('goes back to the setup', () => {
    expect(reduce(started(), { type: 'newGame' }).state).toEqual(INITIAL_STATE);
  });

  it('is refused during the setup', () => {
    expect(reduce(INITIAL_STATE, { type: 'newGame' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});
