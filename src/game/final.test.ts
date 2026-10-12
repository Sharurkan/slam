import { describe, expect, it } from 'vitest';
import { FINAL_DURATION_MS } from './config';
import { reduce } from './reducer';
import { INITIAL_STATE, type FinalState, type GameAction, type GameState } from './state';
import { play, testDeps } from './test-fixtures';

/** The final of the ANIMALS grid (CHAT, CHIEN, TOUR), with known letters behind the numbers. */
function setup(letters = ['H', 'A', 'T', 'I', 'E', 'X', 'Y', 'Z']) {
  const clock = { now: 1000 };
  const deps = testDeps(clock);
  const started = play(
    INITIAL_STATE,
    [{ type: 'startGame', teamNames: ['Alice', 'Bob'], firstRound: 3 }],
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
      current: 1,
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
    expect(asFinal(result.state).step).toMatchObject({ current: 2 });
  });
});

describe('timed words', () => {
  it('shows a right word and moves to the next clue', () => {
    const { state, act, then } = setup();
    const result = act(then(state, ...PICK_FIVE), { type: 'submitFinalWord', answer: 'Chat' });
    expect(result.events).toEqual([{ type: 'finalWordFound', word: 1 }]);
    expect(asFinal(result.state).step).toMatchObject({ current: 2 });
  });

  it('stays on the clue after a wrong word', () => {
    const { state, act, then } = setup();
    const result = act(then(state, ...PICK_FIVE), { type: 'submitFinalWord', answer: 'rat' });
    expect(result.events).toEqual([{ type: 'finalWrongWord', word: 1, answer: 'rat' }]);
    expect(asFinal(result.state).step).toMatchObject({ current: 1 });
  });

  it('brings passed words back after the last one', () => {
    const { state, then } = setup();
    const playing = then(state, ...PICK_FIVE);
    const pass: GameAction = { type: 'passFinalWord' };
    expect(asFinal(then(playing, pass)).step).toMatchObject({ current: 2 });
    expect(asFinal(then(playing, pass, pass)).step).toMatchObject({ current: 3 });
    expect(asFinal(then(playing, pass, pass, pass)).step).toMatchObject({ current: 1 });
    const found = then(playing, { type: 'submitFinalWord', answer: 'chat' }, pass, pass);
    expect(asFinal(found).step).toMatchObject({ current: 2 });
  });

  it('wins the jackpot with a complete grid', () => {
    const { state, act, then } = setup();
    const two = then(
      state,
      ...PICK_FIVE,
      { type: 'submitFinalWord', answer: 'chat' },
      {
        type: 'submitFinalWord',
        answer: 'chien',
      },
    );
    const result = act(two, { type: 'submitFinalWord', answer: 'tour' });
    expect(result.state).toMatchObject({
      phase: 'gameOver',
      final: { finalist: 0, wordsFound: 3, prize: 2000, complete: true },
    });
    expect(result.events).toEqual([
      { type: 'finalWordFound', word: 3 },
      { type: 'finalOver', wordsFound: 3, prize: 2000, complete: true },
      { type: 'gameOver' },
    ]);
  });
});

describe('timer', () => {
  it('counts down at each tick and ends the final at 0, 100 € per word found', () => {
    const { state, act, then, clock } = setup();
    const one = then(state, ...PICK_FIVE, { type: 'submitFinalWord', answer: 'chat' });
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
      { type: 'finalOver', wordsFound: 1, prize: 100, complete: false },
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
