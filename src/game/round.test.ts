import { describe, expect, it } from 'vitest';
import { revealLetters } from './board';
import { reduce } from './reducer';
import type { GameAction, GameState, RoundState } from './state';
import { asRound, startedRound, testDeps, withQuestion } from './test-fixtures';

const deps = testDeps();

function act(state: GameState, action: GameAction) {
  return reduce(state, action, deps);
}

function then(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((current, action) => act(current, action).state, state);
}

/** Round where some letters are already shown, and the question asks for the given letter. */
function roundWith(letter: string, shown: string[] = []): RoundState {
  const state = startedRound();
  return withQuestion({ ...state, board: revealLetters(state.board, shown).board }, letter);
}

/** Player 0 found the letter and has the hand. */
function handAfter(letter: string, shown: string[] = []): RoundState {
  return asRound(
    then(roundWith(letter, shown), { type: 'buzz', team: 0 }, { type: 'submitLetter', letter }),
  );
}

const scores = (state: GameState): number[] =>
  'teams' in state ? state.teams.map((team) => team.scores[0] ?? 0) : [];

describe('start of a round', () => {
  it('draws a grid, gives everyone a score of 0 and asks a question', () => {
    const state = startedRound();
    expect(state.round).toBe(1);
    expect(state.players).toEqual([0, 1, 2]);
    expect(state.board.grid.id).toBe('r1-animals');
    expect(scores(state)).toEqual([0, 0, 0]);
    expect(state.step).toEqual({
      kind: 'question',
      question: { letter: 'A', text: 'Première question A ?', answer: 'Mot A' },
      buzzer: null,
      eliminated: [],
    });
  });
});

