import type { RoomView } from '../protocol/room';
import type { GridView, PublicView } from '../protocol/view';

/** Why a phone waits instead of playing. */
export type WaitReason = 'answering' | 'choosing' | 'slamming' | 'finalist' | 'eliminated' | 'out';

/** What the phone shows, decided from the view, the room and whether it may play the turn. */
export type Screen =
  | { kind: 'chooseMode' }
  | { kind: 'waitForMode' }
  | { kind: 'singleSetup' }
  | { kind: 'multiLobby' }
  /** Buzz buttons for these players. slam: the buzz starts a SLAM (last chance). */
  | { kind: 'buzz'; teams: number[]; slam: boolean }
  | { kind: 'letter' }
  | { kind: 'chooseWord' }
  | { kind: 'answerWord' }
  | { kind: 'slam' }
  | { kind: 'pickNumbers' }
  | { kind: 'finalWord' }
  | { kind: 'wait'; reason: WaitReason; team: number | null }
  | { kind: 'roundOver' }
  | { kind: 'ranking' };

type InGame = Exclude<PublicView, { phase: 'setup' }>;

/** Player who has the hand, or null when nobody has it. */
export function activeTeam(view: PublicView): number | null {
  switch (view.phase) {
    case 'round': {
      const { step } = view;
      if (step.kind === 'question') return step.buzzer;
      return step.kind === 'lastChance' ? null : step.team;
    }
    case 'tiebreak':
      return view.buzzer;
    case 'final':
      return view.finalist;
    case 'setup':
    case 'roundOver':
    case 'gameOver':
      return null;
  }
}

function isConnected(room: RoomView, team: number): boolean {
  return room.seats[team]?.connected ?? false;
}

/**
 * One phone: it plays for everyone. One phone per player: its own turn, or the
 * turn of a disconnected player the master chose to play for.
 */
export function canPlayFor(
  team: number | null,
  room: RoomView,
  standingIn: number | null,
): boolean {
  if (team === null) return false;
  if (room.mode !== 'multi' || room.team === team) return true;
  return room.isMaster && standingIn === team && !isConnected(room, team);
}

/** The master may offer to play for the player who has the hand, if that phone is gone. */
export function standInOffer(view: PublicView, room: RoomView): number | null {
  const team = activeTeam(view);
  if (room.mode !== 'multi' || !room.isMaster || team === null || team === room.team) return null;
  return isConnected(room, team) ? null : team;
}

/** Players who may buzz right now. */
function buzzers(view: InGame): { teams: number[]; slam: boolean } | null {
  if (view.phase === 'round') {
    const { step } = view;
    if (step.kind === 'lastChance') return { teams: view.players, slam: true };
    if (step.kind === 'question' && step.buzzer === null) {
      return { teams: view.players.filter((p) => !step.eliminated.includes(p)), slam: false };
    }
  }
  if (view.phase === 'tiebreak' && view.buzzer === null) {
    return { teams: view.contenders.filter((c) => !view.eliminated.includes(c)), slam: false };
  }
  return null;
}

function buzzScreen(
  view: InGame,
  room: RoomView,
  open: { teams: number[]; slam: boolean },
): Screen {
  if (room.mode !== 'multi') return { kind: 'buzz', ...open };
  const own = room.team;
  if (own !== null && open.teams.includes(own))
    return { kind: 'buzz', teams: [own], slam: open.slam };
  const playing =
    view.phase === 'round' ? view.players : view.phase === 'tiebreak' ? view.contenders : [];
  const reason: WaitReason = own !== null && playing.includes(own) ? 'eliminated' : 'out';
  return { kind: 'wait', reason, team: null };
}

/** The screen of the player with the hand, and what the others are told meanwhile. */
function turnScreen(view: InGame): { screen: Screen; reason: WaitReason } | null {
  if (view.phase === 'round') {
    switch (view.step.kind) {
      case 'question':
        return { screen: { kind: 'letter' }, reason: 'answering' };
      case 'choosingWord':
        return { screen: { kind: 'chooseWord' }, reason: 'choosing' };
      case 'answeringWord':
        return { screen: { kind: 'answerWord' }, reason: 'answering' };
      case 'slam':
        return { screen: { kind: 'slam' }, reason: 'slamming' };
      case 'lastChance':
        return null;
    }
  }
  if (view.phase === 'tiebreak') return { screen: { kind: 'letter' }, reason: 'answering' };
  if (view.phase === 'final') {
    const screen: Screen =
      view.step.kind === 'picking' ? { kind: 'pickNumbers' } : { kind: 'finalWord' };
    return { screen, reason: 'finalist' };
  }
  return null;
}

export function describeScreen(
  view: PublicView,
  room: RoomView,
  standingIn: number | null = null,
): Screen {
  if (view.phase === 'setup') {
    if (room.mode === null) return room.isMaster ? { kind: 'chooseMode' } : { kind: 'waitForMode' };
    return room.mode === 'single' ? { kind: 'singleSetup' } : { kind: 'multiLobby' };
  }
  if (view.phase === 'roundOver') return { kind: 'roundOver' };
  if (view.phase === 'gameOver') return { kind: 'ranking' };
  const open = buzzers(view);
  if (open !== null) return buzzScreen(view, room, open);
  const turn = turnScreen(view);
  const team = activeTeam(view);
  if (turn === null) return { kind: 'wait', reason: 'out', team };
  return canPlayFor(team, room, standingIn)
    ? turn.screen
    : { kind: 'wait', reason: turn.reason, team };
}

/** With one phone per player, the master may start once it joined, with enough players. */
export function canStartMultiGame(room: RoomView, minPlayers: number): boolean {
  return room.isMaster && room.team !== null && room.seats.length >= minPlayers;
}

/** The letters of a word already shown, '' for each hidden one. */
export function wordPattern(grid: GridView, number: number): string[] {
  const word = grid.words.find((candidate) => candidate.number === number);
  if (word === undefined) return [];
  return Array.from({ length: word.length }, (_, index) => {
    const row = word.row + (word.direction === 'down' ? index : 0);
    const col = word.col + (word.direction === 'across' ? index : 0);
    return grid.cells.find((cell) => cell.row === row && cell.col === col)?.letter ?? '';
  });
}
