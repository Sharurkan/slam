import { DEFAULT_TEAM_NAME_PREFIX } from '../game/config';
import type { ConnectionStatus } from '../net/connection-status';

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
  screenComing: 'Écran de jeu en construction',
  hasTheHand: (name: string) => `${name} a la main`,
  points: (score: number) => (score > 1 ? `${String(score)} points` : `${String(score)} point`),
  phoneOffline: 'déconnecté',
  soundButton: 'Appuie sur OK pour activer le son',
  soundHint: 'Son coupé : appuie sur OK',
  soundOn: 'Son activé',
  storageFailed: 'Sauvegarde impossible : le code changera au rechargement',
  saveFailed: 'Sauvegarde impossible : un rechargement perdra les joueurs',
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
