import {
  drawQuestion,
  letterFound,
  letterLost,
  progressOf,
  reject,
  roundScore,
  type GameDeps,
  type ReduceResult,
} from './common';
import { QUALIFIED_PER_ROUND, ROUND_COUNT } from './config';
import type { GameEvent } from './events';
import { startFinal } from './final';
import { startRound } from './round';
import type { Progress, RoundOverState, Team, TiebreakState } from './state';
import { normalizeLetter } from './text-input';

export interface Qualification {
  /** Sure to go on. */
  qualified: number[];
  /** Tied for the last places: a tiebreak decides. Empty when all is decided. */
  contenders: number[];
  spots: number;
}

/** Best round scores go on. A tie for the last place sends the tied players to a tiebreak. */
export function qualify(
  teams: Team[],
  players: number[],
  round: number,
  spots: number,
): Qualification {
  if (players.length <= spots) return { qualified: [...players], contenders: [], spots: 0 };
  const score = (player: number): number => roundScore(teams[player], round);
  const ranked = [...players].sort((a, b) => score(b) - score(a));
  const limit = score(ranked[spots - 1] ?? -1);
  if (score(ranked[spots] ?? -1) < limit) {
    return { qualified: ranked.slice(0, spots).sort((a, b) => a - b), contenders: [], spots: 0 };
  }
  const qualified = ranked.filter((player) => score(player) > limit).sort((a, b) => a - b);
  const contenders = ranked.filter((player) => score(player) === limit).sort((a, b) => a - b);
  return { qualified, contenders, spots: spots - qualified.length };
}

/** Round 2 with the qualified players, or the final with the only one left. */
function goOn(
  progress: Progress,
  round: number,
  qualified: number[],
  deps: GameDeps,
  events: GameEvent[],
) {
  const players = [...qualified].sort((a, b) => a - b);
  const next =
    round < ROUND_COUNT
      ? startRound(progress, round + 1, players, deps)
      : startFinal(progress, players[0] ?? 0, deps);
  return {
    state: next.state,
    events: [...events, { type: 'qualified', teams: players }, ...next.events],
  } satisfies ReduceResult;
}

function askTiebreak(
  state: Omit<TiebreakState, 'question'> & Progress,
  events: GameEvent[],
  deps: GameDeps,
): ReduceResult {
  const drawn = drawQuestion(Object.keys(deps.content.questions), state, deps);
  return {
    state: { ...state, ...drawn.progress, question: drawn.question, buzzer: null, eliminated: [] },
    events: [...events, { type: 'questionAsked' }],
  };
}

/** Sent by the master once the round results are read. */
export function nextRound(state: RoundOverState, deps: GameDeps): ReduceResult {
  const spots = QUALIFIED_PER_ROUND[state.round - 1] ?? 1;
  const result = qualify(state.teams, state.players, state.round, spots);
  const progress = progressOf(state);
  if (result.contenders.length === 0)
    return goOn(progress, state.round, result.qualified, deps, []);
  const tiebreak = {
    ...progress,
    phase: 'tiebreak' as const,
    round: state.round,
    qualified: result.qualified,
    contenders: result.contenders,
    spots: result.spots,
    buzzer: null,
    eliminated: [],
  };
  const started: GameEvent = {
    type: 'tiebreakStarted',
    contenders: result.contenders,
    spots: result.spots,
  };
  return askTiebreak(tiebreak, [started], deps);
}

export function tiebreakBuzz(state: TiebreakState, team: number): ReduceResult {
  if (!state.contenders.includes(team)) return reject(state, 'notPlaying');
  if (state.buzzer !== null) return reject(state, 'wrongPhase');
  if (state.eliminated.includes(team)) return reject(state, 'teamEliminated');
  return { state: { ...state, buzzer: team }, events: [{ type: 'buzzed', team }] };
}

/** First right letter wins a place. When places and contenders match, all of them go on. */
export function tiebreakLetter(state: TiebreakState, input: string, deps: GameDeps): ReduceResult {
  const team = state.buzzer;
  if (team === null) return reject(state, 'wrongPhase');
  const letter = normalizeLetter(input);
  if (letter === null) return reject(state, 'invalidLetter');
  if (letter !== state.question.letter) {
    const eliminated = [...state.eliminated, team];
    const wrong: GameEvent = { type: 'wrongLetter', team, letter };
    if (state.contenders.every((contender) => eliminated.includes(contender))) {
      return askTiebreak(state, [wrong, letterLost(state.question)], deps);
    }
    return { state: { ...state, buzzer: null, eliminated }, events: [wrong] };
  }
  const qualified = [...state.qualified, team];
  const contenders = state.contenders.filter((contender) => contender !== team);
  const spots = state.spots - 1;
  const events: GameEvent[] = [letterFound(team, state.question), { type: 'tiebreakWon', team }];
  if (spots === 0) return goOn(progressOf(state), state.round, qualified, deps, events);
  if (contenders.length <= spots) {
    return goOn(progressOf(state), state.round, [...qualified, ...contenders], deps, events);
  }
  return askTiebreak({ ...state, qualified, contenders, spots }, events, deps);
}

/** "Personne ne sait": another question. */
export function tiebreakSkip(state: TiebreakState, deps: GameDeps): ReduceResult {
  if (state.buzzer !== null) return reject(state, 'wrongPhase');
  return askTiebreak(state, [letterLost(state.question)], deps);
}
