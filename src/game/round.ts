import {
  findWord,
  incompleteWords,
  isBoardComplete,
  newBoard,
  playableWords,
  remainingPoints,
  revealLetters,
  revealWord,
  usableLetters,
  wordPoints,
  type Board,
  type Reveal,
} from './board';
import {
  addPoints,
  drawGrid,
  drawQuestion,
  letterFound,
  letterLost,
  progressOf,
  reject,
  type GameDeps,
  type ReduceResult,
} from './common';
import { MAX_ANSWER_LENGTH } from './config';
import type { GameEvent } from './events';
import type { Grid } from './grid';
import type {
  Progress,
  Question,
  RoundOutcome,
  RoundState,
  RoundStep,
  Team,
  WordAnswer,
} from './state';
import { normalizeLetter, normalizeAnswer } from './text-input';

/** Round 2 starts again at 0: each player gets a fresh score for the round. */
function withFreshScore(team: Team, round: number): Team {
  const scores = Array.from({ length: round }, (_, i) => team.scores[i] ?? 0);
  scores[round - 1] = 0;
  return { ...team, scores };
}

export function startRound(
  progress: Progress,
  round: number,
  players: number[],
  deps: GameDeps,
  gridId?: string,
): ReduceResult {
  const drawn = drawGrid(deps.content.roundGrids[round - 1] ?? [], progress, deps, gridId);
  if (drawn === null) throw new Error(`No grid for round ${String(round)}`);
  const teams = drawn.progress.teams.map((team, index) =>
    players.includes(index) ? withFreshScore(team, round) : team,
  );
  const state: RoundState = {
    ...drawn.progress,
    teams,
    phase: 'round',
    round,
    players,
    board: newBoard<Grid>(drawn.grid),
    step: { kind: 'lastChance' },
  };
  return askNext(state, [{ type: 'roundStarted', round }], deps);
}

function withStep(state: RoundState, step: RoundStep): RoundState {
  return { ...state, step };
}

function endRound(state: RoundState, outcome: RoundOutcome, events: GameEvent[]): ReduceResult {
  const { round, players, board } = state;
  return {
    state: { ...progressOf(state), phase: 'roundOver', round, players, board, outcome },
    events: [...events, { type: 'roundOver', round }],
  };
}

/** Next question, the last chance when no letter is left, or the end of the round. */
function askNext(state: RoundState, events: GameEvent[], deps: GameDeps): ReduceResult {
  if (isBoardComplete(state.board)) return endRound(state, 'complete', events);
  const letters = usableLetters(state.board);
  if (letters.length === 0) {
    return {
      state: withStep(state, { kind: 'lastChance' }),
      events: [...events, { type: 'lastChance' }],
    };
  }
  const drawn = drawQuestion(letters, state, deps);
  return {
    state: {
      ...state,
      ...drawn.progress,
      step: { kind: 'question', question: drawn.question, buzzer: null, eliminated: [] },
    },
    events: [...events, { type: 'questionAsked' }],
  };
}

/** Every word completed by a reveal pays its points to the player who caused it. */
function score(
  state: RoundState,
  team: number,
  reveal: Reveal<Grid>,
): { state: RoundState; events: GameEvent[] } {
  let teams = state.teams;
  const events: GameEvent[] = [];
  for (const word of reveal.completed) {
    const points = wordPoints(word);
    teams = addPoints(teams, team, state.round, points);
    events.push({ type: 'wordFound', team, word: word.number, points });
  }
  return { state: { ...state, teams, board: reveal.board }, events };
}

export function buzzRound(state: RoundState, team: number): ReduceResult {
  if (!state.players.includes(team)) return reject(state, 'notPlaying');
  const { step } = state;
  if (step.kind === 'lastChance') {
    return {
      state: withStep(state, { kind: 'slam', team }),
      events: [
        { type: 'buzzed', team },
        { type: 'slamStarted', team },
      ],
    };
  }
  if (step.kind !== 'question' || step.buzzer !== null) return reject(state, 'wrongPhase');
  if (step.eliminated.includes(team)) return reject(state, 'teamEliminated');
  return { state: withStep(state, { ...step, buzzer: team }), events: [{ type: 'buzzed', team }] };
}

function loseLetter(state: RoundState, question: Question, events: GameEvent[], deps: GameDeps) {
  const board: Board = { ...state.board, lost: [...state.board.lost, question.letter] };
  return askNext({ ...state, board }, [...events, letterLost(question)], deps);
}

export function submitLetter(state: RoundState, input: string, deps: GameDeps): ReduceResult {
  const { step } = state;
  if (step.kind !== 'question' || step.buzzer === null) return reject(state, 'wrongPhase');
  const letter = normalizeLetter(input);
  if (letter === null) return reject(state, 'invalidLetter');
  const team = step.buzzer;
  if (letter !== step.question.letter) {
    const wrong: GameEvent = { type: 'wrongLetter', team, letter };
    const eliminated = [...step.eliminated, team];
    if (state.players.every((player) => eliminated.includes(player))) {
      return loseLetter(state, step.question, [wrong], deps);
    }
    return { state: withStep(state, { ...step, buzzer: null, eliminated }), events: [wrong] };
  }
  const scored = score(state, team, revealLetters(state.board, [letter]));
  const events: GameEvent[] = [letterFound(team, step.question), ...scored.events];
  if (isBoardComplete(scored.state.board)) return endRound(scored.state, 'complete', events);
  if (playableWords(scored.state.board, letter).length === 0) {
    return askNext(scored.state, [...events, { type: 'noWordToPlay', team }], deps);
  }
  return { state: withStep(scored.state, { kind: 'choosingWord', team, letter }), events };
}

