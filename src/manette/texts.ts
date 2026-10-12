import { DEFAULT_TEAM_NAME_PREFIX } from '../game/config';
import type { GameEvent, RejectionReason } from '../game/events';
import type { ConnectionStatus } from '../net/connection-status';

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
  gameTitle: 'Partie en cours',
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
  newGame: 'Nouvelle partie',
  abandonGame: 'Abandonner la partie',
  screenComing: 'Écran de la manette en construction.',
  youAre: (name: string) => `Tu es ${name}`,
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
  notPlaying: 'Ce joueur ne joue pas cette manche.',
  teamEliminated: 'Ce joueur a déjà répondu à cette question.',
  invalidLetter: 'Tape une seule lettre.',
  invalidWord: 'Ce mot n’existe pas dans la grille.',
  wordNotPlayable: 'Ce mot ne contient pas la lettre, ou a déjà été tenté.',
  invalidAnswer: 'Réponse vide ou trop longue.',
  invalidNumber: 'Numéro déjà choisi ou inconnu.',
  invalidRound: 'Manche de départ inconnue.',
  unknownGrid: 'Grille inconnue.',
};

export interface BannerMessage {
  text: string;
  isError: boolean;
}

/** Message for the last action, or null when nothing is worth saying. */
export function messageFor(events: readonly GameEvent[]): BannerMessage | null {
  for (const event of events) {
    if (event.type === 'actionRejected') return { text: REJECTIONS[event.reason], isError: true };
  }
  return null;
}
