import { describe, expect, it } from 'vitest';
import { incompleteWords } from './board';
import { FINAL_DURATION_MS } from './config';
import { reduce } from './reducer';
import { INITIAL_STATE, type FinalState, type GameAction, type GameState } from './state';
import { play, testDeps } from './test-fixtures';

/** The final of the ANIMALS grid (CHAT, CHIEN, TOUR), with known letters behind the numbers. */
function setup(letters = ['H', 'A', 'T', 'I', 'E', 'X', 'Y', 'Z'], timedFinal = true) {
  const clock = { now: 1000 };
  const deps = testDeps(clock);
  const started = play(
    INITIAL_STATE,
    [{ type: 'startGame', teamNames: ['Alice', 'Bob'], firstRound: 3, timedFinal }],
    deps,
  );
  if (started.phase !== 'final') throw new Error('Expected the final');
  const state: FinalState = { ...started, letters };
  const act = (current: GameState, action: GameAction) => reduce(current, action, deps);
  const then = (current: GameState, ...actions: GameAction[]) => play(current, actions, deps);
  return { clock, deps, state, act, then };
}

const PICK_FIVE: GameAction[] = [0, 1, 2, 3, 4].map((index) => ({
  type: 'pickFinalNumber',
  index,
}));

function openWords(state: FinalState): number[] {
  return incompleteWords(state.board).map((word) => word.number);
}

function asFinal(state: GameState): FinalState {
  if (state.phase !== 'final') throw new Error(`Expected the final, got ${state.phase}`);
  return state;
}

describe('start of the final', () => {
  it('hides 8 different letters of the grid behind the numbers', () => {
    const started = play(INITIAL_STATE, [
      { type: 'startGame', teamNames: ['A', 'B'], firstRound: 3 },
    ]);
    const final = asFinal(started);
    expect(final.finalist).toBe(0);
    expect(final.letters).toHaveLength(8);
    expect(new Set(final.letters).size).toBe(8);
    for (const letter of final.letters) expect('CHATIENOUR').toContain(letter);
    expect(final.step).toEqual({ kind: 'picking' });
  });
});

describe('numbers', () => {
  it('reveals the 5 picked letters everywhere once all are picked, then starts the timer', () => {
    const { state, then, act } = setup();
    const four = then(state, ...PICK_FIVE.slice(0, 4));
    expect(asFinal(four).board.revealed).toEqual([]);
    const result = act(four, { type: 'pickFinalNumber', index: 4 });
    const final = asFinal(result.state);
    expect(result.events).toEqual([
      { type: 'finalNumberPicked', index: 4 },
      { type: 'finalLettersRevealed', letters: ['H', 'A', 'T', 'I', 'E'] },
    ]);
    expect(final.board.revealed).toHaveLength(6);
    expect(final.step).toEqual({
      kind: 'playing',
      selected: null,
      remainingMs: FINAL_DURATION_MS,
      lastTickAt: 1000,
    });
  });

  it('refuses a number picked twice or out of range', () => {
    const { state, then, act } = setup();
    const one = then(state, { type: 'pickFinalNumber', index: 2 });
    for (const index of [2, 8, -1, 1.5]) {
      expect(act(one, { type: 'pickFinalNumber', index }).events).toEqual([
        { type: 'actionRejected', reason: 'invalidNumber' },
      ]);
    }
  });

  it('counts a word the letters complete as found', () => {
    const { state, act, then } = setup(['C', 'H', 'A', 'T', 'O', 'X', 'Y', 'Z']);
    const result = act(then(state, ...PICK_FIVE.slice(0, 4)), {
      type: 'pickFinalNumber',
      index: 4,
    });
    expect(result.events).toContainEqual({ type: 'finalWordFound', word: 1 });
    const final = asFinal(result.state);
    expect(openWords(final)).not.toContain(1);
  });
});

/** Selects a word, then sends an answer for it. */
function tryWord(word: number, answer: string): GameAction[] {
  return [
    { type: 'selectFinalWord', word },
    { type: 'submitFinalWord', answer },
  ];
}

