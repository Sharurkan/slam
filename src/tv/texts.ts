import { DEFAULT_TEAM_NAME_PREFIX } from '../game/config';
import type { GameEvent } from '../game/events';
import type { RoundOutcome } from '../game/state';
import type { ConnectionStatus } from '../net/connection-status';
import { splitAnswer, type AnswerParts } from '../shared/text';

const euros = (amount: number): string => `${amount.toLocaleString('fr-FR')} €`;
const points = (score: number): string =>
  score > 1 ? `${String(score)} points` : `${String(score)} point`;

/** "A", "A et B", "A, B et C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1] ?? ''}`;
}

const OUTCOMES: Record<RoundOutcome, string> = {
  complete: 'Grille complète !',
  slam: 'SLAM réussi !',
  slamFailed: 'SLAM raté : la grille est corrigée.',
  corrected: 'La grille est corrigée.',
};

export const TV_TEXTS = {
  title: 'Lettre à Lettre',
  roomCode: (code: string) => `Salle ${code}`,
  scanToPlay: 'Scanne le QR code avec le téléphone',
  orOpen: 'ou ouvre :',
  lobby: {
    choosing: 'Le premier téléphone connecté choisit le mode de jeu',
    single: 'Un seul téléphone : entre les noms des joueurs dessus',
    multi: 'Un téléphone par joueur : scannez le QR code et entrez votre nom',
    noTeam: "Aucun joueur pour l'instant",
    connected: 'connecté',
    disconnected: 'déconnecté',
  },
  seatName: (name: string, index: number) =>
    name === '' ? `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}` : name,
  round: (round: number) => `Manche ${String(round)}`,
  roundOver: (round: number) => `Fin de la manche ${String(round)}`,
  tiebreak: 'Départage',
  final: (theme: string) => `Finale · ${theme}`,
  ranking: 'Classement final',
  question: 'Question',
  buzzed: (name: string) => `${name} a buzzé !`,
  choosing: (name: string) => `${name} a la main`,
  chooseWord: (letter: string) => `Choisis un mot avec la lettre ${letter}, ou fais un SLAM`,
  wordHeading: (number: number, length: number) =>
    `Mot n° ${String(number)} · ${String(length)} lettres`,
  lastChance: 'Dernière chance',
  lastChanceText: 'Plus aucune lettre à trouver : le premier qui buzze fait un SLAM !',
  slam: 'SLAM !',
  slamText: (name: string) => `${name} remplit toute la grille…`,
  outcome: (outcome: RoundOutcome) => OUTCOMES[outcome],
  qualified: (names: readonly string[]) => `En manche 2 : ${listNames(names)}`,
  finalist: (name: string) => `En finale : ${name}`,
  tiebreakBetween: (names: readonly string[]) => `Départage entre ${listNames(names)}`,
  pickNumbers: (count: number) => `Choisis ${String(count)} numéros : chacun cache une lettre`,
  finalPicking: (name: string) => `${name} joue la finale`,
  lost: 'Lettres perdues',
  out: 'éliminé',
  answered: 'a répondu',
  phoneOffline: 'déconnecté',
  points,
  seconds: (value: number) => `${String(value)} s`,
  finalWon: (name: string, prize: number) => `${name} gagne ${euros(prize)}`,
  finalJackpot: (name: string, prize: number) => `Grille complète ! ${name} gagne ${euros(prize)}`,
  wordsFound: (count: number, total: number) =>
    `${String(count)} mot${count > 1 ? 's' : ''} sur ${String(total)}`,
  abandoned: 'Partie abandonnée',
  prize: euros,
  rank: (rank: number) => (rank === 1 ? '1er' : `${String(rank)}e`),
  slamBanner: 'SLAM !',
  soundButton: 'Appuie sur OK pour activer le son',
  soundHint: 'Son coupé : appuie sur OK',
  soundOn: 'Son activé',
  storageFailed: 'Sauvegarde impossible : le code changera au rechargement',
  saveFailed: 'Sauvegarde impossible : un rechargement perdra les joueurs',
  gameSaveFailed: 'Sauvegarde impossible : un rechargement perdra la partie',
  saveUnreadable: 'Partie sauvegardée illisible : nouvelle partie',
  gameResumed: 'Partie reprise',
  offline: 'Pas de connexion Internet : vérifie le Wi-Fi de la TV',
  updateController: 'Un téléphone a une autre version : mets à jour sa page',
} as const;

const STATUS_LABELS: Record<ConnectionStatus['kind'], string> = {
  waiting: 'En attente des téléphones',
  connected: 'Téléphone connecté',
  disconnected: 'Téléphone déconnecté',
  error: 'Erreur de connexion',
};

const ERROR_DETAILS: Record<string, string> = {
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
  'socket-error': 'connexion au serveur PeerJS perdue',
  'socket-closed': 'connexion au serveur PeerJS perdue',
  'unavailable-id': 'code déjà pris, nouvel essai',
  'browser-incompatible': 'navigateur incompatible avec WebRTC',
};

export function statusLabel(status: ConnectionStatus): string {
  const detail = status.kind === 'error' ? ERROR_DETAILS[status.reason] : undefined;
  return detail === undefined
    ? STATUS_LABELS[status.kind]
    : `${STATUS_LABELS[status.kind]} : ${detail}`;
}

export interface EventContext {
  teamName(team: number): string;
  /** The answer of a word, once it may be shown. */
  wordAnswer(word: number): string;
}

