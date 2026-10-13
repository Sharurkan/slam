import { describe, expect, it } from 'vitest';
import { incompleteWords } from '../game/board';
import type { GameAction, GameState } from '../game/state';
import { INITIAL_STATE } from '../game/state';
import { reduce } from '../game/reducer';
import { play, startedRound, testDeps, withQuestion } from '../game/test-fixtures';
import { parseTvMessage, stateMessage } from './messages';
import { SINGLE_PHONE_ROOM } from './room';
import { toPublicView, type PublicView } from './view';

const deps = testDeps();

function view(state: GameState): PublicView {
  return toPublicView(state, []);
}

/** Answers of the words not found yet: they must never reach a phone. */
function hiddenAnswers(state: GameState): string[] {
  if (state.phase === 'round' || state.phase === 'final') {
    return incompleteWords(state.board).map((word) => word.answer);
  }
  return [];
}

const roundStates: [string, GameState][] = (() => {
  const question = withQuestion(startedRound(), 'T');
  const buzzed = play(question, [{ type: 'buzz', team: 0 }], deps);
  const hand = play(buzzed, [{ type: 'submitLetter', letter: 'T' }], deps);
  const answering = play(hand, [{ type: 'chooseWord', word: 3 }], deps);
  const slam = play(hand, [{ type: 'startSlam' }], deps);
  return [
    ['question', question],
    ['buzzer answering', buzzed],
    ['choosing a word', hand],
    ['answering a word', answering],
    ['slam', slam],
  ];
})();

const finalStates: [string, GameState][] = (() => {
  const final = play(
    INITIAL_STATE,
    [{ type: 'startGame', teamNames: ['A', 'B'], firstRound: 3 }],
    deps,
  );
  const picks: GameAction[] = [0, 1, 2, 3, 4].map((index) => ({ type: 'pickFinalNumber', index }));
  return [
    ['final, picking', final],
    ['final, playing', play(final, picks, deps)],
  ];
})();

describe('toPublicView', () => {
  it.each([...roundStates, ...finalStates])('never holds a hidden word (%s)', (_, state) => {
    const json = JSON.stringify(view(state));
    expect(hiddenAnswers(state).length).toBeGreaterThan(0);
    for (const answer of hiddenAnswers(state)) expect(json).not.toContain(answer);
  });

  it.each([...roundStates, ...finalStates])('only shows the revealed letters (%s)', (_, state) => {
    const shown = view(state);
    if ((state.phase === 'round' || state.phase === 'final') && 'grid' in shown) {
      expect(shown.grid.cells).toHaveLength(state.board.revealed.length);
    }
  });

  it('never gives the letter a question asks for', () => {
    const shown = view(withQuestion(startedRound(), 'T'));
    expect(shown).toMatchObject({ step: { kind: 'question', text: 'Question T ?' } });
    if (shown.phase === 'round') expect(shown.step).not.toHaveProperty('letter');
  });

  it('never gives the answer word of an open question', () => {
    const json = JSON.stringify(view(withQuestion(startedRound(), 'T', 'Tigre')));
    expect(json).not.toContain('Tigre');
  });

  it('gives the answer word once the letter is found', () => {
    const asked = withQuestion(startedRound(), 'T', 'Tigre');
    const found = reduce(
      play(asked, [{ type: 'buzz', team: 0 }], deps),
      {
        type: 'submitLetter',
        letter: 'T',
      },
      deps,
    );
    const message = stateMessage(toPublicView(found.state, found.events), SINGLE_PHONE_ROOM);
    expect(parseTvMessage(JSON.parse(JSON.stringify(message)))).toMatchObject({
      ok: true,
      message: { view: { lastEvents: [{ type: 'letterFound', answer: 'Tigre' }] } },
    });
  });

  it('only gives the clue of the chosen word', () => {
    const answering = roundStates[3]?.[1] ?? INITIAL_STATE;
    expect(view(answering)).toMatchObject({
      step: { kind: 'answeringWord', word: 3, clue: 'Celle de Pise penche' },
    });
    expect(JSON.stringify(view(roundStates[2]?.[1] ?? INITIAL_STATE))).not.toContain('Pise');
  });

  it('hides the letters behind the final numbers until they are all picked', () => {
    const [picking, playing] = finalStates.map(([, state]) => view(state));
    expect(picking).toMatchObject({
      phase: 'final',
      choices: 8,
      picked: [],
      letters: [],
      step: { kind: 'picking' },
    });
    expect(playing).toMatchObject({
      letters: ['H', 'A', 'T', 'I', 'E'],
      step: { kind: 'playing', current: 1 },
    });
  });

  it('builds views the phone accepts', () => {
    const over = play(startedRound(), [{ type: 'abandonGame' }], deps);
    const roundOver = play(startedRound(), [{ type: 'revealGrid' }], deps);
    for (const state of [
      INITIAL_STATE,
      ...roundStates.map(([, s]) => s),
      ...finalStates.map(([, s]) => s),
      over,
      roundOver,
    ]) {
      const message = stateMessage(view(state), SINGLE_PHONE_ROOM);
      expect(parseTvMessage(message)).toEqual({ ok: true, message });
    }
  });

  it('ranks the players at the end', () => {
    const over = play(startedRound(['A', 'B']), [{ type: 'abandonGame' }], deps);
    expect(view(over)).toMatchObject({
      phase: 'gameOver',
      ranking: [
        { team: 0, rank: 1 },
        { team: 1, rank: 1 },
      ],
      final: null,
    });
  });
});