describe('buzz', () => {
  it('gives the floor to the first player who buzzes', () => {
    const result = act(startedRound(), { type: 'buzz', team: 1 });
    expect(asRound(result.state).step).toMatchObject({ kind: 'question', buzzer: 1 });
    expect(result.events).toEqual([{ type: 'buzzed', team: 1 }]);
  });

  it('ignores later buzzes', () => {
    const buzzed = then(startedRound(), { type: 'buzz', team: 1 });
    expect(act(buzzed, { type: 'buzz', team: 2 }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });

  it('refuses a player who is not in the round', () => {
    expect(act(startedRound(), { type: 'buzz', team: 3 }).events).toEqual([
      { type: 'actionRejected', reason: 'notPlaying' },
    ]);
  });
});

describe('letter', () => {
  it('shows a right letter everywhere in the grid, without points, and gives the hand', () => {
    const result = act(then(roundWith('T'), { type: 'buzz', team: 0 }), {
      type: 'submitLetter',
      letter: 't',
    });
    const state = asRound(result.state);
    expect(state.board.revealed).toEqual(['0,3']);
    expect(state.step).toEqual({ kind: 'choosingWord', team: 0, letter: 'T' });
    expect(scores(state)).toEqual([0, 0, 0]);
    expect(result.events).toEqual([{ type: 'letterFound', team: 0, letter: 'T' }]);
  });

  it('gives the answer word with a right letter, and with a lost one', () => {
    const asked = withQuestion(startedRound(), 'T', 'Tigre');
    const found = act(then(asked, { type: 'buzz', team: 0 }), {
      type: 'submitLetter',
      letter: 'T',
    });
    expect(found.events[0]).toEqual({ type: 'letterFound', team: 0, letter: 'T', answer: 'Tigre' });
    const lost = act(asked, { type: 'skipQuestion' });
    expect(lost.events[0]).toEqual({ type: 'letterLost', letter: 'T', answer: 'Tigre' });
  });

  it('accepts an accented letter', () => {
    const state = then(
      roundWith('E'),
      { type: 'buzz', team: 0 },
      { type: 'submitLetter', letter: 'é' },
    );
    expect(asRound(state).step.kind).toBe('choosingWord');
  });

  it.each(['', 'AB', '1', '?'])('refuses %j as a letter', (letter) => {
    const buzzed = then(roundWith('T'), { type: 'buzz', team: 0 });
    expect(act(buzzed, { type: 'submitLetter', letter }).events).toEqual([
      { type: 'actionRejected', reason: 'invalidLetter' },
    ]);
  });

  it('eliminates a wrong player from the question; the others may buzz', () => {
    const result = act(then(roundWith('T'), { type: 'buzz', team: 0 }), {
      type: 'submitLetter',
      letter: 'X',
    });
    expect(asRound(result.state).step).toMatchObject({ buzzer: null, eliminated: [0] });
    expect(result.events).toEqual([{ type: 'wrongLetter', team: 0, letter: 'X' }]);
    expect(act(result.state, { type: 'buzz', team: 0 }).events).toEqual([
      { type: 'actionRejected', reason: 'teamEliminated' },
    ]);
    expect(act(result.state, { type: 'buzz', team: 1 }).events).toEqual([
      { type: 'buzzed', team: 1 },
    ]);
  });

  it('loses the letter when every player is wrong: announced, not shown, never asked again', () => {
    const wrong = (team: number): GameAction[] => [
      { type: 'buzz', team },
      { type: 'submitLetter', letter: 'X' },
    ];
    const before = roundWith('T');
    const last = then(before, ...wrong(0), ...wrong(1), { type: 'buzz', team: 2 });
    const result = act(last, { type: 'submitLetter', letter: 'X' });
    const state = asRound(result.state);
    expect(state.board.lost).toEqual(['T']);
    expect(state.board.revealed).toEqual([]);
    expect(result.events).toEqual([
      { type: 'wrongLetter', team: 2, letter: 'X' },
      { type: 'letterLost', letter: 'T' },
      { type: 'questionAsked' },
    ]);
    expect(state.step).toMatchObject({ kind: 'question', question: { letter: 'A' } });
  });

  it('loses the letter when the master says nobody knows', () => {
    const result = act(roundWith('T'), { type: 'skipQuestion' });
    expect(asRound(result.state).board.lost).toEqual(['T']);
    expect(result.events[0]).toEqual({ type: 'letterLost', letter: 'T' });
  });

  it('does not skip while a player is answering', () => {
    const buzzed = then(roundWith('T'), { type: 'buzz', team: 0 });
    expect(act(buzzed, { type: 'skipQuestion' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });

  it('pays the letter finder for a word the letter completes', () => {
    const result = act(then(roundWith('T', ['C', 'H', 'A']), { type: 'buzz', team: 1 }), {
      type: 'submitLetter',
      letter: 'T',
    });
    expect(scores(result.state)).toEqual([0, 4, 0]);
    expect(result.events).toContainEqual({ type: 'wordFound', team: 1, word: 1, points: 4 });
    expect(asRound(result.state).step).toEqual({ kind: 'choosingWord', team: 1, letter: 'T' });
  });

  it('goes to the next question when the letter left no word to play', () => {
    const result = act(then(roundWith('T', Array.from('CHAOUR')), { type: 'buzz', team: 0 }), {
      type: 'submitLetter',
      letter: 'T',
    });
    expect(scores(result.state)).toEqual([8, 0, 0]);
    expect(result.events).toContainEqual({ type: 'noWordToPlay', team: 0 });
    expect(asRound(result.state).step).toMatchObject({
      kind: 'question',
      question: { letter: 'E' },
    });
  });
});

describe('choice of word', () => {
  it('opens the clue of a word holding the letter', () => {
    const result = act(handAfter('T'), { type: 'chooseWord', word: 3 });
    expect(asRound(result.state).step).toEqual({
      kind: 'answeringWord',
      team: 0,
      letter: 'T',
      word: 3,
    });
    expect(result.events).toEqual([{ type: 'wordChosen', team: 0, word: 3 }]);
  });

  it('refuses a word without the letter, or an unknown word', () => {
    expect(act(handAfter('T'), { type: 'chooseWord', word: 2 }).events).toEqual([
      { type: 'actionRejected', reason: 'wordNotPlayable' },
    ]);
    expect(act(handAfter('T'), { type: 'chooseWord', word: 9 }).events).toEqual([
      { type: 'actionRejected', reason: 'invalidWord' },
    ]);
  });

  it('locks the chosen word: no other word, no SLAM before proposing it', () => {
    const answering = then(handAfter('T'), { type: 'chooseWord', word: 3 });
    for (const action of [{ type: 'chooseWord', word: 1 }, { type: 'startSlam' }] as const) {
      expect(act(answering, action).events).toEqual([
        { type: 'actionRejected', reason: 'wrongPhase' },
      ]);
    }
  });
});

describe('word', () => {
  const answering = (letter: string, word: number, shown: string[] = []): GameState =>
    then(handAfter(letter, shown), { type: 'chooseWord', word });

  it('shows a right word and pays 1 point per letter, then offers a SLAM', () => {
    const result = act(answering('T', 3), { type: 'submitWord', answer: ' Tour ' });
    expect(scores(result.state)).toEqual([4, 0, 0]);
    expect(result.events).toEqual([
      { type: 'wordFound', team: 0, word: 3, points: 4 },
      { type: 'slamChance', team: 0 },
    ]);
    expect(asRound(result.state).step).toEqual({ kind: 'slamChance', team: 0 });
    expect(asRound(result.state).board.revealed).toEqual(['0,3', '1,3', '2,3', '3,3']);
  });

  it('also pays a crossing word that the right word completes', () => {
    const result = act(answering('C', 1, Array.from('HAOUR')), {
      type: 'submitWord',
      answer: 'chat',
    });
    expect(scores(result.state)).toEqual([8, 0, 0]);
    expect(result.events.slice(0, 2)).toEqual([
      { type: 'wordFound', team: 0, word: 1, points: 4 },
      { type: 'wordFound', team: 0, word: 3, points: 4 },
    ]);
  });

  it('greys a wrong word until another of its letters is shown', () => {
    const result = act(answering('T', 3), { type: 'submitWord', answer: 'tous' });
    const state = asRound(result.state);
    expect(state.board.tried).toEqual([3]);
    expect(scores(state)).toEqual([0, 0, 0]);
    expect(result.events).toEqual([
      { type: 'wrongWord', team: 0, word: 3, answer: 'tous' },
      { type: 'slamChance', team: 0 },
    ]);
    const again = then(
      withQuestion(state, 'O'),
      { type: 'buzz', team: 1 },
      { type: 'submitLetter', letter: 'O' },
    );
    expect(asRound(again).board.tried).toEqual([]);
    expect(act(again, { type: 'chooseWord', word: 3 }).events[0]?.type).toBe('wordChosen');
  });

  it('treats "Je ne sais pas" as a wrong word, then offers a SLAM', () => {
    const result = act(answering('T', 3), { type: 'passWord' });
    const state = asRound(result.state);
    expect(state.board.tried).toEqual([3]);
    expect(scores(state)).toEqual([0, 0, 0]);
    expect(state.step).toEqual({ kind: 'slamChance', team: 0 });
    expect(result.events).toEqual([
      { type: 'wordPassed', team: 0, word: 3 },
      { type: 'slamChance', team: 0 },
    ]);
  });

  it('asks the next question when the player does not slam', () => {
    const chance = then(answering('T', 3), { type: 'passWord' });
    const result = act(chance, { type: 'nextQuestion' });
    expect(asRound(result.state).step.kind).toBe('question');
    expect(result.events).toEqual([{ type: 'questionAsked' }]);
    expect(act(answering('T', 3), { type: 'nextQuestion' }).events).toEqual([
      { type: 'actionRejected', reason: 'wrongPhase' },
    ]);
  });

  it.each(['', '   ', 'A'.repeat(31)])('refuses the answer %j', (answer) => {
    expect(act(answering('T', 3), { type: 'submitWord', answer }).events).toEqual([
      { type: 'actionRejected', reason: 'invalidAnswer' },
    ]);
  });

  it('ends the round when the grid is complete', () => {
    const result = act(answering('T', 3, Array.from('CHAIEN')), {
      type: 'submitWord',
      answer: 'tour',
    });
    expect(result.state).toMatchObject({ phase: 'roundOver', outcome: 'complete' });
    expect(result.events[result.events.length - 1]).toEqual({ type: 'roundOver', round: 1 });
  });
});

describe('SLAM', () => {
  const allRight = [
    { word: 1, answer: 'chat' },
    { word: 2, answer: 'Chien' },
    { word: 3, answer: 'tour' },
  ];

  /** Player 0 proposed a word (here "Je ne sais pas"): every word is still open. */
  const chance = (): GameState =>
    then(handAfter('T'), { type: 'chooseWord', word: 3 }, { type: 'passWord' });

  it('can start once a word was proposed, before the next question', () => {
    const result = act(chance(), { type: 'startSlam' });
    expect(asRound(result.state).step).toEqual({ kind: 'slam', team: 0 });
    expect(result.events).toEqual([{ type: 'slamStarted', team: 0 }]);
  });

  it('cannot start without the hand, or before a word was proposed', () => {
    for (const state of [roundWith('T'), handAfter('T')]) {
      expect(act(state, { type: 'startSlam' }).events).toEqual([
        { type: 'actionRejected', reason: 'wrongPhase' },
      ]);
    }
  });

  it('wins every remaining point when all words are right, and ends the round', () => {
    const slam = then(chance(), { type: 'startSlam' });
    const result = act(slam, { type: 'submitSlam', answers: allRight });
    expect(scores(result.state)).toEqual([13, 0, 0]);
    expect(result.state).toMatchObject({ phase: 'roundOver', outcome: 'slam' });
    expect(result.events[0]).toEqual({ type: 'slamWon', team: 0, points: 13 });
  });

  it('gives the remaining points to each opponent when a word is wrong', () => {
    const slam = then(chance(), { type: 'startSlam' });
    const answers = [...allRight.slice(0, 2), { word: 3, answer: 'tous' }];
    const result = act(slam, { type: 'submitSlam', answers });
    expect(scores(result.state)).toEqual([0, 13, 13]);
    expect(result.state).toMatchObject({ phase: 'roundOver', outcome: 'slamFailed' });
    expect(result.events[0]).toEqual({ type: 'slamFailed', team: 0, points: 13 });
  });

  it('needs exactly one answer per remaining word', () => {
    const slam = then(chance(), { type: 'startSlam' });
    for (const answers of [allRight.slice(0, 2), [...allRight, { word: 4, answer: 'x' }]]) {
      expect(act(slam, { type: 'submitSlam', answers }).events).toEqual([
        { type: 'actionRejected', reason: 'invalidAnswer' },
      ]);
    }
  });
});

describe('last chance', () => {
  const noLetterLeft = (): RoundState => {
    const state = roundWith('T');
    return { ...state, board: { ...state.board, lost: Array.from('CHAIENOUR') } };
  };

  it('starts when no letter is left to ask', () => {
    const result = act(noLetterLeft(), { type: 'skipQuestion' });
    expect(asRound(result.state).step).toEqual({ kind: 'lastChance' });
    expect(result.events).toEqual([{ type: 'letterLost', letter: 'T' }, { type: 'lastChance' }]);
  });

  it('lets the first player who buzzes slam', () => {
    const lastChance = then(noLetterLeft(), { type: 'skipQuestion' });
    const result = act(lastChance, { type: 'buzz', team: 2 });
    expect(asRound(result.state).step).toEqual({ kind: 'slam', team: 2 });
    expect(result.events).toEqual([
      { type: 'buzzed', team: 2 },
      { type: 'slamStarted', team: 2 },
    ]);
  });
});

describe('grid correction', () => {
  it('ends the round without points', () => {
    const result = act(handAfter('T'), { type: 'revealGrid' });
    expect(result.state).toMatchObject({ phase: 'roundOver', outcome: 'corrected' });
    expect(scores(result.state)).toEqual([0, 0, 0]);
    expect(result.events).toEqual([{ type: 'gridCorrected' }, { type: 'roundOver', round: 1 }]);
  });
});
