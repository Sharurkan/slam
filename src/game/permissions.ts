import type { GameAction } from './state';

/** With one phone per player: who may send an action. */
export type ActionOwner = { kind: 'master' } | { kind: 'team'; team: number };

export interface Actor {
  team: number;
  /** The first phone connected: it runs the game and plays for its own player. */
  isMaster: boolean;
}

export function actionOwner(action: GameAction): ActionOwner {
  switch (action.type) {
    case 'startGame':
    case 'resetBuzz':
    case 'newGame':
      return { kind: 'master' };
    case 'buzz':
      return { kind: 'team', team: action.team };
  }
}

/**
 * The master may play the turn of a player whose phone is disconnected, so that
 * the game is never stuck. It may never buzz for another player.
 */
export function canAct(
  action: GameAction,
  actor: Actor,
  isTeamConnected: (team: number) => boolean,
): boolean {
  const owner = actionOwner(action);
  if (owner.kind === 'master') return actor.isMaster;
  if (owner.team === actor.team) return true;
  return actor.isMaster && action.type !== 'buzz' && !isTeamConnected(owner.team);
}
