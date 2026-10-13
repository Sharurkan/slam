import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import { play, startedRound, testDeps, withQuestion } from '../game/test-fixtures';
import { loadGame, saveGame } from './game-store';

const deps = testDeps();

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const PICKS: GameAction[] = [0, 1, 2, 3, 4].map((index) => ({ type: 'pickFinalNumber', index }));

/** One state of each phase and step, as the TV would save them. */
function samples(): [string, GameState][] {
  const question = withQuestion(startedRound(), 'T');
  const hand = play(
    question,
    [
      { type: 'buzz', team: 1 },
      { type: 'submitLetter', letter: 'T' },
    ],
    deps,
  );
  const final = play(
    INITIAL_STATE,
    [{ type: 'startGame', teamNames: ['A', 'B'], firstRound: 3 }],
    deps,
  );
  const playing = play(final, PICKS, deps);
  const tied = play(
    startedRound(['A', 'B', 'C']),
    [{ type: 'revealGrid' }, { type: 'nextRound' }],
    deps,
  );
  return [
    ['setup', INITIAL_STATE],
    ['question', question],
    ['buzzer answering', play(question, [{ type: 'buzz', team: 0 }], deps)],
    ['choosing a word', hand],
    ['answering a word', play(hand, [{ type: 'chooseWord', word: 3 }], deps)],
    ['SLAM offer', play(hand, [{ type: 'chooseWord', word: 3 }, { type: 'passWord' }], deps)],
    [
      'slam',
      play(
        hand,
        [{ type: 'chooseWord', word: 3 }, { type: 'passWord' }, { type: 'startSlam' }],
        deps,
      ),
    ],
    ['round over', play(hand, [{ type: 'revealGrid' }], deps)],
    ['tiebreak', tied],
    ['final, picking', final],
    ['final, playing', playing],
    [
      'final without timer',
      play(
        INITIAL_STATE,
        [{ type: 'startGame', teamNames: ['A', 'B'], firstRound: 3, timedFinal: false }, ...PICKS],
        deps,
      ),
    ],
    [
      'game over',
      play(
        playing,
        [{ type: 'submitFinalWord', answer: 'chat' }, { type: 'finalTick' }],
        testDeps({ now: 10 ** 9 }),
      ),
    ],
    ['abandoned', play(question, [{ type: 'abandonGame' }], deps)],
  ];
}

describe('game store', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is empty at first', () => {
    expect(loadGame()).toEqual({ kind: 'empty' });
  });

  it.each(samples())('saves and loads the game (%s)', (_, state) => {
    expect(saveGame(state)).toBe(true);
    expect(loadGame()).toEqual({ kind: 'loaded', state });
  });

  it('covers the tiebreak and the end of the game', () => {
    const phases = samples().map(([, state]) => state.phase);
    expect(new Set(phases)).toEqual(
      new Set(['setup', 'round', 'roundOver', 'tiebreak', 'final', 'gameOver']),
    );
  });

  it('drops a save from another version', () => {
    storage.setItem('slam.game', JSON.stringify({ v: 999, state: INITIAL_STATE }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it.each([
    'not json',
    JSON.stringify({ v: 1, state: { phase: 'round' } }),
    JSON.stringify({ v: 1, state: { phase: 'cheating' } }),
  ])('drops an unreadable save: %s', (raw) => {
    storage.setItem('slam.game', raw);
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('drops a save whose player indexes point nowhere', () => {
    const state = startedRound(['A', 'B']);
    saveGame({ ...state, players: [0, 1, 5] });
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('never throws when storage is blocked', () => {
    const blocked = (): never => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(saveGame(INITIAL_STATE)).toBe(false);
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });
});
