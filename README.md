# Lettre à Lettre

Jeu familial de questions et de mots croisés, inspiré des jeux télé du même genre. La TV affiche la grille, les téléphones servent de manettes.

## Jouer

1. Sur la TV (navigateur Silk du Fire TV Stick), ouvrir :
   https://sharurkan.github.io/slam/?mode=tv
2. Appuyer sur **OK** avec la télécommande pour activer le son.
3. Sur un téléphone, scanner le QR code affiché sur la TV.
   Sinon, ouvrir https://sharurkan.github.io/slam/?mode=manette et taper le code de 4 lettres.
4. Le premier téléphone connecté choisit le mode :
   - **Un seul téléphone** : on tape les noms des joueurs (2 à 4), puis « Commencer ». Pour buzzer, on crie, et celui qui tient le téléphone touche le joueur le plus rapide.
   - **Un téléphone par joueur** : chacun scanne le QR code et tape son nom. Le premier téléphone lance la partie.

La TV et les téléphones doivent être sur le même Wi-Fi. Évitez le Wi-Fi « invité » : il bloque souvent la connexion directe.

## Règles en bref

- **Question** : sa réponse est une seule lettre. Le premier qui buzze tape la lettre.
  - Bonne lettre : elle apparaît partout dans la grille, et le joueur a la main.
  - Mauvaise lettre : le joueur ne peut plus répondre à cette question.
  - Personne ne trouve : la lettre est perdue.
- **Mot** : le joueur qui a la main choisit un mot contenant la lettre, lit la définition et propose le mot.
  - Bon mot : 1 point par lettre (et les points des mots croisés qu'il complète).
  - Mauvais mot : il devient gris, jusqu'à ce qu'une autre de ses lettres apparaisse.
- **SLAM** : avec la main, on peut tenter de remplir toute la grille d'un coup. Réussi : on gagne tous les points restants. Raté : chaque adversaire les gagne.
- **Manches** : manche 1 (10 mots), les 2 meilleurs jouent la manche 2 (12 mots, on repart à 0), le gagnant joue la finale. Égalité : question de départage.
- **Finale** : le finaliste choisit 5 numéros sur 8, chacun cache une lettre. Puis 60 secondes pour trouver les 7 mots d'une grille à thème, sans définitions : seul le thème est donné. On choisit les mots dans l'ordre qu'on veut, on change quand on veut, une erreur ne coûte que du temps. 100 € par mot, 2 000 € pour la grille complète. Avant de commencer, le maître peut choisir une finale sans minuteur : il l'arrête alors lui-même (« Arrêter la finale »).

Règles complètes : [docs/SPEC.md](docs/SPEC.md).

## Boutons du premier téléphone

- « Personne ne sait » : personne ne trouve la lettre, on passe à la question suivante.
- « Corriger la grille » : arrête la manche et montre les mots restants, sans points.
- « Manche suivante », « Abandonner la partie », « Nouvelle partie ».
- Avec un téléphone par joueur, si le téléphone du joueur qui a la main se déconnecte : « Jouer à la place de X ».

## En cas de souci

- **La TV ne fait pas de bruit** : appuyer sur OK avec la télécommande.
- **Le téléphone ne se connecte pas** : vérifier le Wi-Fi des deux appareils, puis recharger la page du téléphone.
- **La page a été rechargée** : la partie reprend toute seule, sur la TV comme sur le téléphone. Le minuteur de la finale reprend là où il en était.
- **« Mets à jour la page »** : recharger la page sur la TV et sur les téléphones.
- **« La TV n'a pas répondu »** : vérifier que la TV est allumée et sur la page du jeu, puis réessayer.

## Pages de test

Pour vérifier qu'un appareil est compatible (connexion, son, diagnostic) :

- TV : `?mode=test-tv`
- Téléphone : `?mode=test-manette`

Mode test du jeu : ajouter `&test` à l'adresse du premier téléphone pour choisir la manche de départ et la grille.

## Contenu

- Grilles : sources à relire dans `scripts/sources/` (une ligne `MOT | Définition`), grilles générées dans `src/content/grids/`. Une définition se corrige directement dans le fichier généré ; pour changer un mot, modifier la source puis lancer `npm run generate:grids`.
- Questions : `src/content/questions.ts`, classées par lettre.
- Les tests vérifient chaque grille et la banque de questions.

## Développement

Node.js 22.18 ou plus.

```bash
npm install
npm run dev
```

- `npm run check` : types, lint et tests (avant chaque commit)
- `npm run build` : version de production
- `npm run generate:grids` : régénère les grilles
- Chaque push sur `main` est vérifié puis déployé sur GitHub Pages.

Règles du projet pour le code : [CLAUDE.md](CLAUDE.md).
