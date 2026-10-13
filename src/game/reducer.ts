import { progressOf, reject, type GameDeps, type ReduceResult } from './common';
import {
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  ROUND_COUNT,
  DEFAULT_TEAM_NAME_PREFIX,
} from './config';
import {
  cancelFinalWord,
  finalTick,
  pickFinalNumber,
  resumeFinal,
  selectFinalWord,
  startFinal,
  submitFinalWord,
} from './final';
import { nextRound, tiebreakBuzz, tiebreakLetter, tiebreakSkip } from './qualification';
import {
  buzzRound,
  cancelWord,
  chooseWord,
  revealGrid,
  skipQuestion,
  startRound,
  startSlam,
  submitLetter,
  submitSlam,
  submitWord,
} from './round';
import type { FinalState, GameAction, GameState, RoundState } from './state';

export type { GameDeps, ReduceResult } from './common';

export function teamName(input: string, index: number): string {
  const trimmed = input.trim().slice(0, MAX_TEAM_NAME_LENGTH);
  return trimmed === '' ? `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}` : trimmed;
}

type StartGame = Extract<GameAction, { type: 'startGame' }>;

function startGame(state: GameState, action: StartGame, deps: GameDeps): ReduceResult {
  if (state.phase !== 'setup') return reject(state, 'wrongPhase');
  const { teamNames, firstRound = 1, gridId } = action;
  if (teamNames.length < MIN_TEAMS || teamNames.length > MAX_TEAMS)
    return reject(state, 'invalidTeamCount');
  if (!Number.isInteger(firstRound) || firstRound < 1 || firstRound > ROUND_COUNT + 1) {
    return reject(state, 'invalidRound');
  }
  const atFinal = firstRound > ROUND_COUNT;
  const grids = atFinal ? deps.content.finalGrids : (deps.content.roundGrids[firstRound - 1] ?? []);
  if (gridId !== undefined && !grids.some((grid) => grid.id === gridId))
    return reject(state, 'unknownGrid');
  const progress = {
    teams: teamNames.map((name, index) => ({ name: teamName(name, index), scores: [] })),
    usedGrids: [],
    usedQuestions: [],
  };
  const players = progress.teams.map((_, index) => index);
  const started = atFinal
    ? startFinal(progress, 0, deps, gridId)
    : startRound(progress, firstRound, players, deps, gridId);
  return { state: started.state, events: [{ type: 'gameStarted' }, ...started.events] };
}

function inRound(state: GameState, play: (round: RoundState) => ReduceResult): ReduceResult {
  return state.phase === 'round' ? play(state) : reject(state, 'wrongPhase');
}

function inFinal(state: GameState, play: (final: FinalState) => ReduceResult): ReduceResult {
  return state.phase === 'final' ? play(state) : reject(state, 'wrongPhase');
}

function buzz(state: GameState, team: number): ReduceResult {
  if (state.phase === 'round') return buzzRound(state, team);
  if (state.phase === 'tiebreak') return tiebreakBuzz(state, team);
  return reject(state, 'wrongPhase');
}

function letter(state: GameState, input: string, deps: GameDeps): ReduceResult {
  if (state.phase === 'round') return submitLetter(state, input, deps);
  if (state.phase === 'tiebreak') return tiebreakLetter(state, input, deps);
  return reject(state, 'wrongPhase');
}

function skip(state: GameState, deps: GameDeps): ReduceResult {
  if (state.phase === 'round') return skipQuestion(state, deps);
  if (state.phase === 'tiebreak') return tiebreakSkip(state, deps);
  return reject(state, 'wrongPhase');
}

/** The ranking is shown at once; scores of the round being played still count. */
function abandonGame(state: GameState): ReduceResult {
  if (state.phase === 'setup' || state.phase === 'gameOver') return reject(state, 'wrongPhase');
  return {
    state: { phase: 'gameOver', teams: progressOf(state).teams, final: null },
    events: [{ type: 'gameOver' }],
  };
}

export function reduce(state: GameState, action: GameAction, deps: GameDeps): ReduceResult {
  switch (action.type) {
    case 'startGame':
      return startGame(state, action, deps);
    case 'buzz':
      return buzz(state, action.team);
    case 'submitLetter':
      return letter(state, action.letter, deps);
    case 'skipQuestion':
      return skip(state, deps);
    case 'chooseWord':
      return inRound(state, (round) => chooseWord(round, action.word));
    case 'submitWord':
      return inRound(state, (round) => submitWord(round, action.answer, deps));
    case 'cancelWord':
      return inRound(state, cancelWord);
    case 'startSlam':
      return inRound(state, startSlam);
    case 'submitSlam':
      return inRound(state, (round) => submitSlam(round, action.answers));
    case 'revealGrid':
      return inRound(state, revealGrid);
    case 'nextRound':
      return state.phase === 'roundOver' ? nextRound(state, deps) : reject(state, 'wrongPhase');
    case 'pickFinalNumber':
      return inFinal(state, (final) => pickFinalNumber(final, action.index, deps));
    case 'submitFinalWord':
      return inFinal(state, (final) => submitFinalWord(final, action.answer, deps));
    case 'selectFinalWord':
      return inFinal(state, (final) => selectFinalWord(final, action.word, deps));
    case 'cancelFinalWord':
      return inFinal(state, (final) => cancelFinalWord(final, deps));
    case 'finalTick':
      return inFinal(state, (final) => finalTick(final, deps));
    case 'resumeFinal':
      return inFinal(state, (final) => resumeFinal(final, deps));
    case 'abandonGame':
      return abandonGame(state);
    case 'newGame':
      return state.phase === 'gameOver'
        ? { state: { phase: 'setup' }, events: [] }
        : reject(state, 'wrongPhase');
  }
}
