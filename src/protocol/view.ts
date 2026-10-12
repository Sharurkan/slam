import * as z from 'zod/mini';
import { MAX_TEAM_NAME_LENGTH, MAX_TEAMS } from '../game/config';
import type { GameEvent } from '../game/events';
import type { GameState } from '../game/state';

const MAX_EVENTS = 20;

const index = z.int().check(z.minimum(0));
const teamIndex = index.check(z.maximum(MAX_TEAMS - 1));

const gameEventSchema: z.ZodMiniType<GameEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gameStarted') }),
  z.object({ type: z.literal('buzzed'), team: teamIndex }),
  z.object({ type: z.literal('buzzReset') }),
  z.object({
    type: z.literal('actionRejected'),
    reason: z.enum(['wrongPhase', 'invalidTeamCount', 'invalidTeam']),
  }),
]);

const teamsSchema = z
  .array(z.object({ name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)), score: z.int() }))
  .check(z.maxLength(MAX_TEAMS));

const lastEvents = z.array(gameEventSchema).check(z.maxLength(MAX_EVENTS));

/** What the phone may know about the game. It never holds an answer. */
export const publicViewSchema = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('setup'), lastEvents }),
  z.object({
    phase: z.literal('buzzTest'),
    teams: teamsSchema,
    buzzer: z.nullable(teamIndex),
    lastEvents,
  }),
]);

export type PublicView = z.infer<typeof publicViewSchema>;

/** The events of the last action travel with the view, so that the phone can tell what happened. */
export function toPublicView(state: GameState, events: readonly GameEvent[]): PublicView {
  const lastEvents = events.slice(0, MAX_EVENTS);
  switch (state.phase) {
    case 'setup':
      return { phase: 'setup', lastEvents };
    case 'buzzTest':
      return { phase: 'buzzTest', teams: state.teams, buzzer: state.buzzer, lastEvents };
  }
}
