import * as z from 'zod/mini';
import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS, MIN_TEAMS } from '../game/config';
import type { GameAction } from '../game/state';

const teamIndex = z.int().check(z.minimum(0), z.maximum(MAX_TEAMS - 1));

/** Actions the phone may send. */
export type PhoneAction = GameAction;

export const phoneActionSchema: z.ZodMiniType<PhoneAction> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startGame'),
    teamNames: z
      .array(z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)))
      .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS)),
  }),
  z.object({ type: z.literal('buzz'), team: teamIndex }),
  z.object({ type: z.literal('resetBuzz') }),
  z.object({ type: z.literal('newGame') }),
]);
