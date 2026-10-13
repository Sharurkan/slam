import * as z from 'zod/mini';
import type { Board } from '../game/board';
import {
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  ROUND_COUNT,
} from '../game/config';
import type { FinalGrid, Grid } from '../game/grid';
import type { GameState } from '../game/state';

const GAME_KEY = 'slam.game';
/** Bump when the saved shape changes: older saves are then dropped instead of misread. */
const SAVE_VERSION = 3;

const MAX_WORDS = 30;
const MAX_TEXT = 300;
const MAX_CELLS = MAX_GRID_WIDTH * MAX_GRID_HEIGHT;
/** Grid ids and question keys of a whole game: generous, but bounded. */
const MAX_USED = 2000;

const count = z.int().check(z.minimum(0));
const letter = z.string().check(z.regex(/^[A-Z]$/));
const letters = z.array(letter).check(z.maxLength(26));
const text = z.string().check(z.maxLength(MAX_TEXT));
const teamList = z.array(count).check(z.maxLength(MAX_TEAMS));

/** Grids are saved whole: a grid corrected by hand later does not break a saved game. */
const gridShape = {
  id: z.string().check(z.minLength(1), z.maxLength(40)),
  width: z.int().check(z.minimum(1), z.maximum(MAX_GRID_WIDTH)),
  height: z.int().check(z.minimum(1), z.maximum(MAX_GRID_HEIGHT)),
  words: z
    .array(
      z.object({
        number: z.int().check(z.minimum(1)),
        row: count,
        col: count,
        direction: z.enum(['across', 'down']),
        answer: z.string().check(z.regex(/^[A-Z]{1,30}$/)),
        clue: text,
      }),
    )
    .check(z.minLength(1), z.maxLength(MAX_WORDS)),
};
const gridSchema: z.ZodMiniType<Grid> = z.object(gridShape);
const finalGridSchema: z.ZodMiniType<FinalGrid> = z.object({ ...gridShape, theme: text });

function boardOf<G extends Grid>(grid: z.ZodMiniType<G>): z.ZodMiniType<Board<G>> {
  return z.object({
    grid,
    revealed: z.array(z.string().check(z.regex(/^\d+,\d+$/))).check(z.maxLength(MAX_CELLS)),
    tried: z.array(count).check(z.maxLength(MAX_WORDS)),
    lost: letters,
  });
}

const progressShape = {
  teams: z
    .array(
      z.object({
        name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)),
        scores: z.array(z.int()).check(z.maxLength(ROUND_COUNT)),
      }),
    )
    .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS)),
  usedGrids: z.array(z.string().check(z.maxLength(40))).check(z.maxLength(MAX_USED)),
  usedQuestions: z.array(z.string().check(z.maxLength(10))).check(z.maxLength(MAX_USED)),
  timedFinal: z.boolean(),
};

const question = z.object({ letter, text, answer: z.optional(text) });
const round = z.int().check(z.minimum(1), z.maximum(ROUND_COUNT));

const roundStep = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('question'),
    question,
    buzzer: z.nullable(count),
    eliminated: teamList,
  }),
  z.object({ kind: z.literal('choosingWord'), team: count, letter }),
  z.object({ kind: z.literal('answeringWord'), team: count, letter, word: count }),
  z.object({ kind: z.literal('lastChance') }),
  z.object({ kind: z.literal('slam'), team: count }),
]);

const finalStep = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('picking') }),
  z.object({
    kind: z.literal('playing'),
    selected: z.nullable(count),
    remainingMs: z.nullable(z.number().check(z.minimum(0))),
    lastTickAt: z.number(),
  }),
]);

const finalResult = z.object({
  finalist: count,
  board: boardOf(finalGridSchema),
  wordsFound: count,
  prize: count,
  complete: z.boolean(),
});

/** Every team index must point at an existing team, or the views would break. */
function teamIndexes(state: GameState): number[] {
  switch (state.phase) {
    case 'setup':
      return [];
    case 'round': {
      const { step } = state;
      const inStep =
        step.kind === 'question'
          ? [...(step.buzzer === null ? [] : [step.buzzer]), ...step.eliminated]
          : step.kind === 'lastChance'
            ? []
            : [step.team];
      return [...state.players, ...inStep];
    }
    case 'roundOver':
      return state.players;
    case 'tiebreak':
      return [
        ...state.qualified,
        ...state.contenders,
        ...state.eliminated,
        ...(state.buzzer === null ? [] : [state.buzzer]),
      ];
    case 'final':
      return [state.finalist];
    case 'gameOver':
      return state.final === null ? [] : [state.final.finalist];
  }
}

const gameStateSchema: z.ZodMiniType<GameState> = z
  .union([
    z.object({ phase: z.literal('setup') }),
    z.object({
      phase: z.literal('round'),
      ...progressShape,
      round,
      players: teamList,
      board: boardOf(gridSchema),
      step: roundStep,
    }),
    z.object({
      phase: z.literal('roundOver'),
      ...progressShape,
      round,
      players: teamList,
      board: boardOf(gridSchema),
      outcome: z.enum(['complete', 'slam', 'slamFailed', 'corrected']),
    }),
    z.object({
      phase: z.literal('tiebreak'),
      ...progressShape,
      round,
      qualified: teamList,
      contenders: teamList,
      spots: count,
      question,
      buzzer: z.nullable(count),
      eliminated: teamList,
    }),
    z.object({
      phase: z.literal('final'),
      ...progressShape,
      finalist: count,
      board: boardOf(finalGridSchema),
      letters: letters,
      picked: z.array(count).check(z.maxLength(26)),
      step: finalStep,
    }),
    z.object({
      phase: z.literal('gameOver'),
      teams: progressShape.teams,
      final: z.nullable(finalResult),
    }),
  ])
  .check(
    z.refine((state) => {
      const teams = state.phase === 'setup' ? 0 : state.teams.length;
      return teamIndexes(state).every((team) => team < teams);
    }),
  );

const saveSchema = z.object({ v: z.literal(SAVE_VERSION), state: gameStateSchema });

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: GameState }
  /** Unreadable, from another version, or storage blocked: the game starts over. */
  | { kind: 'unreadable' };

export function loadGame(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(GAME_KEY);
  } catch {
    return { kind: 'unreadable' };
  }
  if (raw === null) return { kind: 'empty' };
  try {
    const parsed = saveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { kind: 'loaded', state: parsed.data.state } : { kind: 'unreadable' };
  } catch {
    return { kind: 'unreadable' };
  }
}

/** Returns false when the game could not be saved (storage blocked or full). */
export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ v: SAVE_VERSION, state }));
    return true;
  } catch {
    return false;
  }
}
