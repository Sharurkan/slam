# Lettre à Lettre (jeu familial)

Jeu inspiré de « SLAM » (questions à une lettre + grille de mots croisés), pour des repas de famille.
Nom, couleurs et visuels originaux : rien de l'émission (ni nom, ni logo, ni habillage).

- Écran TV : navigateur Silk d'un Amazon Fire TV Stick (`?mode=tv`).
- Manette : navigateur d'un téléphone (`?mode=manette`).
- Connexion directe TV ↔ téléphone via PeerJS (WebRTC). Pas de serveur à nous.
- Site statique hébergé gratuitement sur GitHub Pages.
- Projet de référence (architecture et qualité) : https://github.com/Sharurkan/roue-de-la-fortune

Spécification complète : @docs/SPEC.md

## Commandes

- `npm run dev` : serveur local
- `npm run build` : build de production
- `npm run typecheck` : vérification TypeScript
- `npm run lint` : ESLint
- `npm run format` : Prettier
- `npm run format:check` : vérification Prettier (lancée par la CI)
- `npm test` : Vitest
- `npm run check` : typecheck + lint + tests (à lancer avant chaque commit)
- `npm run generate:grids` : régénère les grilles à partir de `scripts/sources/` (jamais pendant une partie)

## Stack

- TypeScript strict, Vite, aucun framework UI
- PeerJS pour la connexion, `zod` (import `zod/mini`, plus léger) pour valider les messages reçus
- Vitest pour les tests, ESLint + Prettier pour le style
- Cible navigateur : ES2020 (le Fire TV Stick n'a pas un navigateur récent)
- Node 22.18 ou plus : le script de grilles est lancé par Node directement, sans compilation
- Les fichiers chargés par ce script (`game/config.ts`, `game/grid.ts`, `content/validate.ts`, `content/grid-builder.ts`, `shared/text.ts`) importent avec l'extension `.ts` et sans syntaxe TypeScript non effaçable (`erasableSyntaxOnly`)
- `@types/node` sert seulement aux types de `scripts/`
- Dépendances à versions fixes (pas de `^` ni `~`). Toute nouvelle dépendance doit être justifiée et validée par l'utilisateur.

## Architecture

```
src/
  game/      Règles du jeu pures : état, actions, reducer, config, événements, permissions
  content/   Grilles et questions (données), chargement, tirage sans répétition
  protocol/  Types et schémas zod des messages TV ↔ téléphone (versionnés)
  net/       Connexion PeerJS : code de salle, heartbeat, reconnexion
  storage/   Sauvegarde locale (localStorage), avec gestion d'erreurs
  tv/        Vue TV : grille, question, scores, sons, QR code, salle des téléphones
  manette/   Vue manette : buzz, clavier de lettres, choix et saisie des mots, SLAM
  shared/    Utilitaires communs (normalisation du texte, DOM sûr, lecture de l'URL)
  main.ts    Choix du mode selon l'URL
scripts/     Outils hors ligne (génération des grilles), jamais livrés au navigateur
```

Règles de dépendance (vérifiées par ESLint, à respecter strictement) :

- `game/` ne dépend que de `shared/text` : ni DOM, ni réseau, ni `localStorage`, ni `Math.random`, ni `Date.now`.
- `content/` dépend seulement de `game/` (types) et de `shared/text`.
- `protocol/` dépend seulement de `game/` (types) et de `zod`.
- `net/` ne connaît pas les règles du jeu. Il transporte des messages déjà typés.
- `shared/` ne dépend de rien.
- `tv/` et `manette/` assemblent le tout. Ils ne contiennent aucune règle du jeu.

Principes :

- Le reducer est la seule source de vérité : `reduce(state, action, deps) → { state, events }`.
- Les `events` (lettre trouvée, mot trouvé, SLAM…) pilotent sons et animations.
- Le hasard, l'horloge et le contenu sont injectés via `deps`, pour des tests reproductibles.
- La TV détient l'état. Le téléphone envoie des actions et reçoit une vue publique.
- Valeurs de jeu (points, durées, nombres de mots) dans `game/config.ts`, jamais en dur ailleurs.
- Les grilles ne sont jamais générées pendant la partie : elles sont pré-générées (`scripts/`) et validées dans les tests. `src/content/grids/` est généré : hors Prettier, définitions corrigeables à la main.

## Règles de code

- `strict: true`, pas de `any`, pas de `as` sauf justification en commentaire
- Fonctions courtes, une responsabilité, noms explicites en anglais
- Langue : code, commentaires, noms de tests et commits en anglais
- Textes affichés (interface, questions, définitions) en français, centralisés dans un fichier par vue
- Pas de code mort, pas de `console.log` laissé dans le code livré
- Commentaires seulement pour expliquer un « pourquoi » non évident
- Unions discriminées pour les actions, les phases et les messages
- Toute erreur réseau ou de stockage est gérée et affichée simplement à l'écran

## Sécurité

- Tout message reçu est non fiable : validé avec zod, sinon ignoré
- Le reducer refuse toute action invalide pour la phase en cours
- Jamais d'`innerHTML` avec du texte variable. Utiliser `textContent` ou les helpers de `shared/`
- Aucune réponse n'est envoyée au téléphone : ni mots non trouvés, ni lettres non révélées, ni réponse de la question, ni lettres cachées de la finale
- Un seul téléphone : une nouvelle connexion remplace l'ancienne. Un téléphone par joueur : la TV vérifie chaque action (`game/permissions.ts`)
- Pas de données personnelles, pas de secrets dans le code
- `npm audit` sans vulnérabilité haute ou critique

## Tests

- `game/` : chaque règle de docs/SPEC.md a au moins un test (buzz, élimination, bon/mauvais mot, SLAM réussi/raté, fin de manche, départage, finale, minuteur)
- `protocol/` : tests des schémas (messages valides et invalides), et vérification que la vue ne contient aucune réponse
- `content/` : validateur des grilles et de la banque de questions
- `shared/text.ts` : tests de la normalisation
- Écrire le test avant ou avec le code, jamais après coup « pour la forme »

## Workflow

- Avancer phase par phase (voir docs/SPEC.md, section « Phases »)
- Avant chaque phase : proposer un plan court et attendre la validation
- Après chaque phase : lancer `npm run check`, résumer, attendre la validation, puis commit
- Garder docs/SPEC.md à jour quand une règle change
- Commits courts au format Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`…)
- Pas de ligne `Co-Authored-By` dans les commits : seul l'utilisateur en est l'auteur
- Ne jamais `git push`, créer de dépôt ou modifier les réglages GitHub sans accord explicite
- En cas de doute sur une règle du jeu : demander, ne pas inventer
- Signaler clairement tout ce qui n'a pas pu être vérifié (en particulier sur le Fire TV Stick)

## Style de réponse

- Répondre en anglais, court et simple
- Dire ce qui est fait, ce qui reste, et ce qui a échoué
