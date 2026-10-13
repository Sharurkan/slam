import type { Board } from './board';
import type { FinalGrid } from './grid';

/** A player or a team: the rules are the same. */
export interface Team {
  name: string;
  /** One score per round played: index 0 for round 1. Round 2 starts again at 0. */
  scores: number[];
}

export interface Question {
  /** The answer: never sent to the phones while the question is open. */
  letter: string;
  text: string;
  /** The word the letter comes from: never sent while the question is open. */
  answer?: string | undefined;
}

/** Everything that lasts the whole game. */
export interface Progress {
  teams: Team[];
  /** Grid ids already played, so that no grid comes back. */
  usedGrids: string[];
  /** Questions already asked, as "letter:index", so that none comes back. */
  usedQuestions: string[];
  /** False when the master chose a final without timer: the master then ends it. */
  timedFinal: boolean;
}

export type RoundStep =
  /** Players buzz; the buzzer, if any, types the letter. */
  | { kind: 'question'; question: Question; buzzer: number | null; eliminated: number[] }
  /** Right letter: the player picks a word holding it, or slams. */
  | { kind: 'choosingWord'; team: number; letter: string }
  /** The clue is shown: the player proposes the word, or slams. */
  | { kind: 'answeringWord'; team: number; letter: string; word: number }
  /** No letter left to ask: the first buzz slams. */
  | { kind: 'lastChance' }
  /** The player fills every remaining word, without clues. */
  | { kind: 'slam'; team: number };

export type RoundState = Progress & {
  phase: 'round';
  round: number;
  /** Players still in the game, by team index. */
  players: number[];
  board: Board;
  step: RoundStep;
};

/** How the grid was finished: words found, SLAM, failed SLAM or corrected by the master. */
export type RoundOutcome = 'complete' | 'slam' | 'slamFailed' | 'corrected';

export type RoundOverState = Progress & {
  phase: 'roundOver';
  round: number;
  players: number[];
  board: Board;
  outcome: RoundOutcome;
};

/** One-letter questions between tied players, outside the grid. */
export type TiebreakState = Progress & {
  phase: 'tiebreak';
  /** The round whose ranking is being decided. */
  round: number;
  /** Players already sure to go on. */
  qualified: number[];
  contenders: number[];
  /** Places left for the contenders. */
  spots: number;
  question: Question;
  buzzer: number | null;
  eliminated: number[];
};

export type FinalStep =
  | { kind: 'picking' }
  /**
   * selected: word the finalist is typing, highlighted on the TV (null while choosing).
   * remainingMs is updated at each tick, null without timer; lastTickAt is when it was.
   */
  | { kind: 'playing'; selected: number | null; remainingMs: number | null; lastTickAt: number };

export type FinalState = Progress & {
  phase: 'final';
  finalist: number;
  board: Board<FinalGrid>;
  /** Letters hidden behind the numbers: never sent to the phones before they are picked. */
  letters: string[];
  /** Numbers picked, as indexes in letters. */
  picked: number[];
  step: FinalStep;
};

export interface FinalResult {
  finalist: number;
  board: Board<FinalGrid>;
  wordsFound: number;
  prize: number;
  complete: boolean;
}

export type GameOverState = {
  phase: 'gameOver';
  teams: Team[];
  /** Null when the game was abandoned before the final. */
  final: FinalResult | null;
};

export type GameState =
  { phase: 'setup' } | RoundState | RoundOverState | TiebreakState | FinalState | GameOverState;

export interface WordAnswer {
  word: number;
  answer: string;
}

export type GameAction =
  /** firstRound and gridId are test shortcuts: ROUND_COUNT + 1 starts at the final. */
  | {
      type: 'startGame';
      teamNames: string[];
      firstRound?: number | undefined;
      gridId?: string | undefined;
      /** True when omitted. */
      timedFinal?: boolean | undefined;
    }
  | { type: 'buzz'; team: number }
  | { type: 'submitLetter'; letter: string }
  /** "Personne ne sait": the letter is lost. */
  | { type: 'skipQuestion' }
  | { type: 'chooseWord'; word: number }
  | { type: 'submitWord'; answer: string }
  /** Back to the choice of word. */
  | { type: 'cancelWord' }
  | { type: 'startSlam' }
  | { type: 'submitSlam'; answers: WordAnswer[] }
  /** "Corriger la grille": shows the remaining words, nobody scores. */
  | { type: 'revealGrid' }
  | { type: 'nextRound' }
  | { type: 'pickFinalNumber'; index: number }
  /** Any word not found yet, in any order. */
  | { type: 'selectFinalWord'; word: number }
  /** Back to the list of words. */
  | { type: 'cancelFinalWord' }
  | { type: 'submitFinalWord'; answer: string }
  /** Sent by the TV every second during the final. */
  | { type: 'finalTick' }
  /** Sent by the TV after a reload: the final timer goes on from where it stopped. */
  | { type: 'resumeFinal' }
  /** Ends a final without timer, as if the time were up. */
  | { type: 'stopFinal' }
  | { type: 'abandonGame' }
  | { type: 'newGame' };

export const INITIAL_STATE: GameState = { phase: 'setup' };
