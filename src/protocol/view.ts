import * as z from 'zod/mini';
import { cellKey, wordCells, type Grid } from '../game/grid';
import {
  findWord,
  incompleteWords,
  isWordComplete,
  playableWords,
  type Board,
} from '../game/board';
import {
  FINAL_LETTER_CHOICES,
  MAX_ANSWER_LENGTH,
  MAX_QUESTION_ANSWER_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
} from '../game/config';
import type { GameEvent } from '../game/events';
import { rankTeams } from '../game/ranking';
import type {
  FinalState,
  GameOverState,
  GameState,
  RoundOverState,
  RoundState,
  RoundStep,
  Team,
  TiebreakState,
} from '../game/state';

const MAX_EVENTS = 20;
const MAX_CELLS = 200;
const MAX_WORDS = 30;
const MAX_TEXT = 200;

const index = z.int().check(z.minimum(0));
const teamIndex = index.check(z.maximum(MAX_TEAMS - 1));
const teamList = z.array(teamIndex).check(z.maxLength(MAX_TEAMS));
const letter = z.string().check(z.length(1));
const letters = z.array(letter).check(z.maxLength(26));
const text = z.string().check(z.maxLength(MAX_TEXT));
const typed = z.string().check(z.maxLength(MAX_ANSWER_LENGTH));
const answerWord = z.string().check(z.maxLength(MAX_QUESTION_ANSWER_LENGTH));
const direction = z.enum(['across', 'down']);

const gameEventSchema: z.ZodMiniType<GameEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gameStarted') }),
  z.object({ type: z.literal('roundStarted'), round: index }),
  z.object({ type: z.literal('questionAsked') }),
  z.object({ type: z.literal('buzzed'), team: teamIndex }),
  z.object({
    type: z.literal('letterFound'),
    team: teamIndex,
    letter,
    answer: z.optional(answerWord),
  }),
  z.object({ type: z.literal('wrongLetter'), team: teamIndex, letter }),
  z.object({ type: z.literal('letterLost'), letter, answer: z.optional(answerWord) }),
  z.object({ type: z.literal('noWordToPlay'), team: teamIndex }),
  z.object({ type: z.literal('wordChosen'), team: teamIndex, word: index }),
  z.object({ type: z.literal('wordFound'), team: teamIndex, word: index, points: index }),
  z.object({ type: z.literal('wrongWord'), team: teamIndex, word: index, answer: typed }),
  z.object({ type: z.literal('lastChance') }),
  z.object({ type: z.literal('slamStarted'), team: teamIndex }),
  z.object({ type: z.literal('slamWon'), team: teamIndex, points: index }),
  z.object({ type: z.literal('slamFailed'), team: teamIndex, points: index }),
  z.object({ type: z.literal('gridCorrected') }),
  z.object({ type: z.literal('roundOver'), round: index }),
  z.object({ type: z.literal('tiebreakStarted'), contenders: teamList, spots: index }),
  z.object({ type: z.literal('tiebreakWon'), team: teamIndex }),
  z.object({ type: z.literal('qualified'), teams: teamList }),
  z.object({ type: z.literal('finalStarted'), finalist: teamIndex }),
  z.object({ type: z.literal('finalNumberPicked'), index }),
  z.object({ type: z.literal('finalLettersRevealed'), letters }),
  z.object({ type: z.literal('finalWordFound'), word: index }),
  z.object({ type: z.literal('finalWrongWord'), word: index, answer: typed }),
  z.object({ type: z.literal('finalWordSelected'), word: index }),
  z.object({
    type: z.literal('finalOver'),
    wordsFound: index,
    prize: index,
    complete: z.boolean(),
    stopped: z.boolean(),
  }),
  z.object({ type: z.literal('gameOver') }),
  z.object({
    type: z.literal('actionRejected'),
    reason: z.enum([
      'wrongPhase',
      'invalidTeamCount',
      'invalidTeam',
      'notPlaying',
      'teamEliminated',
      'invalidLetter',
      'invalidWord',
      'wordNotPlayable',
      'invalidAnswer',
      'invalidNumber',
      'invalidRound',
      'unknownGrid',
    ]),
  }),
]);

