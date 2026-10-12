/** Small grids and questions for the tests of game/. Not used by the app. */
import type { GameContent, GameDeps } from './common';
import type { FinalGrid, Grid } from './grid';
import { reduce } from './reducer';
import {
  INITIAL_STATE,
  type GameAction,
  type GameState,
  type RoundState,
  type RoundStep,
} from './state';

/**
 * C H A T
 * H . . O
 * I . . U
 * E . . R
 * N . . .
 */
export const ANIMALS: Grid = {
  id: 'r1-animals',
  width: 4,
  height: 5,
  words: [
    { number: 1, row: 0, col: 0, direction: 'across', answer: 'CHAT', clue: 'Il miaule' },
    { number: 2, row: 0, col: 0, direction: 'down', answer: 'CHIEN', clue: 'Il aboie' },
    { number: 3, row: 0, col: 3, direction: 'down', answer: 'TOUR', clue: 'Celle de Pise penche' },
  ],
};

/**
 * L O U P
 * I . . I
 * O . . E
 * N . . .
 */
export const WILD: Grid = {
  id: 'r2-wild',
  width: 4,
  height: 4,
  words: [
    { number: 1, row: 0, col: 0, direction: 'across', answer: 'LOUP', clue: 'Il hurle' },
    { number: 2, row: 0, col: 0, direction: 'down', answer: 'LION', clue: 'Roi des animaux' },
    { number: 3, row: 0, col: 3, direction: 'down', answer: 'PIE', clue: 'Oiseau voleur' },
  ],
};

export const FINAL: FinalGrid = { ...ANIMALS, id: 'f-animals', theme: 'Animaux' };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const CONTENT: GameContent = {
  roundGrids: [[ANIMALS], [WILD]],
  finalGrids: [FINAL],
  questions: Object.fromEntries(
    Array.from(ALPHABET, (letter) => [
      letter,
      [`Première question ${letter} ?`, `Seconde question ${letter} ?`],
    ]),
  ),
};

/** Deps with random() always 0 (first choice everywhere) and a clock the test moves. */
export function testDeps(clock = { now: 0 }): GameDeps {
  return { random: () => 0, now: () => clock.now, content: CONTENT };
}

/** Applies actions one after the other and returns the last state. */
export function play(state: GameState, actions: GameAction[], deps = testDeps()): GameState {
  return actions.reduce((current, action) => reduce(current, action, deps).state, state);
}

export function startedRound(teamNames = ['Alice', 'Bob', 'Chloé'], firstRound = 1): RoundState {
  const state = play(INITIAL_STATE, [{ type: 'startGame', teamNames, firstRound }]);
  return asRound(state);
}

export function asRound(state: GameState): RoundState {
  if (state.phase !== 'round') throw new Error(`Expected a round, got ${state.phase}`);
  return state;
}

/** The round with an open question whose answer is the given letter. */
export function withQuestion(state: RoundState, letter: string): RoundState {
  const step: RoundStep = {
    kind: 'question',
    question: { letter, text: `Question ${letter} ?` },
    buzzer: null,
    eliminated: [],
  };
  return { ...state, step };
}
