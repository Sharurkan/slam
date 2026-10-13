import * as z from 'zod/mini';
import {
  FINAL_LETTER_CHOICES,
  FINAL_WORD_COUNT,
  MAX_ANSWER_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  ROUND_COUNT,
  ROUND_WORD_COUNTS,
} from '../game/config';
import type { GameAction } from '../game/state';

/** Longest grid id a test phone may force. */
const MAX_GRID_ID_LENGTH = 20;
/** A letter may arrive with its accent (é): normalized by the game. */
const MAX_LETTER_LENGTH = 2;
const MAX_WORDS = Math.max(FINAL_WORD_COUNT, ...ROUND_WORD_COUNTS);

const teamIndex = z.int().check(z.minimum(0), z.maximum(MAX_TEAMS - 1));
const wordNumber = z.int().check(z.minimum(1), z.maximum(MAX_WORDS));
const answer = z.string().check(z.maxLength(MAX_ANSWER_LENGTH));

/** Actions the phone may send. The final timer only comes from the TV. */
export type PhoneAction = Exclude<GameAction, { type: 'finalTick' | 'resumeFinal' }>;

const simple = <T extends PhoneAction['type']>(type: T) => z.object({ type: z.literal(type) });

export const phoneActionSchema: z.ZodMiniType<PhoneAction> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startGame'),
    teamNames: z
      .array(z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)))
      .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS)),
    firstRound: z.optional(z.int().check(z.minimum(1), z.maximum(ROUND_COUNT + 1))),
    gridId: z.optional(z.string().check(z.maxLength(MAX_GRID_ID_LENGTH))),
  }),
  z.object({ type: z.literal('buzz'), team: teamIndex }),
  z.object({
    type: z.literal('submitLetter'),
    letter: z.string().check(z.minLength(1), z.maxLength(MAX_LETTER_LENGTH)),
  }),
  simple('skipQuestion'),
  z.object({ type: z.literal('chooseWord'), word: wordNumber }),
  z.object({ type: z.literal('submitWord'), answer }),
  simple('cancelWord'),
  simple('startSlam'),
  z.object({
    type: z.literal('submitSlam'),
    answers: z.array(z.object({ word: wordNumber, answer })).check(z.maxLength(MAX_WORDS)),
  }),
  simple('revealGrid'),
  simple('nextRound'),
  z.object({
    type: z.literal('pickFinalNumber'),
    index: z.int().check(z.minimum(0), z.maximum(FINAL_LETTER_CHOICES - 1)),
  }),
  z.object({ type: z.literal('selectFinalWord'), word: wordNumber }),
  simple('cancelFinalWord'),
  z.object({ type: z.literal('submitFinalWord'), answer }),
  simple('abandonGame'),
  simple('newGame'),
]);
