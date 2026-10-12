/**
 * What happened, for sounds, animations and messages. Events reach the phones:
 * they never hold an answer that is still hidden.
 */
export type RejectionReason =
  | 'wrongPhase'
  | 'invalidTeamCount'
  | 'invalidTeam'
  | 'notPlaying'
  | 'teamEliminated'
  | 'invalidLetter'
  | 'invalidWord'
  | 'wordNotPlayable'
  | 'invalidAnswer'
  | 'invalidNumber'
  | 'invalidRound'
  | 'unknownGrid';

export type GameEvent =
  | { type: 'gameStarted' }
  | { type: 'roundStarted'; round: number }
  | { type: 'questionAsked' }
  | { type: 'buzzed'; team: number }
  | { type: 'letterFound'; team: number; letter: string }
  | { type: 'wrongLetter'; team: number; letter: string }
  /** Nobody found it: the letter is announced, not shown in the grid. */
  | { type: 'letterLost'; letter: string }
  /** The letter only completed words: the hand goes back to the questions. */
  | { type: 'noWordToPlay'; team: number }
  | { type: 'wordChosen'; team: number; word: number }
  | { type: 'wordFound'; team: number; word: number; points: number }
  | { type: 'wrongWord'; team: number; word: number; answer: string }
  | { type: 'lastChance' }
  | { type: 'slamStarted'; team: number }
  | { type: 'slamWon'; team: number; points: number }
  | { type: 'slamFailed'; team: number; points: number }
  | { type: 'gridCorrected' }
  | { type: 'roundOver'; round: number }
  | { type: 'tiebreakStarted'; contenders: number[]; spots: number }
  | { type: 'tiebreakWon'; team: number }
  | { type: 'qualified'; teams: number[] }
  | { type: 'finalStarted'; finalist: number }
  | { type: 'finalNumberPicked'; index: number }
  | { type: 'finalLettersRevealed'; letters: string[] }
  | { type: 'finalWordFound'; word: number }
  | { type: 'finalWrongWord'; word: number; answer: string }
  | { type: 'finalWordPassed'; word: number }
  | { type: 'finalOver'; wordsFound: number; prize: number; complete: boolean }
  | { type: 'gameOver' }
  | { type: 'actionRejected'; reason: RejectionReason };
