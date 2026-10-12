import { describe, expect, it } from 'vitest';
import type { GameAction, GameState, RoundOverState } from '../game/state';
import { INITIAL_STATE } from '../game/state';
import { play, startedRound, testDeps, withQuestion } from '../game/test-fixtures';
import { describeDisplay } from './game-display';
import { eventMessage, listNames } from './texts';

const deps = testDeps();

function display(state: GameState, offline: number[] = []) {
  if (state.phase === 'setup') throw new Error('No display during the setup');
  return describeDisplay(state, offline);
}

function roundOver(scores: number[]): RoundOverState {
  const state = play(startedRound(['Alice', 'Bob', 'Chloé']), [{ type: 'revealGrid' }], deps);
  if (state.phase !== 'roundOver') throw new Error('Expected the end of the round');
  return { ...state, teams: state.teams.map((team, i) => ({ ...team, scores: [scores[i] ?? 0] })) };
}

describe('describeDisplay during a round', () => {
  const question = withQuestion(startedRound(), 'T');

  it('shows the question, never its letter', () => {
    const shown = display(question);
    expect(shown).toMatchObject({
      title: 'Manche 1',
      heading: 'Question',
      text: 'Question T ?',
      timer: null,
    });
    expect(JSON.stringify(shown.scores)).not.toContain('"T"');
  });

  it('shows who buzzed and greys the players who already answered', () => {
    const buzzed = play(
      question,
      [
        { type: 'buzz', team: 0 },
        { type: 'submitLetter', letter: 'X' },
        { type: 'buzz', team: 1 },
      ],
      deps,
    );
    const shown = display(buzzed);
    expect(shown.heading).toBe('Bob a buzzé !');
    expect(shown.scores.map((row) => [row.active, row.faded, row.note])).toEqual([
      [false, true, 'a répondu'],
      [true, false, ''],
      [false, false, ''],
    ]);
  });

  it('shows the clue of the chosen word and highlights it', () => {
    const answering = play(
      question,
      [
        { type: 'buzz', team: 0 },
        { type: 'submitLetter', letter: 'T' },
        { type: 'chooseWord', word: 3 },
      ],
      deps,
    );
    expect(display(answering)).toMatchObject({
      heading: 'Mot n° 3 · 4 lettres',
      text: 'Celle de Pise penche',
      layout: { active: 3, showAll: false },
    });
  });

  it('marks disconnected players', () => {
    expect(display(question, [2]).scores[2]?.note).toBe('déconnecté');
  });
});

describe('describeDisplay at the end of a round', () => {
  it('shows the whole grid and who goes on', () => {
    expect(display(roundOver([10, 3, 8]))).toMatchObject({
      title: 'Fin de la manche 1',
      heading: 'La grille est corrigée.',
      text: 'En manche 2 : Alice et Chloé',
      layout: { showAll: true },
    });
  });

  it('announces a tiebreak', () => {
    expect(display(roundOver([10, 5, 5])).text).toBe('Départage entre Bob et Chloé');
  });
});

describe('describeDisplay during the final', () => {
  const final = play(
    INITIAL_STATE,
    [{ type: 'startGame', teamNames: ['Alice', 'Bob'], firstRound: 3 }],
    deps,
  );
  const picks: GameAction[] = [0, 1, 2, 3, 4].map((index) => ({ type: 'pickFinalNumber', index }));

  it('hides the letters behind the numbers while picking', () => {
    const shown = display(play(final, picks.slice(0, 2), deps));
    expect(shown.title).toBe('Finale · Animaux');
    expect(shown.picks.map((pick) => [pick.label, pick.picked, pick.letter])).toEqual([
      ['1', true, ''],
      ['2', true, ''],
      ['3', false, ''],
      ['4', false, ''],
      ['5', false, ''],
      ['6', false, ''],
      ['7', false, ''],
      ['8', false, ''],
    ]);
  });

  it('shows the picked letters, the clue and the timer once playing', () => {
    const shown = display(play(final, picks, deps));
    expect(shown.picks.filter((pick) => pick.letter !== '')).toHaveLength(5);
    expect(shown).toMatchObject({ heading: 'Mot n° 1 · 4 lettres', text: 'Il miaule', timer: 60 });
    expect(shown.scores.map((row) => row.score)).toEqual(['', '']);
  });
});

describe('describeDisplay at the end of the game', () => {
  it('ranks the players and shows the winnings', () => {
    const final = play(
      INITIAL_STATE,
      [{ type: 'startGame', teamNames: ['Alice', 'Bob'], firstRound: 3 }],
      deps,
    );
    const picks: GameAction[] = [0, 1, 2, 3, 4].map((index) => ({
      type: 'pickFinalNumber',
      index,
    }));
    const won = play(
      final,
      [
        ...picks,
        ...['chat', 'chien', 'tour'].map((answer): GameAction => ({
          type: 'submitFinalWord',
          answer,
        })),
      ],
      deps,
    );
    const shown = display(won);
    // French number format: a non-breaking space between thousands.
    expect(shown.heading).toMatch(/^Grille complète ! Alice gagne 2\s000 €$/);
    expect(shown.scores[0]).toMatchObject({ rank: '1er', name: 'Alice' });
    expect(shown.scores[0]?.score).toMatch(/^2\s000 €$/);
  });

  it('says when the game was abandoned', () => {
    expect(display(play(startedRound(), [{ type: 'abandonGame' }], deps))).toMatchObject({
      heading: 'Partie abandonnée',
      board: null,
    });
  });
});

describe('texts', () => {
  it('lists names in French', () => {
    expect(listNames(['A'])).toBe('A');
    expect(listNames(['A', 'B', 'C'])).toBe('A, B et C');
  });

  it('describes a found word with its answer', () => {
    const ctx = { teamName: () => 'Bob', wordAnswer: () => 'TOUR' };
    expect(eventMessage({ type: 'wordFound', team: 1, word: 3, points: 4 }, ctx)).toBe(
      'Bob trouve TOUR : +4 points',
    );
    expect(eventMessage({ type: 'questionAsked' }, ctx)).toBeNull();
  });
});
