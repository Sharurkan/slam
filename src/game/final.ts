import {
  findWord,
  incompleteWords,
  isBoardComplete,
  newBoard,
  revealLetters,
  revealWord,
  type Reveal,
} from './board';
import { drawGrid, reject, shuffle, type GameDeps, type ReduceResult } from './common';
import {
  FINAL_DURATION_MS,
  FINAL_JACKPOT,
  FINAL_LETTER_CHOICES,
  FINAL_LETTER_PICKS,
  FINAL_PRIZE_PER_WORD,
  MAX_ANSWER_LENGTH,
} from './config';
import type { GameEvent } from './events';
import { gridLetters, type FinalGrid } from './grid';
import type { FinalState, FinalStep, Progress } from './state';
import { normalizeAnswer } from './text-input';

type PlayingStep = Extract<FinalStep, { kind: 'playing' }>;
type PlayingState = FinalState & { step: PlayingStep };

export function startFinal(
  progress: Progress,
  finalist: number,
  deps: GameDeps,
  gridId?: string,
): ReduceResult {
  const drawn = drawGrid(deps.content.finalGrids, progress, deps, gridId);
  if (drawn === null) throw new Error('No final grid');
  const letters = shuffle(deps.random, [...gridLetters(drawn.grid)]).slice(0, FINAL_LETTER_CHOICES);
  return {
    state: {
      ...drawn.progress,
      phase: 'final',
      finalist,
      board: newBoard<FinalGrid>(drawn.grid),
      letters,
      picked: [],
      step: { kind: 'picking' },
    },
    events: [{ type: 'finalStarted', finalist }],
  };
}

/** Over when the time is up or the grid complete: 100 € per word, the jackpot for a full grid. */
function endFinal(state: FinalState, events: GameEvent[]): ReduceResult {
  const complete = isBoardComplete(state.board);
  const wordsFound = state.board.grid.words.length - incompleteWords(state.board).length;
  const prize = complete ? FINAL_JACKPOT : wordsFound * FINAL_PRIZE_PER_WORD;
  return {
    state: {
      phase: 'gameOver',
      teams: state.teams,
      final: { finalist: state.finalist, board: state.board, wordsFound, prize, complete },
    },
    events: [...events, { type: 'finalOver', wordsFound, prize, complete }, { type: 'gameOver' }],
  };
}

function foundEvents(reveal: Reveal<FinalGrid>): GameEvent[] {
  return reveal.completed.map((word) => ({ type: 'finalWordFound', word: word.number }));
}

/** Clues come in number order; passed words come back after the last one. */
function nextOpenWord(state: FinalState, after: number): number {
  const open = incompleteWords(state.board).map((word) => word.number);
  return open.find((number) => number > after) ?? open[0] ?? after;
}

export function pickFinalNumber(state: FinalState, index: number, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'picking') return reject(state, 'wrongPhase');
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.letters.length ||
    state.picked.includes(index)
  ) {
    return reject(state, 'invalidNumber');
  }
  const picked = [...state.picked, index];
  const events: GameEvent[] = [{ type: 'finalNumberPicked', index }];
  if (picked.length < FINAL_LETTER_PICKS) return { state: { ...state, picked }, events };
  const letters = picked.map((i) => state.letters[i] ?? '');
  const reveal = revealLetters(state.board, letters);
  const revealed: FinalState = { ...state, picked, board: reveal.board };
  const allEvents: GameEvent[] = [
    ...events,
    { type: 'finalLettersRevealed', letters },
    ...foundEvents(reveal),
  ];
  if (isBoardComplete(reveal.board)) return endFinal(revealed, allEvents);
  const step: PlayingStep = {
    kind: 'playing',
    current: nextOpenWord(revealed, 0),
    remainingMs: FINAL_DURATION_MS,
    lastTickAt: deps.now(),
  };
  return { state: { ...revealed, step }, events: allEvents };
}

function isPlaying(state: FinalState): state is PlayingState {
  return state.step.kind === 'playing';
}

/** Counts down the time spent since the last tick. */
function elapse(state: PlayingState, now: number): PlayingState {
  const spent = Math.max(0, now - state.step.lastTickAt);
  const remainingMs = Math.max(0, state.step.remainingMs - spent);
  return { ...state, step: { ...state.step, remainingMs, lastTickAt: now } };
}

/** Runs an action of the timed part, or ends the final if the time is up. */
function whilePlaying(
  state: FinalState,
  deps: GameDeps,
  play: (current: PlayingState) => ReduceResult,
): ReduceResult {
  if (!isPlaying(state)) return reject(state, 'wrongPhase');
  const current = elapse(state, deps.now());
  return current.step.remainingMs <= 0 ? endFinal(current, []) : play(current);
}

export function submitFinalWord(state: FinalState, answer: string, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => {
    if (answer.length > MAX_ANSWER_LENGTH || normalizeAnswer(answer) === '') {
      return reject(state, 'invalidAnswer');
    }
    const word = findWord(current.board, current.step.current);
    if (word === undefined) return reject(state, 'invalidWord');
    if (normalizeAnswer(answer) !== word.answer) {
      return {
        state: current,
        events: [{ type: 'finalWrongWord', word: word.number, answer: answer.trim() }],
      };
    }
    const reveal = revealWord(current.board, word);
    const next: PlayingState = { ...current, board: reveal.board };
    if (isBoardComplete(reveal.board)) return endFinal(next, foundEvents(reveal));
    const step = { ...next.step, current: nextOpenWord(next, word.number) };
    return { state: { ...next, step }, events: foundEvents(reveal) };
  });
}

export function passFinalWord(state: FinalState, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => {
    const step = { ...current.step, current: nextOpenWord(current, current.step.current) };
    return {
      state: { ...current, step },
      events: [{ type: 'finalWordPassed', word: current.step.current }],
    };
  });
}

export function finalTick(state: FinalState, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => ({ state: current, events: [] }));
}

/** After a reload, the time the TV was away does not count. */
export function resumeFinal(state: FinalState, deps: GameDeps): ReduceResult {
  if (!isPlaying(state)) return reject(state, 'wrongPhase');
  return { state: { ...state, step: { ...state.step, lastTickAt: deps.now() } }, events: [] };
}