const teamsSchema = z
  .array(
    z.object({
      name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)),
      scores: z.array(z.int()).check(z.maxLength(MAX_TEAMS)),
    }),
  )
  .check(z.maxLength(MAX_TEAMS));

/** The grid without its words: shapes, and only the letters already shown. */
const gridViewSchema = z.object({
  width: index,
  height: index,
  words: z
    .array(
      z.object({
        number: index,
        row: index,
        col: index,
        direction,
        length: index,
        found: z.boolean(),
        tried: z.boolean(),
      }),
    )
    .check(z.maxLength(MAX_WORDS)),
  cells: z.array(z.object({ row: index, col: index, letter })).check(z.maxLength(MAX_CELLS)),
});

export type GridView = z.infer<typeof gridViewSchema>;

const roundStepSchema = z.discriminatedUnion('kind', [
  /** The question, never its answer. */
  z.object({
    kind: z.literal('question'),
    text,
    buzzer: z.nullable(teamIndex),
    eliminated: teamList,
  }),
  z.object({ kind: z.literal('choosingWord'), team: teamIndex, letter, playable: z.array(index) }),
  z.object({ kind: z.literal('answeringWord'), team: teamIndex, letter, word: index, clue: text }),
  z.object({ kind: z.literal('lastChance') }),
  z.object({ kind: z.literal('slam'), team: teamIndex, words: z.array(index) }),
]);

const lastEvents = z.array(gameEventSchema).check(z.maxLength(MAX_EVENTS));

const finalStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('picking') }),
  z.object({
    kind: z.literal('playing'),
    selected: z.nullable(index),
    remainingMs: z.nullable(index),
  }),
]);

/** What the phone may know about the game. It never holds an answer still hidden. */
export const publicViewSchema = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('setup'), lastEvents }),
  z.object({
    phase: z.literal('round'),
    round: index,
    teams: teamsSchema,
    players: teamList,
    grid: gridViewSchema,
    lost: letters,
    step: roundStepSchema,
    lastEvents,
  }),
  z.object({
    phase: z.literal('roundOver'),
    round: index,
    teams: teamsSchema,
    players: teamList,
    grid: gridViewSchema,
    outcome: z.enum(['complete', 'slam', 'slamFailed', 'corrected']),
    lastEvents,
  }),
  z.object({
    phase: z.literal('tiebreak'),
    round: index,
    teams: teamsSchema,
    qualified: teamList,
    contenders: teamList,
    spots: index,
    text,
    buzzer: z.nullable(teamIndex),
    eliminated: teamList,
    lastEvents,
  }),
  z.object({
    phase: z.literal('final'),
    teams: teamsSchema,
    finalist: teamIndex,
    theme: text,
    grid: gridViewSchema,
    choices: index.check(z.maximum(FINAL_LETTER_CHOICES)),
    picked: z.array(index).check(z.maxLength(FINAL_LETTER_CHOICES)),
    /** The picked letters, once they are all revealed together. */
    letters,
    step: finalStepSchema,
    lastEvents,
  }),
  z.object({
    phase: z.literal('gameOver'),
    teams: teamsSchema,
    ranking: z.array(z.object({ team: teamIndex, rank: index })).check(z.maxLength(MAX_TEAMS)),
    final: z.nullable(
      z.object({ finalist: teamIndex, wordsFound: index, prize: index, complete: z.boolean() }),
    ),
    lastEvents,
  }),
]);

export type PublicView = z.infer<typeof publicViewSchema>;

function teamsView(teams: readonly Team[]): Team[] {
  return teams.map(({ name, scores }) => ({ name, scores }));
}

export function toGridView(board: Board): GridView {
  const shown = new Map<string, { row: number; col: number; letter: string }>();
  for (const word of board.grid.words) {
    wordCells(word).forEach((cell, i) => {
      const key = cellKey(cell);
      if (board.revealed.includes(key)) shown.set(key, { ...cell, letter: word.answer.charAt(i) });
    });
  }
  const grid: Grid = board.grid;
  return {
    width: grid.width,
    height: grid.height,
    words: grid.words.map((word) => ({
      number: word.number,
      row: word.row,
      col: word.col,
      direction: word.direction,
      length: word.answer.length,
      found: isWordComplete(board, word),
      tried: board.tried.includes(word.number),
    })),
    cells: [...shown.values()],
  };
}

