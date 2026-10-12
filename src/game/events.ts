export type RejectionReason = 'wrongPhase' | 'invalidTeamCount' | 'invalidTeam';

export type GameEvent =
  | { type: 'gameStarted' }
  | { type: 'buzzed'; team: number }
  | { type: 'buzzReset' }
  | { type: 'actionRejected'; reason: RejectionReason };
