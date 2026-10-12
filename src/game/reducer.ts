import { DEFAULT_TEAM_NAME_PREFIX, MAX_TEAM_NAME_LENGTH, MAX_TEAMS, MIN_TEAMS } from './config';
import type { GameEvent, RejectionReason } from './events';
import type { GameAction, GameState } from './state';

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

function reject(state: GameState, reason: RejectionReason): ReduceResult {
  return { state, events: [{ type: 'actionRejected', reason }] };
}

export function reduce(state: GameState, action: GameAction): ReduceResult {
  switch (action.type) {
    case 'startGame':
      return startGame(state, action.teamNames);
    case 'buzz':
      return buzz(state, action.team);
    case 'resetBuzz':
      return resetBuzz(state);
    case 'newGame':
      return newGame(state);
  }
}

export function teamName(input: string, index: number): string {
  const trimmed = input.trim().slice(0, MAX_TEAM_NAME_LENGTH);
  return trimmed === '' ? `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}` : trimmed;
}

function startGame(state: GameState, teamNames: string[]): ReduceResult {
  if (state.phase !== 'setup') return reject(state, 'wrongPhase');
  if (teamNames.length < MIN_TEAMS || teamNames.length > MAX_TEAMS) {
    return reject(state, 'invalidTeamCount');
  }
  const teams = teamNames.map((name, index) => ({ name: teamName(name, index), score: 0 }));
  return { state: { phase: 'buzzTest', teams, buzzer: null }, events: [{ type: 'gameStarted' }] };
}

/** Only the first buzz counts: later ones are refused until the buzzers are reset. */
function buzz(state: GameState, team: number): ReduceResult {
  if (state.phase !== 'buzzTest' || state.buzzer !== null) return reject(state, 'wrongPhase');
  if (!Number.isInteger(team) || team < 0 || team >= state.teams.length) {
    return reject(state, 'invalidTeam');
  }
  return { state: { ...state, buzzer: team }, events: [{ type: 'buzzed', team }] };
}

function resetBuzz(state: GameState): ReduceResult {
  if (state.phase !== 'buzzTest') return reject(state, 'wrongPhase');
  return { state: { ...state, buzzer: null }, events: [{ type: 'buzzReset' }] };
}

function newGame(state: GameState): ReduceResult {
  if (state.phase === 'setup') return reject(state, 'wrongPhase');
  return { state: { phase: 'setup' }, events: [] };
}