/** A banner line; reveal is the answer word, its letter highlighted, put after the text. */
export interface BannerMessage {
  text: string;
  reveal?: AnswerParts;
}

const plain = (text: string): BannerMessage => ({ text });

/** The answer word in capitals, or the letter alone when the question has no word. */
function revealed(event: { letter: string; answer?: string | undefined }): AnswerParts {
  const parts = event.answer === undefined ? null : splitAnswer(event.answer, event.letter);
  if (parts === null) return { before: '', letter: event.letter, after: '' };
  return {
    before: parts.before.toUpperCase(),
    letter: parts.letter.toUpperCase(),
    after: parts.after.toUpperCase(),
  };
}

/** Banner message for an event, or null when the event is not worth a message. */
export function eventMessage(event: GameEvent, ctx: EventContext): BannerMessage | null {
  switch (event.type) {
    case 'roundStarted':
      return plain(`Manche ${String(event.round)} : à vos buzzers !`);
    case 'letterFound':
      return { text: `Bonne lettre pour ${ctx.teamName(event.team)} : `, reveal: revealed(event) };
    case 'wrongLetter':
      return plain(`${event.letter} : raté pour ${ctx.teamName(event.team)}`);
    case 'letterLost':
      return { text: "Personne n'a trouvé : c'était ", reveal: revealed(event) };
    case 'noWordToPlay':
      return plain(`Plus de mot à jouer avec cette lettre`);
    case 'wordFound':
      return plain(
        `${ctx.teamName(event.team)} trouve ${ctx.wordAnswer(event.word)} : +${points(event.points)}`,
      );
    case 'wrongWord':
      return plain(`« ${event.answer} » : raté pour ${ctx.teamName(event.team)}`);
    case 'lastChance':
      return plain('Dernière chance : le premier qui buzze fait un SLAM !');
    case 'slamStarted':
      return plain(`${ctx.teamName(event.team)} tente le SLAM !`);
    case 'slamWon':
      return plain(`SLAM réussi ! ${ctx.teamName(event.team)} gagne ${points(event.points)}`);
    case 'slamFailed':
      return plain(`SLAM raté ! Les adversaires gagnent ${points(event.points)} chacun`);
    case 'gridCorrected':
      return plain('La grille est corrigée');
    case 'tiebreakStarted':
      return plain('Égalité : question de départage !');
    case 'tiebreakWon':
      return plain(`${ctx.teamName(event.team)} remporte le départage`);
    case 'finalStarted':
      return plain(`${ctx.teamName(event.finalist)} joue la finale !`);
    case 'finalLettersRevealed':
      return plain(`Lettres choisies : ${event.letters.join(' ')}`);
    case 'finalWordFound':
      return plain(`Bravo : ${ctx.wordAnswer(event.word)} !`);
    case 'finalWrongWord':
      return plain(`« ${event.answer} » : non`);
    case 'finalOver':
      return plain(event.complete ? 'Grille complète !' : 'Temps écoulé !');
    case 'gameStarted':
    case 'questionAsked':
    case 'buzzed':
    case 'wordChosen':
    case 'roundOver':
    case 'qualified':
    case 'finalNumberPicked':
    case 'finalWordPassed':
    case 'gameOver':
    case 'actionRejected':
      return null;
  }
}
