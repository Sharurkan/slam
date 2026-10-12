import './style.css';
import { parseMode } from './shared/mode';

const NO_MODE_TEXT = 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.';
// Placeholder until the TV and controller pages exist (phase 2).
const COMING_SOON_TEXT = 'Bientôt disponible.';

const root = document.getElementById('app');
if (root) {
  root.textContent = parseMode(window.location.search) === null ? NO_MODE_TEXT : COMING_SOON_TEXT;
}
