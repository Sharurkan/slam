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

/** Over when the time is up, the master stops it or the grid is complete: 100 € per word, the jackpot for a full grid. */
function endFinal(state: FinalState, events: GameEvent[], stopped = false): ReduceResult {
  const complete = isBoardComplete(state.board);
  const wordsFound = state.board.grid.words.length - incompleteWords(state.board).length;
  const prize = complete ? FINAL_JACKPOT : wordsFound * FINAL_PRIZE_PER_WORD;
  return {
    state: {
      phase: 'gameOver',
      teams: state.teams,
      final: { finalist: state.finalist, board: state.board, wordsFound, prize, complete },
    },
    events: [
      ...events,
      { type: 'finalOver', wordsFound, prize, complete, stopped },
      { type: 'gameOver' },
    ],
  };
}

function foundEvents(reveal: Reveal<FinalGrid>): GameEvent[] {
  return reveal.completed.map((word) => ({ type: 'finalWordFound', word: word.number }));
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
    selected: null,
    remainingMs: state.timedFinal ? FINAL_DURATION_MS : null,
    lastTickAt: deps.now(),
  };
  return { state: { ...revealed, step }, events: allEvents };
}

function isPlaying(state: FinalState): state is PlayingState {
  return state.step.kind === 'playing';
}

/** Counts down the time spent since the last tick. */
function elapse(state: PlayingState, now: number): PlayingState {
  if (state.step.remainingMs === null) return state;
  const spent = Math.max(0, now - state.step.lastTickAt);
  const remainingMs = Math.max(0, state.step.remainingMs - spent);
  return { ...state, step: { ...state.step, remainingMs, lastTickAt: now } };
}

function isTimeUp(state: PlayingState): boolean {
  return state.step.remainingMs !== null && state.step.remainingMs <= 0;
}

/** Runs an action of the timed part, or ends the final if the time is up. */
function whilePlaying(
  state: FinalState,
  deps: GameDeps,
  play: (current: PlayingState) => ReduceResult,
): ReduceResult {
  if (!isPlaying(state)) return reject(state, 'wrongPhase');
  const current = elapse(state, deps.now());
  return isTimeUp(current) ? endFinal(current, []) : play(current);
}

function withSelected(state: PlayingState, selected: number | null): PlayingState {
  return { ...state, step: { ...state.step, selected } };
}

/** Any word not found yet, in any order: the TV highlights it while the finalist types. */
export function selectFinalWord(state: FinalState, number: number, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => {
    const isOpen = incompleteWords(current.board).some((word) => word.number === number);
    if (!isOpen) return reject(state, 'invalidWord');
    return {
      state: withSelected(current, number),
      events: [{ type: 'finalWordSelected', word: number }],
    };
  });
}

export function cancelFinalWord(state: FinalState, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => ({
    state: withSelected(current, null),
    events: [],
  }));
}

/** A wrong word costs nothing but time: it stays selected for another try. */
export function submitFinalWord(state: FinalState, answer: string, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => {
    if (answer.length > MAX_ANSWER_LENGTH || normalizeAnswer(answer) === '') {
      return reject(state, 'invalidAnswer');
    }
    const { selected } = current.step;
    const word = selected === null ? undefined : findWord(current.board, selected);
    if (word === undefined) return reject(state, 'invalidWord');
    if (normalizeAnswer(answer) !== word.answer) {
      return {
        state: current,
        events: [{ type: 'finalWrongWord', word: word.number, answer: answer.trim() }],
      };
    }
    const reveal = revealWord(current.board, word);
    const next = withSelected({ ...current, board: reveal.board }, null);
    if (isBoardComplete(reveal.board)) return endFinal(next, foundEvents(reveal));
    return { state: next, events: foundEvents(reveal) };
  });
}

export function finalTick(state: FinalState, deps: GameDeps): ReduceResult {
  return whilePlaying(state, deps, (current) => ({ state: current, events: [] }));
}

/** Only a final without timer is stopped by hand: the timed one ends on its own. */
export function stopFinal(state: FinalState): ReduceResult {
  if (!isPlaying(state) || state.step.remainingMs !== null) return reject(state, 'wrongPhase');
  return endFinal(state, [], true);
}

/** After a reload, the time the TV was away does not count. */
export function resumeFinal(state: FinalState, deps: GameDeps): ReduceResult {
  if (!isPlaying(state)) return reject(state, 'wrongPhase');
  return { state: { ...state, step: { ...state.step, lastTickAt: deps.now() } }, events: [] };
}
