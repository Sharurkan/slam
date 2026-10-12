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

/** Words in the grid of each round: round 1, then round 2. */
export const ROUND_WORD_COUNTS: readonly number[] = [10, 12];
export const FINAL_WORD_COUNT = 7;
/** Numbers shown to the finalist, each hiding a letter of the final grid. */
export const FINAL_LETTER_CHOICES = 8;

/** Every letter of the grids must be askable: enough questions per letter. */
export const MIN_QUESTIONS_PER_LETTER = 6;
export const MIN_QUESTIONS = 300;
