import { findWord, type Board } from '../game/board';
import { FINAL_LETTER_PICKS, QUALIFIED_PER_ROUND } from '../game/config';
import { turnTeam } from '../game/permissions';
import { qualify } from '../game/qualification';
import { rankTeams } from '../game/ranking';
import type {
  FinalState,
  GameOverState,
  GameState,
  RoundOverState,
  RoundState,
  Team,
  TiebreakState,
} from '../game/state';
import type { LayoutOptions } from './grid-layout';
import { TV_TEXTS } from './texts';

export interface ScoreRow {
  name: string;
  /** Rank at the end of the game, empty during the game. */
  rank: string;
  score: string;
  active: boolean;
  /** Not playing at the moment: out of the game, or already answered this question. */
  faded: boolean;
  note: string;
}

export interface Pick {
  label: string;
  picked: boolean;
  /** The letter behind the number, once the picked letters are revealed. */
  letter: string;
}

/** Everything the TV game screen shows, decided from the state only. */
export interface Display {
  title: string;
  board: Board | null;
  layout: LayoutOptions;
  heading: string;
  text: string;
  lost: string[];
  scores: ScoreRow[];
  picks: Pick[];
  /** Seconds left in the final, or null. */
  timer: number | null;
}

type InGame = Exclude<GameState, { phase: 'setup' }>;

const NO_LAYOUT: LayoutOptions = { active: null, showAll: false };

function lastScore(team: Team): number {
  return team.scores[team.scores.length - 1] ?? 0;
}

function scoreRows(
  teams: readonly Team[],
  options: {
    active: number | null;
    playing: readonly number[];
    answered: readonly number[];
    offline: readonly number[];
  },
): ScoreRow[] {
  return teams.map((team, index) => {
    const out = !options.playing.includes(index);
    const answered = options.answered.includes(index);
    const note = options.offline.includes(index)
      ? TV_TEXTS.phoneOffline
      : out
        ? TV_TEXTS.out
        : answered
          ? TV_TEXTS.answered
          : '';
    return {
      name: team.name,
      rank: '',
      score: TV_TEXTS.points(lastScore(team)),
      active: index === options.active,
      faded: out || answered,
      note,
    };
  });
}

function wordCard(board: Board, number: number): { heading: string; text: string } {
  const word = findWord(board, number);
  return word === undefined
    ? { heading: '', text: '' }
    : { heading: TV_TEXTS.wordHeading(word.number, word.answer.length), text: word.clue };
}

function roundCard(
  state: RoundState,
  name: (team: number) => string,
): { heading: string; text: string } {
  const { step } = state;
  switch (step.kind) {
    case 'question':
      return {
        heading: step.buzzer === null ? TV_TEXTS.question : TV_TEXTS.buzzed(name(step.buzzer)),
        text: step.question.text,
      };
    case 'choosingWord':
      return {
        heading: TV_TEXTS.choosing(name(step.team)),
        text: TV_TEXTS.chooseWord(step.letter),
      };
    case 'answeringWord':
      return wordCard(state.board, step.word);
    case 'lastChance':
      return { heading: TV_TEXTS.lastChance, text: TV_TEXTS.lastChanceText };
    case 'slam':
      return { heading: TV_TEXTS.slam, text: TV_TEXTS.slamText(name(step.team)) };
  }
}

function roundDisplay(state: RoundState, offline: readonly number[]): Display {
  const name = (team: number): string => state.teams[team]?.name ?? '';
  const { step } = state;
  const active = step.kind === 'answeringWord' ? step.word : null;
  return {
    title: TV_TEXTS.round(state.round),
    board: state.board,
    layout: { active, showAll: false },
    ...roundCard(state, name),
    lost: state.board.lost,
    scores: scoreRows(state.teams, {
      active: turnTeam(state),
      playing: state.players,
      answered: step.kind === 'question' ? step.eliminated : [],
      offline,
    }),
    picks: [],
    timer: null,
  };
}

/** Who goes on, or who plays the tiebreak, as the master will see after "Manche suivante". */
function nextStepText(state: RoundOverState): string {
  const names = (teams: readonly number[]): string[] =>
    teams.map((team) => state.teams[team]?.name ?? '');
  const spots = QUALIFIED_PER_ROUND[state.round - 1] ?? 1;
  const result = qualify(state.teams, state.players, state.round, spots);
  if (result.contenders.length > 0) return TV_TEXTS.tiebreakBetween(names(result.contenders));
  return spots === 1
    ? TV_TEXTS.finalist(names(result.qualified)[0] ?? '')
    : TV_TEXTS.qualified(names(result.qualified));
}