/** "Personne ne sait": the letter is announced and lost. */
export function skipQuestion(state: RoundState, deps: GameDeps): ReduceResult {
  const { step } = state;
  if (step.kind !== 'question' || step.buzzer !== null) return reject(state, 'wrongPhase');
  return loseLetter(state, step.question, [], deps);
}

export function chooseWord(state: RoundState, number: number): ReduceResult {
  const { step } = state;
  if (step.kind !== 'choosingWord') return reject(state, 'wrongPhase');
  const word = findWord(state.board, number);
  if (word === undefined) return reject(state, 'invalidWord');
  if (!playableWords(state.board, step.letter).includes(word))
    return reject(state, 'wordNotPlayable');
  return {
    state: withStep(state, { ...step, kind: 'answeringWord', word: number }),
    events: [{ type: 'wordChosen', team: step.team, word: number }],
  };
}

/** After each proposed word, the round ends if the grid is complete, or the player may slam. */
function offerSlam(state: RoundState, team: number, events: GameEvent[]): ReduceResult {
  if (isBoardComplete(state.board)) return endRound(state, 'complete', events);
  return {
    state: withStep(state, { kind: 'slamChance', team }),
    events: [...events, { type: 'slamChance', team }],
  };
}

/** A tried word is greyed until another of its letters is shown. */
function markTried(state: RoundState, word: number): RoundState {
  return { ...state, board: { ...state.board, tried: [...state.board.tried, word] } };
}

/** "Je ne sais pas": same as a wrong word. */
export function passWord(state: RoundState): ReduceResult {
  const { step } = state;
  if (step.kind !== 'answeringWord') return reject(state, 'wrongPhase');
  return offerSlam(markTried(state, step.word), step.team, [
    { type: 'wordPassed', team: step.team, word: step.word },
  ]);
}

export function nextQuestion(state: RoundState, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'slamChance') return reject(state, 'wrongPhase');
  return askNext(state, [], deps);
}

function isValidAnswer(answer: string): boolean {
  return answer.length <= MAX_ANSWER_LENGTH && normalizeAnswer(answer) !== '';
}

export function submitWord(state: RoundState, answer: string): ReduceResult {
  const { step } = state;
  if (step.kind !== 'answeringWord') return reject(state, 'wrongPhase');
  if (!isValidAnswer(answer)) return reject(state, 'invalidAnswer');
  const word = findWord(state.board, step.word);
  if (word === undefined) return reject(state, 'invalidWord');
  if (normalizeAnswer(answer) === word.answer) {
    const scored = score(state, step.team, revealWord(state.board, word));
    return offerSlam(scored.state, step.team, scored.events);
  }
  const wrong: GameEvent = {
    type: 'wrongWord',
    team: step.team,
    word: word.number,
    answer: answer.trim(),
  };
  return offerSlam(markTried(state, word.number), step.team, [wrong]);
}

export function startSlam(state: RoundState): ReduceResult {
  const { step } = state;
  if (step.kind !== 'slamChance') return reject(state, 'wrongPhase');
  return {
    state: withStep(state, { kind: 'slam', team: step.team }),
    events: [{ type: 'slamStarted', team: step.team }],
  };
}

/** One answer for each word still open, no more, no less. */
function coversRemainingWords(board: Board, answers: readonly WordAnswer[]): boolean {
  const remaining = incompleteWords(board).map((word) => word.number);
  const numbers = answers.map((answer) => answer.word);
  return (
    numbers.length === remaining.length &&
    remaining.every((number) => numbers.includes(number)) &&
    answers.every((answer) => isValidAnswer(answer.answer))
  );
}

/** Right: the slammer wins every point left. Wrong: each opponent wins them. */
export function submitSlam(state: RoundState, answers: WordAnswer[]): ReduceResult {
  const { step } = state;
  if (step.kind !== 'slam') return reject(state, 'wrongPhase');
  if (!coversRemainingWords(state.board, answers)) return reject(state, 'invalidAnswer');
  const points = remainingPoints(state.board);
  const remaining = incompleteWords(state.board);
  const right = remaining.every(
    (word) =>
      normalizeAnswer(answers.find((a) => a.word === word.number)?.answer ?? '') === word.answer,
  );
  if (right) {
    const board = remaining.reduce((current, word) => revealWord(current, word).board, state.board);
    const teams = addPoints(state.teams, step.team, state.round, points);
    return endRound({ ...state, teams, board }, 'slam', [
      { type: 'slamWon', team: step.team, points },
    ]);
  }
  const teams = state.players
    .filter((player) => player !== step.team)
    .reduce((current, player) => addPoints(current, player, state.round, points), state.teams);
  return endRound({ ...state, teams }, 'slamFailed', [
    { type: 'slamFailed', team: step.team, points },
  ]);
}

/** "Corriger la grille": the round ends, the remaining words are shown, nobody scores. */
export function revealGrid(state: RoundState): ReduceResult {
  return endRound(state, 'corrected', [{ type: 'gridCorrected' }]);
}
