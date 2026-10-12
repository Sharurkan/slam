import { DEFAULT_TEAM_NAME_PREFIX } from '../game/config';
import type { GameEvent, RejectionReason } from '../game/events';
import type { ConnectionStatus } from '../net/connection-status';
import type { WaitReason } from './controls';

const points = (score: number): string =>
  score > 1 ? `${String(score)} points` : `${String(score)} point`;
const euros = (amount: number): string => `${amount.toLocaleString('fr-FR')} €`;

const WAITING: Record<WaitReason, (name: string) => string> = {
  answering: (name) => `C'est à ${name} de répondre`,
  choosing: (name) => `${name} choisit un mot`,
  slamming: (name) => `${name} tente le SLAM !`,
  finalist: (name) => `${name} joue la finale`,
  eliminated: () => 'Tu as déjà répondu à cette question',
  out: () => 'Regarde la TV',
};

export const PHONE_TEXTS = {
  title: 'Manette',
  codeLabel: 'Code affiché sur la TV',
  codePlaceholder: 'ABCD',
  connect: 'Se connecter',
  invalidCode: 'Code invalide : 4 lettres, comme sur la TV.',
  room: (code: string) => `Salle ${code}`,
  changeCode: 'Changer de code',
  codeNotRemembered: 'Code non mémorisé sur ce téléphone : garde le lien ou le QR code.',
  updatePage: 'La TV a une autre version : mets à jour la page.',
  offline: 'Pas de connexion Internet : vérifie le Wi-Fi du téléphone.',
  setupTitle: 'Nouvelle partie',
  chooseMode: 'Comment jouez-vous ?',
  singleMode: 'Un seul téléphone',
  singleModeHint: 'On se passe le téléphone. Pour buzzer, on crie !',
  multiMode: 'Un téléphone par joueur',
  multiModeHint: 'Chaque joueur scanne le QR code de la TV avec son téléphone.',
  masterChoosesMode: 'Le premier téléphone connecté choisit le mode de jeu.',
  toMultiMode: 'Passer à un téléphone par joueur',
  toSingleMode: 'Passer à un seul téléphone',
  playerCount: 'Nombre de joueurs',
  playerPlaceholder: (index: number) => `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}`,
  start: 'Commencer',
  ownName: 'Ton nom',
  join: 'Rejoindre la partie',
  rename: 'Renommer',
  seatsFull: 'Toutes les places sont prises.',
  joinedPlayers: 'Joueurs inscrits',
  noPlayerYet: "Aucun joueur pour l'instant.",
  you: '(toi)',
  disconnected: 'déconnecté',
  remove: 'Retirer',
  needPlayers: (count: number) => `Il faut au moins ${String(count)} joueurs.`,
  masterMustJoin: 'Rejoins la partie pour pouvoir la lancer.',
  masterStarts: 'Le premier téléphone connecté lancera la partie.',
  testFirstRound: 'Mode test : manche de départ',
  testGrid: 'Mode test : grille',
  randomGrid: 'Au hasard',
  roundChoice: (round: number, isFinal: boolean) =>
    isFinal ? 'Finale' : `Manche ${String(round)}`,
  round: (round: number) => `Manche ${String(round)}`,
  tiebreak: 'Départage',
  final: 'Finale',
  ranking: 'Classement final',
  youAre: (name: string) => `Tu es ${name}`,
  score: (name: string, score: number) => `${name} ${String(score)}`,
  whoBuzzed: 'Qui a buzzé en premier ?',
  buzzHint: 'Criez « Buzz ! », puis touchez le joueur le plus rapide',
  slamBuzzHint: 'Dernière chance : le premier qui buzze fait un SLAM !',
  buzz: 'BUZZ !',
  buzzSlam: 'BUZZ et SLAM !',
  letterFor: (name: string) => `${name} : quelle lettre ?`,
  validate: 'Valider',
  cancel: 'Annuler',
  chooseWordFor: (name: string, letter: string) =>
    `${name} : choisis un mot avec la lettre ${letter}`,
  wordButton: (number: number, pattern: string) => `${String(number)} · ${pattern}`,
  wordHeading: (number: number, length: number) =>
    `Mot n° ${String(number)} · ${String(length)} lettres`,
  lettersMissing: (count: number) =>
    count === 1 ? 'Encore 1 lettre à taper.' : `Encore ${String(count)} lettres à taper.`,
  slam: 'SLAM',
  confirmSlam: 'Remplir toute la grille ? Un seul mot faux et les adversaires gagnent les points.',
  confirmYes: 'Oui, SLAM !',
  slamTitle: 'SLAM : remplis tous les mots',
  slamValidate: 'Valider le SLAM',
  pickNumbers: (left: number) => `Choisis encore ${String(left)} numéro${left > 1 ? 's' : ''}`,
  pass: 'Passer',
  seconds: (value: number) => `${String(value)} s`,
  waiting: (reason: WaitReason, name: string) => WAITING[reason](name),
  lookAtTv: 'La grille est sur la TV.',
  standIn: (name: string) => `Jouer à la place de ${name}`,
  phoneGone: (name: string) => `Le téléphone de ${name} est déconnecté.`,
  roundOver: (round: number) => `Fin de la manche ${String(round)}`,
  nextRound: 'Manche suivante',
  toFinal: 'Passer à la finale',
  masterMovesOn: 'Le premier téléphone connecté lance la suite.',
  rank: (rank: number) => (rank === 1 ? '1er' : `${String(rank)}e`),
  rankLine: (rank: string, name: string, score: string) => `${rank} ${name} · ${score}`,
  points,
  euros,
  finalResult: (name: string, prize: number) => `${name} gagne ${euros(prize)}`,
  abandoned: 'Partie abandonnée',
  newGame: 'Nouvelle partie',
  nobodyKnows: 'Personne ne sait',
  revealGrid: 'Corriger la grille',
  confirmRevealGrid: 'Corriger la grille ? La manche s’arrête et personne ne marque.',
  abandonGame: 'Abandonner la partie',
  confirmAbandon: 'Abandonner la partie ? Le classement s’affiche tout de suite.',
  confirm: 'Confirmer',
  noAnswer: 'La TV n’a pas répondu : vérifie qu’elle est allumée, puis réessaie.',
  replaced: 'Un autre téléphone a pris la main.',
  takeOver: 'Reprendre la main',
} as const;

