import { describe, expect, it } from 'vitest';
import { findWord, incompleteWords, playableWords } from '../game/board';
import type { GameDeps } from '../game/common';
import { reduce } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import { CONTENT } from './content';

const MAX_ACTIONS = 2000;

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/**
 * A simple player: buzzes, sometimes gives a wrong letter or word, sometimes
 * slams, so that every path of the rules runs on the real grids and questions.
 */
function botAction(state: GameState, random: () => number): GameAction {
  switch (state.phase) {
    case 'setup':
      return { type: 'startGame', teamNames: ['Alice', 'Bob', 'Chloé'] };
    case 'roundOver':
      return { type: 'nextRound' };
    case 'gameOver':
      throw new Error('The game is over');
    case 'tiebreak':
      if (state.buzzer === null) return { type: 'buzz', team: state.contenders[0] ?? 0 };
      return { type: 'submitLetter', letter: state.question.letter };
    case 'final': {
      if (state.step.kind === 'picking') {
        return { type: 'pickFinalNumber', index: state.picked.length };
      }
      const { selected } = state.step;
      const word = selected === null ? undefined : findWord(state.board, selected);
      if (word === undefined || random() < 0.2) {
        const open = incompleteWords(state.board);
        const next = open[Math.floor(random() * open.length)];
        return { type: 'selectFinalWord', word: next?.number ?? 0 };
      }
      return { type: 'submitFinalWord', answer: random() < 0.8 ? word.answer : 'faux' };
    }
    case 'round': {
      const { step, board } = state;
      switch (step.kind) {
        case 'question': {
          if (step.buzzer !== null) {
            return { type: 'submitLetter', letter: random() < 0.7 ? step.question.letter : 'Q' };
          }
          const free = state.players.filter((player) => !step.eliminated.includes(player));
          if (random() < 0.1) return { type: 'skipQuestion' };
          return { type: 'buzz', team: free[Math.floor(random() * free.length)] ?? 0 };
        }
        case 'choosingWord': {
          if (random() < 0.05) return { type: 'startSlam' };
          const word = playableWords(board, step.letter)[0];
          return { type: 'chooseWord', word: word?.number ?? 1 };
        }
        case 'answeringWord': {
          const word = findWord(board, step.word);
          return { type: 'submitWord', answer: random() < 0.6 ? (word?.answer ?? '') : 'faux' };
        }
        case 'lastChance':
          return { type: 'buzz', team: state.players[0] ?? 0 };
        case 'slam': {
          const right = random() < 0.5;
          const answers = incompleteWords(board).map((word) => ({
            word: word.number,
            answer: right ? word.answer : 'faux',
          }));
          return { type: 'submitSlam', answers };
        }
      }
    }
  }
}

function playWholeGame(seed: number): { state: GameState; actions: number } {
  const random = seeded(seed);
  const clock = { now: 0 };
  const deps: GameDeps = { random, now: () => clock.now, content: CONTENT };
  let state: GameState = INITIAL_STATE;
  for (let actions = 0; actions < MAX_ACTIONS; actions += 1) {
    if (state.phase === 'gameOver') return { state, actions };
    const result = reduce(state, botAction(state, random), deps);
    const rejected = result.events.find((event) => event.type === 'actionRejected');
    if (rejected !== undefined)
      throw new Error(`Rejected in ${state.phase}: ${JSON.stringify(rejected)}`);
    state = result.state;
    clock.now += 1000;
  }
  throw new Error('The game never ended');
}

describe('a whole game on the real content', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('ends with a final result (seed %i)', (seed) => {
    const { state } = playWholeGame(seed);
    expect(state.phase).toBe('gameOver');
    if (state.phase !== 'gameOver') return;
    expect(state.final).not.toBeNull();
    expect(state.final?.prize).toBeGreaterThanOrEqual(0);
  });
});