function stepView(state: RoundState): z.infer<typeof roundStepSchema> {
  const step: RoundStep = state.step;
  switch (step.kind) {
    case 'question':
      return {
        kind: 'question',
        text: step.question.text,
        buzzer: step.buzzer,
        eliminated: step.eliminated,
      };
    case 'choosingWord': {
      const playable = playableWords(state.board, step.letter).map((word) => word.number);
      return { kind: 'choosingWord', team: step.team, letter: step.letter, playable };
    }
    case 'answeringWord': {
      const clue = findWord(state.board, step.word)?.clue ?? '';
      return { kind: 'answeringWord', team: step.team, letter: step.letter, word: step.word, clue };
    }
    case 'lastChance':
      return { kind: 'lastChance' };
    case 'slam': {
      const words = incompleteWords(state.board).map((word) => word.number);
      return { kind: 'slam', team: step.team, words };
    }
  }
}

function roundView(state: RoundState, lastEvents: GameEvent[]): PublicView {
  return {
    phase: 'round',
    round: state.round,
    teams: teamsView(state.teams),
    players: state.players,
    grid: toGridView(state.board),
    lost: state.board.lost,
    step: stepView(state),
    lastEvents,
  };
}

function roundOverView(state: RoundOverState, lastEvents: GameEvent[]): PublicView {
  return {
    phase: 'roundOver',
    round: state.round,
    teams: teamsView(state.teams),
    players: state.players,
    grid: toGridView(state.board),
    outcome: state.outcome,
    lastEvents,
  };
}

function tiebreakView(state: TiebreakState, lastEvents: GameEvent[]): PublicView {
  const { round, qualified, contenders, spots, buzzer, eliminated } = state;
  return {
    phase: 'tiebreak',
    teams: teamsView(state.teams),
    text: state.question.text,
    ...{ round, qualified, contenders, spots, buzzer, eliminated },
    lastEvents,
  };
}

function finalView(state: FinalState, lastEvents: GameEvent[]): PublicView {
  const { step } = state;
  const revealed = step.kind === 'playing';
  return {
    phase: 'final',
    teams: teamsView(state.teams),
    finalist: state.finalist,
    theme: state.board.grid.theme,
    grid: toGridView(state.board),
    choices: state.letters.length,
    picked: state.picked,
    letters: revealed ? state.picked.map((i) => state.letters[i] ?? '') : [],
    step: revealed
      ? {
          kind: 'playing',
          selected: step.selected,
          remainingMs: step.remainingMs === null ? null : Math.round(step.remainingMs),
        }
      : { kind: 'picking' },
    lastEvents,
  };
}

function gameOverView(state: GameOverState, lastEvents: GameEvent[]): PublicView {
  const final = state.final;
  return {
    phase: 'gameOver',
    teams: teamsView(state.teams),
    ranking: rankTeams(state.teams, final?.finalist ?? null),
    final:
      final === null
        ? null
        : {
            finalist: final.finalist,
            wordsFound: final.wordsFound,
            prize: final.prize,
            complete: final.complete,
          },
    lastEvents,
  };
}

/** The events of the last action travel with the view, so that the phone can tell what happened. */
export function toPublicView(state: GameState, events: readonly GameEvent[]): PublicView {
  const lastEvents = events.slice(0, MAX_EVENTS);
  switch (state.phase) {
    case 'setup':
      return { phase: 'setup', lastEvents };
    case 'round':
      return roundView(state, lastEvents);
    case 'roundOver':
      return roundOverView(state, lastEvents);
    case 'tiebreak':
      return tiebreakView(state, lastEvents);
    case 'final':
      return finalView(state, lastEvents);
    case 'gameOver':
      return gameOverView(state, lastEvents);
  }
}
