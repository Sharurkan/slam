import { describe, expect, it } from 'vitest';
import { qualify } from './qualification';
import { reduce } from './reducer';
import type { GameAction, GameState, RoundOverState, Team, TiebreakState } from './state';
import { play, startedRound, testDeps } from './test-fixtures';

const deps = testDeps();

function teamsWith(...scores: number[][]): Team[] {
  return scores.map((roundScores, index) => ({
    name: `J${String(index + 1)}`,
    scores: roundScores,
  }));
}

/** Round 1 (or 2) just ended with these scores. */
function roundOver(round: number, ...scores: number[][]): RoundOverState {
  const names = scores.map((_, index) => `J${String(index + 1)}`);
  const state = play(startedRound(names, round), [{ type: 'revealGrid' }]);
  if (state.phase !== 'roundOver') throw new Error('Expected the end of the round');
  return { ...state, teams: teamsWith(...scores) };
}

function asTiebreak(state: GameState): TiebreakState {
  if (state.phase !== 'tiebreak') throw new Error(`Expected a tiebreak, got ${state.phase}`);
  return state;
}

describe('qualify', () => {
  it('keeps the best scores', () => {
    expect(qualify(teamsWith([10], [3], [8]), [0, 1, 2], 1, 2)).toEqual({
      qualified: [0, 2],
      contenders: [],
      spots: 0,
    });
  });

  it('keeps everyone when there are not more players than places', () => {
    expect(qualify(teamsWith([0], [0]), [0, 1], 1, 2).qualified).toEqual([0, 1]);
  });

  it('sends the players tied for the last place to a tiebreak', () => {
    expect(qualify(teamsWith([10], [5], [5], [3]), [0, 1, 2, 3], 1, 2)).toEqual({
      qualified: [0],
      contenders: [1, 2],
      spots: 1,
    });
    expect(qualify(teamsWith([5], [5], [5]), [0, 1, 2], 1, 2)).toEqual({
      qualified: [],
      contenders: [0, 1, 2],
      spots: 2,
    });
  });

  it('only counts the scores of the round', () => {
    expect(qualify(teamsWith([0, 4], [9, 2]), [0, 1], 2, 1).qualified).toEqual([0]);
  });
});

describe('next round', () => {
  it('starts round 2 with the 2 best players, back to 0 points', () => {
    const result = reduce(roundOver(1, [10], [3], [8]), { type: 'nextRound' }, deps);
    expect(result.state).toMatchObject({ phase: 'round', round: 2, players: [0, 2] });
    if (result.state.phase !== 'round') return;
    expect(result.state.teams.map((team) => team.scores)).toEqual([[10, 0], [3], [8, 0]]);
    expect(result.state.board.grid.id).toBe('r2-wild');
    expect(result.events.slice(0, 2)).toEqual([
      { type: 'qualified', teams: [0, 2] },
      { type: 'roundStarted', round: 2 },
    ]);
  });

  it('starts the final with the best player of round 2', () => {
    const result = reduce(roundOver(2, [0, 7], [0, 9]), { type: 'nextRound' }, deps);
    expect(result.state).toMatchObject({ phase: 'final', finalist: 1 });
    expect(result.events).toContainEqual({ type: 'finalStarted', finalist: 1 });
  });

  it('is refused during a round', () => {
    expect(reduce(startedRound(), { type: 'nextRound' }, deps).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});

describe('tiebreak', () => {
  const tied = (): TiebreakState => {
    const result = reduce(roundOver(1, [10], [5], [5]), { type: 'nextRound' }, deps);
    expect(result.events.slice(0, 2)).toEqual([
      { type: 'tiebreakStarted', contenders: [1, 2], spots: 1 },
      { type: 'questionAsked' },
    ]);
    return asTiebreak(result.state);
  };

  const then = (state: GameState, ...actions: GameAction[]): GameState =>
    play(state, actions, deps);

  it('asks a letter question to the tied players only', () => {
    const state = tied();
    expect(state).toMatchObject({ qualified: [0], contenders: [1, 2], spots: 1, buzzer: null });
    // The round already asked the first A question.
    expect(state.question.text).toBe('Seconde question A ?');
    expect(reduce(state, { type: 'buzz', team: 0 }, deps).events).toEqual([
      { type: 'actionRejected', reason: 'notPlaying' },
    ]);
  });

  it('sends the first right player on', () => {
    const result = reduce(
      then(tied(), { type: 'buzz', team: 2 }),
      { type: 'submitLetter', letter: 'a' },
      deps,
    );
    expect(result.state).toMatchObject({ phase: 'round', round: 2, players: [0, 2] });
    expect(result.events.slice(0, 3)).toEqual([
      { type: 'letterFound', team: 2, letter: 'A' },
      { type: 'tiebreakWon', team: 2 },
      { type: 'qualified', teams: [0, 2] },
    ]);
  });

  it('eliminates a wrong player; when all are wrong, asks another question', () => {
    const once = then(tied(), { type: 'buzz', team: 1 }, { type: 'submitLetter', letter: 'Z' });
    expect(asTiebreak(once)).toMatchObject({ eliminated: [1], buzzer: null });
    const result = reduce(
      then(once, { type: 'buzz', team: 2 }),
      { type: 'submitLetter', letter: 'Z' },
      deps,
    );
    expect(asTiebreak(result.state)).toMatchObject({ eliminated: [], buzzer: null });
    expect(result.events).toEqual([
      { type: 'wrongLetter', team: 2, letter: 'Z' },
      { type: 'letterLost', letter: 'A' },
      { type: 'questionAsked' },
    ]);
    expect(asTiebreak(result.state).question.text).toBe('Première question A ?');
  });

  it('asks another question when nobody knows', () => {
    const result = reduce(tied(), { type: 'skipQuestion' }, deps);
    expect(result.events).toEqual([{ type: 'letterLost', letter: 'A' }, { type: 'questionAsked' }]);
  });

  it('goes on until every place is taken', () => {
    const first = reduce(roundOver(1, [5], [5], [5]), { type: 'nextRound' }, deps).state;
    const second = then(first, { type: 'buzz', team: 1 }, { type: 'submitLetter', letter: 'A' });
    expect(asTiebreak(second)).toMatchObject({ qualified: [1], contenders: [0, 2], spots: 1 });
    const done = then(second, { type: 'buzz', team: 0 }, { type: 'submitLetter', letter: 'A' });
    expect(done).toMatchObject({ phase: 'round', round: 2, players: [0, 1] });
  });

  it('decides the finalist after round 2', () => {
    const tiedFinal = reduce(roundOver(2, [0, 6], [0, 6]), { type: 'nextRound' }, deps).state;
    const done = then(tiedFinal, { type: 'buzz', team: 1 }, { type: 'submitLetter', letter: 'A' });
    expect(done).toMatchObject({ phase: 'final', finalist: 1 });
  });
});
