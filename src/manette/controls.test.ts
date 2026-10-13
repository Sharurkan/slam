import { describe, expect, it } from 'vitest';
import type { GameAction, GameState } from '../game/state';
import { INITIAL_STATE } from '../game/state';
import { play, startedRound, testDeps, withQuestion } from '../game/test-fixtures';
import { SINGLE_PHONE_ROOM, type RoomView } from '../protocol/room';
import { toPublicView, type PublicView } from '../protocol/view';
import {
  activeTeam,
  canPlayFor,
  canStartMultiGame,
  blankCount,
  describeScreen,
  fillPattern,
  standInOffer,
  wordPattern,
} from './controls';

const deps = testDeps();
const setup: PublicView = { phase: 'setup', lastEvents: [] };
const noMode: RoomView = { mode: null, isMaster: true, team: null, seats: [] };

function seats(connected: boolean[] = [true, true, true]): RoomView['seats'] {
  return connected.map((isOn, i) => ({ name: `J${String(i + 1)}`, connected: isOn }));
}

function multi(team: number | null, isMaster = false, connected?: boolean[]): RoomView {
  return { mode: 'multi', isMaster, team, seats: seats(connected) };
}

function view(state: GameState): PublicView {
  return toPublicView(state, []);
}

const question = withQuestion(startedRound(), 'T');
const after = (...actions: GameAction[]): PublicView => view(play(question, actions, deps));
const bobBuzzed = after({ type: 'buzz', team: 1 });
const bobHasHand = after({ type: 'buzz', team: 1 }, { type: 'submitLetter', letter: 'T' });

describe('describeScreen before the game', () => {
  it('lets only the master choose the mode', () => {
    expect(describeScreen(setup, noMode)).toEqual({ kind: 'chooseMode' });
    expect(describeScreen(setup, { ...noMode, isMaster: false })).toEqual({ kind: 'waitForMode' });
  });

  it('shows the setup of the chosen mode', () => {
    expect(describeScreen(setup, SINGLE_PHONE_ROOM)).toEqual({ kind: 'singleSetup' });
    expect(describeScreen(setup, multi(1))).toEqual({ kind: 'multiLobby' });
  });
});

describe('describeScreen during a question', () => {
  it('shows a buzz button per player with one phone', () => {
    expect(describeScreen(view(question), SINGLE_PHONE_ROOM)).toEqual({
      kind: 'buzz',
      teams: [0, 1, 2],
      slam: false,
    });
  });

  it("shows the phone's own BUZZ with one phone per player", () => {
    expect(describeScreen(view(question), multi(2))).toEqual({
      kind: 'buzz',
      teams: [2],
      slam: false,
    });
  });

  it('greys a player who already answered', () => {
    const wrong = after({ type: 'buzz', team: 1 }, { type: 'submitLetter', letter: 'X' });
    expect(describeScreen(wrong, multi(1))).toEqual({
      kind: 'wait',
      reason: 'eliminated',
      team: null,
    });
    expect(describeScreen(wrong, SINGLE_PHONE_ROOM)).toEqual({
      kind: 'buzz',
      teams: [0, 2],
      slam: false,
    });
  });

  it('gives the keyboard to the buzzer only', () => {
    expect(describeScreen(bobBuzzed, multi(1))).toEqual({ kind: 'letter' });
    expect(describeScreen(bobBuzzed, multi(2))).toEqual({
      kind: 'wait',
      reason: 'answering',
      team: 1,
    });
    expect(describeScreen(bobBuzzed, SINGLE_PHONE_ROOM)).toEqual({ kind: 'letter' });
  });
});

describe('describeScreen with the hand', () => {
  it('lets the player choose a word, the others wait', () => {
    expect(describeScreen(bobHasHand, multi(1))).toEqual({ kind: 'chooseWord' });
    expect(describeScreen(bobHasHand, multi(0, true))).toEqual({
      kind: 'wait',
      reason: 'choosing',
      team: 1,
    });
  });

  it('shows the word input, the SLAM offer, then the SLAM input', () => {
    const answering = after(
      { type: 'buzz', team: 1 },
      { type: 'submitLetter', letter: 'T' },
      { type: 'chooseWord', word: 3 },
    );
    expect(describeScreen(answering, multi(1))).toEqual({ kind: 'answerWord' });
    const chance = after(
      { type: 'buzz', team: 1 },
      { type: 'submitLetter', letter: 'T' },
      { type: 'chooseWord', word: 3 },
      { type: 'passWord' },
    );
    expect(describeScreen(chance, multi(1))).toEqual({ kind: 'slamChance' });
    expect(describeScreen(chance, multi(2))).toEqual({ kind: 'wait', reason: 'deciding', team: 1 });
    const slam = after(
      { type: 'buzz', team: 1 },
      { type: 'submitLetter', letter: 'T' },
      { type: 'chooseWord', word: 3 },
      { type: 'passWord' },
      { type: 'startSlam' },
    );
    expect(describeScreen(slam, multi(1))).toEqual({ kind: 'slam' });
    expect(describeScreen(slam, multi(2))).toEqual({ kind: 'wait', reason: 'slamming', team: 1 });
  });
});

