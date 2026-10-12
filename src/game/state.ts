/** A player or a team: the rules are the same. */
export interface Team {
  name: string;
  score: number;
}

/**
 * Network test (phase 2): players buzz, the TV shows who was first. The real
 * rounds replace this phase in phase 4.
 */
export type BuzzTestState = {
  phase: 'buzzTest';
  teams: Team[];
  /** First player to buzz, or null while buzzers are open. */
  buzzer: number | null;
};

export type GameState = { phase: 'setup' } | BuzzTestState;

export type GameAction =
  | { type: 'startGame'; teamNames: string[] }
  | { type: 'buzz'; team: number }
  | { type: 'resetBuzz' }
  | { type: 'newGame' };

export const INITIAL_STATE: GameState = { phase: 'setup' };
