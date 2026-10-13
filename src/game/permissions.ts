import type { GameAction, GameState } from './state';

/**
 * With one phone per player: who may send an action. Null when no phone may,
 * because the TV sends it or because nobody can act at this moment.
 */
export type ActionOwner = { kind: 'master' } | { kind: 'team'; team: number };

export interface Actor {
  team: number;
  /** The first phone connected: it runs the game and plays for its own player. */
  isMaster: boolean;
}

/** Player who has the hand, or null when nobody has it. */
export function turnTeam(state: GameState): number | null {
  switch (state.phase) {
    case 'round': {
      const { step } = state;
      if (step.kind === 'question') return step.buzzer;
      return step.kind === 'lastChance' ? null : step.team;
    }
    case 'tiebreak':
      return state.buzzer;
    case 'final':
      return state.finalist;
    case 'setup':
    case 'roundOver':
    case 'gameOver':
      return null;
  }
}

export function actionOwner(state: GameState, action: GameAction): ActionOwner | null {
  switch (action.type) {
    case 'startGame':
    case 'skipQuestion':
    case 'revealGrid':
    case 'nextRound':
    case 'abandonGame':
    case 'newGame':
      return { kind: 'master' };
    case 'buzz':
      return { kind: 'team', team: action.team };
    case 'finalTick':
    case 'resumeFinal':
      return null;
    case 'submitLetter':
    case 'chooseWord':
    case 'submitWord':
    case 'cancelWord':
    case 'startSlam':
    case 'submitSlam':
    case 'pickFinalNumber':
    case 'selectFinalWord':
    case 'cancelFinalWord':
    case 'submitFinalWord': {
      const team = turnTeam(state);
      return team === null ? null : { kind: 'team', team };
    }
  }
}

/**
 * The master may play the turn of a player whose phone is disconnected, so that
 * the game is never stuck. It may never buzz for another player.
 */
export function canAct(
  state: GameState,
  action: GameAction,
  actor: Actor,
  isTeamConnected: (team: number) => boolean,
): boolean {
  const owner = actionOwner(state, action);
  if (owner === null) return false;
  if (owner.kind === 'master') return actor.isMaster;
  if (owner.team === actor.team) return true;
  return actor.isMaster && action.type !== 'buzz' && !isTeamConnected(owner.team);
}