function roundOverDisplay(state: RoundOverState, offline: readonly number[]): Display {
  return {
    title: TV_TEXTS.roundOver(state.round),
    board: state.board,
    layout: { active: null, showAll: true },
    heading: TV_TEXTS.outcome(state.outcome),
    text: nextStepText(state),
    lost: [],
    scores: scoreRows(state.teams, { active: null, playing: state.players, answered: [], offline }),
    picks: [],
    timer: null,
  };
}

function tiebreakDisplay(state: TiebreakState, offline: readonly number[]): Display {
  const buzzer = state.buzzer === null ? null : (state.teams[state.buzzer]?.name ?? '');
  return {
    title: TV_TEXTS.tiebreak,
    board: null,
    layout: NO_LAYOUT,
    heading: buzzer === null ? TV_TEXTS.question : TV_TEXTS.buzzed(buzzer),
    text: state.question.text,
    lost: [],
    scores: scoreRows(state.teams, {
      active: state.buzzer,
      playing: state.contenders,
      answered: state.eliminated,
      offline,
    }),
    picks: [],
    timer: null,
  };
}

/** No clue in the final: only the theme, and the word the finalist is typing. */
function finalHeading(board: Board, finalist: string, selected: number | null): string {
  const word = selected === null ? undefined : findWord(board, selected);
  return word === undefined
    ? TV_TEXTS.finalChoosing(finalist)
    : TV_TEXTS.finalTrying(finalist, word.number, word.answer.length);
}

function finalDisplay(state: FinalState, offline: readonly number[]): Display {
  const { step } = state;
  const revealed = step.kind === 'playing';
  const finalist = state.teams[state.finalist]?.name ?? '';
  const card = revealed
    ? { heading: finalHeading(state.board, finalist, step.selected), text: state.board.grid.theme }
    : { heading: TV_TEXTS.finalPicking(finalist), text: TV_TEXTS.pickNumbers(FINAL_LETTER_PICKS) };
  return {
    title: TV_TEXTS.final(state.board.grid.theme),
    board: state.board,
    layout: { active: revealed ? step.selected : null, showAll: false },
    ...card,
    lost: [],
    // Round points no longer matter in the final: only who plays it.
    scores: scoreRows(state.teams, {
      active: state.finalist,
      playing: [state.finalist],
      answered: [],
      offline,
    }).map((row) => ({ ...row, score: '' })),
    picks: state.letters.map((letter, index) => ({
      label: String(index + 1),
      picked: state.picked.includes(index),
      letter: revealed && state.picked.includes(index) ? letter : '',
    })),
    timer: revealed && step.remainingMs !== null ? Math.ceil(step.remainingMs / 1000) : null,
  };
}

function gameOverDisplay(state: GameOverState): Display {
  const final = state.final;
  const finalist = final === null ? '' : (state.teams[final.finalist]?.name ?? '');
  const ranking = rankTeams(state.teams, final?.finalist ?? null);
  const scores = ranking.map(({ team, rank }) => {
    const current = state.teams[team];
    const won = final !== null && team === final.finalist;
    return {
      name: current?.name ?? '',
      rank: TV_TEXTS.rank(rank),
      score: won
        ? TV_TEXTS.prize(final.prize)
        : TV_TEXTS.points(current === undefined ? 0 : lastScore(current)),
      active: rank === 1,
      faded: false,
      note: '',
    };
  });
  return {
    title: TV_TEXTS.ranking,
    board: final?.board ?? null,
    layout: { active: null, showAll: true },
    heading:
      final === null
        ? TV_TEXTS.abandoned
        : final.complete
          ? TV_TEXTS.finalJackpot(finalist, final.prize)
          : TV_TEXTS.finalWon(finalist, final.prize),
    text:
      final === null ? '' : TV_TEXTS.wordsFound(final.wordsFound, final.board.grid.words.length),
    lost: [],
    scores,
    picks: [],
    timer: null,
  };
}

/** offline: players whose phone is disconnected, with one phone per player. */
export function describeDisplay(state: InGame, offline: readonly number[] = []): Display {
  switch (state.phase) {
    case 'round':
      return roundDisplay(state, offline);
    case 'roundOver':
      return roundOverDisplay(state, offline);
    case 'tiebreak':
      return tiebreakDisplay(state, offline);
    case 'final':
      return finalDisplay(state, offline);
    case 'gameOver':
      return gameOverDisplay(state);
  }
}