describe('timed words', () => {
  it('lets the finalist pick any word, in any order, and highlights it', () => {
    const { state, act, then } = setup();
    const result = act(then(state, ...PICK_FIVE), { type: 'selectFinalWord', word: 3 });
    expect(result.events).toEqual([{ type: 'finalWordSelected', word: 3 }]);
    expect(asFinal(result.state).step).toMatchObject({ selected: 3 });
  });

  it('lets the finalist switch to another word or go back to the list', () => {
    const { state, then } = setup();
    const on3 = then(state, ...PICK_FIVE, { type: 'selectFinalWord', word: 3 });
    expect(asFinal(then(on3, { type: 'selectFinalWord', word: 2 })).step).toMatchObject({
      selected: 2,
    });
    expect(asFinal(then(on3, { type: 'cancelFinalWord' })).step).toMatchObject({
      selected: null,
    });
  });

  it('refuses a word already found or unknown', () => {
    const { state, act, then } = setup();
    const found = then(state, ...PICK_FIVE, ...tryWord(1, 'chat'));
    for (const word of [1, 9]) {
      expect(act(found, { type: 'selectFinalWord', word }).events).toEqual([
        { type: 'actionRejected', reason: 'invalidWord' },
      ]);
    }
  });

  it('refuses an answer when no word is selected', () => {
    const { state, act, then } = setup();
    const result = act(then(state, ...PICK_FIVE), { type: 'submitFinalWord', answer: 'chat' });
    expect(result.events).toEqual([{ type: 'actionRejected', reason: 'invalidWord' }]);
  });

  it('validates a right word at once and goes back to the list', () => {
    const { state, act, then } = setup();
    const on3 = then(state, ...PICK_FIVE, { type: 'selectFinalWord', word: 3 });
    const result = act(on3, { type: 'submitFinalWord', answer: 'Tour' });
    expect(result.events).toEqual([{ type: 'finalWordFound', word: 3 }]);
    const final = asFinal(result.state);
    expect(openWords(final)).toEqual([1, 2]);
    expect(final.step).toMatchObject({ selected: null });
  });

  it('costs nothing but time after a wrong word: the word stays selected', () => {
    const { state, act, then } = setup();
    const on1 = then(state, ...PICK_FIVE, { type: 'selectFinalWord', word: 1 });
    const result = act(on1, { type: 'submitFinalWord', answer: 'rat' });
    expect(result.events).toEqual([{ type: 'finalWrongWord', word: 1, answer: 'rat' }]);
    expect(asFinal(result.state).step).toMatchObject({ selected: 1 });
    expect(act(result.state, { type: 'submitFinalWord', answer: 'chat' }).events).toEqual([
      { type: 'finalWordFound', word: 1 },
    ]);
  });

  it('wins the jackpot with a complete grid', () => {
    const { state, act, then } = setup();
    const two = then(state, ...PICK_FIVE, ...tryWord(3, 'tour'), ...tryWord(1, 'chat'));
    const result = act(then(two, { type: 'selectFinalWord', word: 2 }), {
      type: 'submitFinalWord',
      answer: 'chien',
    });
    expect(result.state).toMatchObject({
      phase: 'gameOver',
      final: { finalist: 0, wordsFound: 3, prize: 2000, complete: true },
    });
    expect(result.events).toEqual([
      { type: 'finalWordFound', word: 2 },
      { type: 'finalOver', wordsFound: 3, prize: 2000, complete: true, stopped: false },
      { type: 'gameOver' },
    ]);
  });
});

describe('timer', () => {
  it('counts down at each tick and ends the final at 0, 100 € per word found', () => {
    const { state, act, then, clock } = setup();
    const one = then(state, ...PICK_FIVE, ...tryWord(1, 'chat'));
    clock.now += 20_000;
    const ticked = act(one, { type: 'finalTick' });
    expect(asFinal(ticked.state).step).toMatchObject({ remainingMs: 40_000 });
    expect(ticked.events).toEqual([]);
    clock.now += 40_000;
    const over = act(ticked.state, { type: 'finalTick' });
    expect(over.state).toMatchObject({
      phase: 'gameOver',
      final: { wordsFound: 1, prize: 100, complete: false },
    });
    expect(over.events).toEqual([
      { type: 'finalOver', wordsFound: 1, prize: 100, complete: false, stopped: false },
      { type: 'gameOver' },
    ]);
  });

  it('does not count a word sent after the time is up', () => {
    const { state, act, then, clock } = setup();
    const playing = then(state, ...PICK_FIVE);
    clock.now += FINAL_DURATION_MS;
    const result = act(playing, { type: 'submitFinalWord', answer: 'chat' });
    expect(result.state).toMatchObject({ phase: 'gameOver', final: { wordsFound: 0, prize: 0 } });
  });

  it('does not count the time the TV was away after a reload', () => {
    const { state, act, then, clock } = setup();
    const playing = then(state, ...PICK_FIVE);
    clock.now += 50_000;
    const resumed = act(playing, { type: 'resumeFinal' }).state;
    clock.now += 1000;
    expect(asFinal(act(resumed, { type: 'finalTick' }).state).step).toMatchObject({
      remainingMs: 59_000,
    });
  });

  it('only runs while the words are timed', () => {
    const { state, act } = setup();
    expect(act(state, { type: 'finalTick' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
    expect(act(state, { type: 'submitFinalWord', answer: 'chat' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});

describe('final without timer', () => {
  const LETTERS = ['H', 'A', 'T', 'I', 'E', 'X', 'Y', 'Z'];

  it('never ends on its own, however long the finalist takes', () => {
    const { state, act, then, clock } = setup(LETTERS, false);
    const playing = then(state, ...PICK_FIVE);
    expect(asFinal(playing).step).toMatchObject({ kind: 'playing', remainingMs: null });
    clock.now += 10 * FINAL_DURATION_MS;
    const ticked = act(playing, { type: 'finalTick' });
    expect(asFinal(ticked.state).step).toMatchObject({ remainingMs: null });
    const found = act(ticked.state, { type: 'selectFinalWord', word: 1 }).state;
    expect(act(found, { type: 'submitFinalWord', answer: 'chat' }).events).toEqual([
      { type: 'finalWordFound', word: 1 },
    ]);
  });

  it('ends when the master stops it, 100 € per word found', () => {
    const { state, act, then } = setup(LETTERS, false);
    const one = then(state, ...PICK_FIVE, ...tryWord(1, 'chat'));
    const stopped = act(one, { type: 'stopFinal' });
    expect(stopped.state).toMatchObject({
      phase: 'gameOver',
      final: { wordsFound: 1, prize: 100, complete: false },
    });
    expect(stopped.events).toEqual([
      { type: 'finalOver', wordsFound: 1, prize: 100, complete: false, stopped: true },
      { type: 'gameOver' },
    ]);
  });

  it('cannot be stopped before the letters are revealed, nor when timed', () => {
    const untimed = setup(LETTERS, false);
    expect(untimed.act(untimed.state, { type: 'stopFinal' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
    const timed = setup(LETTERS);
    const playing = timed.then(timed.state, ...PICK_FIVE);
    expect(timed.act(playing, { type: 'stopFinal' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });
});