describe('standing in for a disconnected player', () => {
  const masterRoom = multi(0, true, [true, false, true]);

  it('is offered to the master when the player with the hand is disconnected', () => {
    expect(standInOffer(bobHasHand, masterRoom)).toBe(1);
    expect(standInOffer(bobHasHand, multi(0, true))).toBeNull();
    expect(standInOffer(bobHasHand, multi(2, false, [true, false, true]))).toBeNull();
  });

  it('lets the master play once chosen', () => {
    expect(describeScreen(bobHasHand, masterRoom, 1)).toEqual({ kind: 'chooseWord' });
    expect(canPlayFor(1, masterRoom, null)).toBe(false);
    expect(canPlayFor(1, multi(0, true), 1)).toBe(false);
  });
});

describe('describeScreen in the last chance, the final and after', () => {
  it('turns the buzz into a SLAM in the last chance', () => {
    const state = { ...question, board: { ...question.board, lost: Array.from('CHAIENOUR') } };
    const last = view(play(state, [{ type: 'skipQuestion' }], deps));
    expect(describeScreen(last, multi(0))).toEqual({ kind: 'buzz', teams: [0], slam: true });
  });

  it('lets only the finalist play the final', () => {
    const final = play(
      INITIAL_STATE,
      [{ type: 'startGame', teamNames: ['A', 'B'], firstRound: 3 }],
      deps,
    );
    expect(describeScreen(view(final), multi(0))).toEqual({ kind: 'pickNumbers' });
    expect(describeScreen(view(final), multi(1))).toEqual({
      kind: 'wait',
      reason: 'finalist',
      team: 0,
    });
    const picks: GameAction[] = [0, 1, 2, 3, 4].map((index) => ({
      type: 'pickFinalNumber',
      index,
    }));
    expect(describeScreen(view(play(final, picks, deps)), multi(0))).toEqual({ kind: 'finalWord' });
  });

  it('shows the scores between rounds and the ranking at the end', () => {
    expect(describeScreen(view(play(question, [{ type: 'revealGrid' }], deps)), multi(0))).toEqual({
      kind: 'roundOver',
    });
    expect(describeScreen(view(play(question, [{ type: 'abandonGame' }], deps)), multi(0))).toEqual(
      { kind: 'ranking' },
    );
  });

  it('knows who has the hand', () => {
    expect(activeTeam(view(question))).toBeNull();
    expect(activeTeam(bobBuzzed)).toBe(1);
    expect(activeTeam(bobHasHand)).toBe(1);
  });
});

describe('wordPattern', () => {
  it('shows the letters already in the grid', () => {
    if (bobHasHand.phase !== 'round') throw new Error('Expected a round');
    expect(wordPattern(bobHasHand.grid, 3)).toEqual(['T', '', '', '']);
    expect(wordPattern(bobHasHand.grid, 2)).toEqual(['', '', '', '', '']);
    expect(wordPattern(bobHasHand.grid, 9)).toEqual([]);
  });
});

describe('fillPattern', () => {
  it('puts the typed letters in the blanks, in order', () => {
    expect(fillPattern(['T', '', 'R', ''], 'ae')).toEqual(['T', 'A', 'R', 'E']);
    expect(fillPattern(['T', '', 'R', ''], 'é')).toEqual(['T', 'E', 'R', '']);
    expect(fillPattern(['', ''], 'a-b c')).toEqual(['A', 'B']);
  });

  it('counts the blanks', () => {
    expect(blankCount(['T', '', 'R', ''])).toBe(2);
  });
});

describe('canStartMultiGame', () => {
  it('needs the master, seated, with enough players', () => {
    expect(canStartMultiGame(multi(0, true), 2)).toBe(true);
    expect(canStartMultiGame(multi(1), 2)).toBe(false);
    expect(canStartMultiGame(multi(null, true), 2)).toBe(false);
    expect(canStartMultiGame(multi(0, true), 4)).toBe(false);
  });
});
