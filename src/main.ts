import './style.css';
import { startManette } from './manette/manette-app';
import { parseMode } from './shared/mode';
import { startTv } from './tv/tv-app';

const NO_MODE_TEXT = 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.';
// The device test pages come with the polish phase (phase 8).
const TEST_PAGE_TEXT = 'Page de test bientôt disponible.';

const root = document.getElementById('app');
if (root) {
  switch (parseMode(window.location.search)) {
    case 'tv':
      startTv(root);
      break;
    case 'manette':
      startManette(root);
      break;
    case 'test-tv':
    case 'test-manette':
      root.textContent = TEST_PAGE_TEXT;
      break;
    case null:
      root.textContent = NO_MODE_TEXT;
  }
}
