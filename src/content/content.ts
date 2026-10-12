import type { GameContent } from '../game/common';
import { FINAL_GRIDS } from './grids/final';
import { ROUND_1_GRIDS } from './grids/round1';
import { ROUND_2_GRIDS } from './grids/round2';
import { QUESTIONS } from './questions';

export const CONTENT: GameContent = {
  roundGrids: [ROUND_1_GRIDS, ROUND_2_GRIDS],
  finalGrids: FINAL_GRIDS,
  questions: QUESTIONS,
};
