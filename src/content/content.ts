import type { FinalGrid, Grid } from '../game/grid';
import { FINAL_GRIDS } from './grids/final';
import { ROUND_1_GRIDS } from './grids/round1';
import { ROUND_2_GRIDS } from './grids/round2';
import { QUESTIONS } from './questions';
import type { QuestionBank } from './validate';

/** Everything the game draws from. The game receives it, so tests can give their own. */
export interface GameContent {
  /** Grids of each round: index 0 for round 1, index 1 for round 2. */
  roundGrids: readonly (readonly Grid[])[];
  finalGrids: readonly FinalGrid[];
  questions: QuestionBank;
}

export const CONTENT: GameContent = {
  roundGrids: [ROUND_1_GRIDS, ROUND_2_GRIDS],
  finalGrids: FINAL_GRIDS,
  questions: QUESTIONS,
};