const STATUS_LABELS: Record<ConnectionStatus['kind'], string> = {
  waiting: 'Connexion en cours…',
  connected: 'Connecté à la TV',
  disconnected: 'Déconnecté, nouvel essai…',
  error: 'Erreur de connexion, nouvel essai…',
};

const ERROR_DETAILS: Record<string, string> = {
  'peer-unavailable': 'TV introuvable',
  timeout: 'connexion directe impossible (même Wi-Fi ?)',
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
};

export function statusLabel(status: ConnectionStatus): string {
  const detail = status.kind === 'error' ? ERROR_DETAILS[status.reason] : undefined;
  return detail === undefined
    ? STATUS_LABELS[status.kind]
    : `${STATUS_LABELS[status.kind]} (${detail})`;
}

const REJECTIONS: Record<RejectionReason, string> = {
  wrongPhase: 'Trop tard : action refusée.',
  invalidTeamCount: 'Il faut entre 2 et 4 joueurs.',
  invalidTeam: 'Joueur inconnu.',
  notPlaying: 'Ce joueur ne joue pas en ce moment.',
  teamEliminated: 'Ce joueur a déjà répondu à cette question.',
  invalidLetter: 'Tape une seule lettre.',
  invalidWord: 'Ce mot n’existe pas dans la grille.',
  wordNotPlayable: 'Ce mot ne contient pas la lettre, ou a déjà été tenté.',
  invalidAnswer: 'Réponse vide, trop longue ou incomplète.',
  invalidNumber: 'Numéro déjà choisi ou inconnu.',
  invalidRound: 'Manche de départ inconnue.',
  unknownGrid: 'Grille inconnue.',
};

export interface BannerMessage {
  text: string;
  isError: boolean;
}

function eventText(event: GameEvent, name: (team: number) => string): string | null {
  switch (event.type) {
    case 'buzzed':
      return `${name(event.team)} a buzzé !`;
    case 'letterFound':
      return `Bonne lettre : ${event.letter}`;
    case 'wrongLetter':
      return `${event.letter} : raté pour ${name(event.team)}`;
    case 'letterLost':
      return `C'était ${event.letter}`;
    case 'wordFound':
      return `${name(event.team)} trouve le mot n° ${String(event.word)} : +${points(event.points)}`;
    case 'wrongWord':
      return `« ${event.answer} » : raté`;
    case 'slamWon':
      return `SLAM réussi : +${points(event.points)} !`;
    case 'slamFailed':
      return `SLAM raté : les adversaires gagnent ${points(event.points)}`;
    case 'tiebreakWon':
      return `${name(event.team)} remporte le départage`;
    case 'finalWordFound':
      return 'Bravo !';
    case 'finalWrongWord':
      return `« ${event.answer} » : non`;
    case 'finalOver':
      return event.complete ? 'Grille complète !' : 'Temps écoulé !';
    default:
      return null;
  }
}

/** Message for the last action, or null when nothing is worth saying. */
export function messageFor(
  events: readonly GameEvent[],
  name: (team: number) => string,
): BannerMessage | null {
  const rejected = events.find((event) => event.type === 'actionRejected');
  if (rejected !== undefined) return { text: REJECTIONS[rejected.reason], isError: true };
  const texts = events.map((event) => eventText(event, name)).filter((text) => text !== null);
  return texts.length === 0 ? null : { text: texts.join(' · '), isError: false };
}
