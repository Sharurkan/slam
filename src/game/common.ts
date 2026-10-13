import type { GameEvent, RejectionReason } from './events';
import type { FinalGrid, Grid } from './grid';
import type { GameState, Progress, Question, Team } from './state';

/** A question whose answer is one letter. */
export interface QuestionEntry {
  text: string;
  /** The word the letter comes from, shown once the letter is public. */
  answer?: string;
}

/** Questions by answer letter. */
export type QuestionBank = Readonly<Record<string, readonly QuestionEntry[]>>;

/** Everything the game draws from. Given by the TV, or by the tests. */
export interface GameContent {
  /** Grids of each round: index 0 for round 1. */
  roundGrids: readonly (readonly Grid[])[];
  finalGrids: readonly FinalGrid[];
  questions: QuestionBank;
}

export interface GameDeps {
  /** Returns a number in [0, 1), like Math.random. */
  random: () => number;
  /** Milliseconds, like Date.now. */
  now: () => number;
  content: GameContent;
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export function reject(state: GameState, reason: RejectionReason): ReduceResult {
  return { state, events: [{ type: 'actionRejected', reason }] };
}

export function pickIndex(random: () => number, length: number): number {
  return Math.min(Math.floor(random() * length), length - 1);
}

/** Fisher-Yates shuffle, with injected randomness. */
export function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = pickIndex(random, i + 1);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * A grid not played yet in this game (the forced one, if given). Once all were
 * played, any grid may come back.
 */
export function drawGrid<G extends Grid>(
  grids: readonly G[],
  progress: Progress,
  deps: GameDeps,
  forcedId?: string,
): { grid: G; progress: Progress } | null {
  const fresh = grids.filter((grid) => !progress.usedGrids.includes(grid.id));
  const pool = fresh.length > 0 ? fresh : grids;
  const grid =
    forcedId === undefined
      ? pool[pickIndex(deps.random, pool.length)]
      : grids.find((candidate) => candidate.id === forcedId);
  if (grid === undefined) return null;
  return { grid, progress: { ...progress, usedGrids: [...progress.usedGrids, grid.id] } };
}

/** A question for one of the letters, not asked yet in this game if possible. */
export function drawQuestion(
  letters: readonly string[],
  progress: Progress,
  deps: GameDeps,
): { question: Question; progress: Progress } {
  const askable = letters.filter((letter) => (deps.content.questions[letter]?.length ?? 0) > 0);
  const letter = askable[pickIndex(deps.random, askable.length)];
  const entries = letter === undefined ? undefined : deps.content.questions[letter];
  if (letter === undefined || entries === undefined) {
    throw new Error('No question for these letters');
  }
  const keyOf = (index: number): string => `${letter}:${String(index)}`;
  const fresh = entries
    .map((_, index) => index)
    .filter((i) => !progress.usedQuestions.includes(keyOf(i)));
  // Every question of this letter was asked: they may all come back.
  const pool = fresh.length > 0 ? fresh : entries.map((_, index) => index);
  const used =
    fresh.length > 0
      ? progress.usedQuestions
      : progress.usedQuestions.filter((key) => !key.startsWith(`${letter}:`));
  const index = pool[pickIndex(deps.random, pool.length)] ?? 0;
  return {
    question: toQuestion(letter, entries[index]),
    progress: { ...progress, usedQuestions: [...used, keyOf(index)] },
  };
}

function toQuestion(letter: string, entry: QuestionEntry | undefined): Question {
  const text = entry?.text ?? '';
  return entry?.answer === undefined ? { letter, text } : { letter, text, answer: entry.answer };
}

/** The letter is public now: its answer word may go with it. */
export function letterFound(team: number, question: Question): GameEvent {
  const { letter, answer } = question;
  return answer === undefined
    ? { type: 'letterFound', team, letter }
    : { type: 'letterFound', team, letter, answer };
}

export function letterLost(question: Question): GameEvent {
  const { letter, answer } = question;
  return answer === undefined
    ? { type: 'letterLost', letter }
    : { type: 'letterLost', letter, answer };
}

export function addPoints(teams: Team[], team: number, round: number, points: number): Team[] {
  return teams.map((current, index) => {
    if (index !== team || points === 0) return current;
    const scores = [...current.scores];
    scores[round - 1] = (scores[round - 1] ?? 0) + points;
    return { ...current, scores };
  });
}

export function roundScore(team: Team | undefined, round: number): number {
  return team?.scores[round - 1] ?? 0;
}

export function progressOf(state: Progress): Progress {
  const { teams, usedGrids, usedQuestions } = state;
  return { teams, usedGrids, usedQuestions };
}
