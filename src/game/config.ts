/**
 * Every game setting lives here, never hard-coded elsewhere.
 * No imports: the offline grid script loads this file directly with Node.
 */

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;
export const MAX_TEAM_NAME_LENGTH = 20;
export const DEFAULT_TEAM_NAME_PREFIX = 'Joueur';

/** Largest grid that stays readable on the TV, in cells. */
export const MAX_GRID_WIDTH = 15;
export const MAX_GRID_HEIGHT = 11;
export const MIN_WORD_LENGTH = 3;

/** Grid rounds before the final. */
export const ROUND_COUNT = 2;
/** Words in the grid of each round: round 1, then round 2. */
export const ROUND_WORD_COUNTS: readonly number[] = [10, 12];
/** Players kept after each round: the best 2 play round 2, the best of round 2 plays the final. */
export const QUALIFIED_PER_ROUND: readonly number[] = [2, 1];
/** A found word earns this many points per letter. */
export const POINTS_PER_LETTER = 1;

export const FINAL_WORD_COUNT = 7;
/** Numbers shown to the finalist, each hiding a letter of the final grid. */
export const FINAL_LETTER_CHOICES = 8;
/** Numbers the finalist picks among them. */
export const FINAL_LETTER_PICKS = 5;
export const FINAL_DURATION_MS = 60_000;
/** The TV counts the final time down at this pace. */
export const FINAL_TICK_MS = 1000;
/** Final winnings, in euros. */
export const FINAL_PRIZE_PER_WORD = 100;
export const FINAL_JACKPOT = 2000;

/** Longest word or answer a phone may send. */
export const MAX_ANSWER_LENGTH = 30;

/** Every letter of the grids must be askable: enough questions per letter. */
export const MIN_QUESTIONS_PER_LETTER = 6;
export const MIN_QUESTIONS = 300;

/** Longest answer word of a question, so that it fits the TV banner. */
export const MAX_QUESTION_ANSWER_LENGTH = 30;
