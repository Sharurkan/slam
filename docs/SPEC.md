# Spécification

## But

Jeu familial inspiré de « SLAM » (questions + grille de mots croisés), pour les repas de famille.
Ce n'est pas une copie de l'émission : nom, couleurs et visuels sont originaux.
Priorités, dans l'ordre :

1. Marche sur le vrai matériel (Fire TV Stick + téléphones), sans bug bloquant.
2. Règles claires et amusantes à la maison.
3. Code simple, typé, testé, facile à faire évoluer.

Nom provisoire du jeu : **Lettre à Lettre** (à valider).

## Matériel et usage

- La TV affiche le jeu via le navigateur Silk du Fire TV Stick, en plein écran 16:9.
- Sur la TV, la seule interaction est un appui sur OK pour activer le son.
- Les téléphones servent de manettes. TV et téléphones sont sur le même Wi-Fi.
- Deux modes, choisis par le premier téléphone connecté (voir « Modes de jeu »).

## Connexion

Identique à « La Roue de la Fortune » :

1. La TV ouvre `?mode=tv`. Elle génère un code de 4 lettres (sans I, L ni O).
2. Elle affiche ce code en grand, plus un QR code vers `?mode=manette&code=XXXX`.
3. Le téléphone scanne le QR code et se connecte tout seul.
4. Secours : ouvrir `?mode=manette` et taper le code.
5. Le téléphone garde le code et un identifiant aléatoire en mémoire. Il se reconnecte seul après une coupure et retrouve son joueur.
6. La TV garde le code et la partie en mémoire. Un rechargement ne perd rien.
7. Si le code est déjà pris sur le serveur PeerJS, réessayer puis générer un nouveau code.
8. États de connexion visibles des deux côtés : en attente, connecté, déconnecté, erreur.

Note : la mise en relation passe par le serveur public gratuit de PeerJS. Ensuite, les échanges sont directs.

## Modes de jeu

- Le premier téléphone connecté est le **maître**. Il choisit le mode, et peut en changer entre deux parties.
- Dans ce document, « joueur » veut dire un joueur ou une équipe.
- **Un seul téléphone**, passé de main en main :
  - Une nouvelle connexion remplace l'ancienne. Le téléphone remplacé affiche « Un autre téléphone a pris la main » (bouton « Reprendre la main »).
  - Pour buzzer, les joueurs crient. Celui qui tient le téléphone touche le bouton du joueur le plus rapide.
  - Il tape ensuite la lettre, le mot ou le SLAM pour ce joueur.
- **Un téléphone par joueur** (4 au plus) :
  - Chaque téléphone scanne le QR code et tape le nom du joueur. Ordre : ordre d'arrivée.
  - La TV liste les joueurs inscrits et leur état (connecté, déconnecté).
  - Le maître joue aussi. Il peut retirer un joueur inscrit par erreur, puis lance la partie (2 joueurs au moins, dont lui).
  - Chaque téléphone a son bouton « BUZZ ! ». Le premier buzz reçu par la TV gagne.
  - Seul le joueur qui a la main peut jouer. Les autres voient « C'est à X », boutons grisés.
  - Joueur éliminé de la partie (après la manche 1, ou non finaliste) : son téléphone affiche « Tu regardes la suite ».
  - Téléphone du joueur qui a la main déconnecté : la TV l'indique, on attend sa reconnexion. Le maître peut aussi « Jouer à la place de X » pour ce tour (jamais buzzer à sa place).
  - Actions de partie (commencer, manche suivante, personne ne sait, corriger la grille, abandonner, nouvelle partie) : maître uniquement.
- La TV garde le mode, le maître et les joueurs. Un rechargement ne perd rien.

## Déroulé d'une partie

1. **Manche 1** : grille de 10 mots, tous les joueurs (2 à 4).
2. Les **2 meilleurs** de la manche 1 passent en manche 2. Avec 2 joueurs, les deux passent.
3. **Manche 2** : grille de 12 mots, les 2 qualifiés repartent à 0 point.
4. Le gagnant de la manche 2 joue la **finale**, seul.
5. Classement final sur la TV, avec les gains de la finale à côté du finaliste.

- « Abandonner la partie » sur le téléphone du maître, à tout moment, avec confirmation : classement direct.
- Fin de partie : bouton « Nouvelle partie » sur le téléphone du maître.

## Manches 1 et 2

Grille

- Grille de mots croisés vide au départ, chaque mot numéroté. Les définitions sont cachées.
- Pas de minuteur dans les manches 1 et 2.

Tour de jeu

1. Une question apparaît sur la TV. Sa réponse est **une seule lettre**, présente dans la grille et pas encore révélée (ni perdue).
   Exemples : « Lettre qui suit P dans l'alphabet ? », « Initiale de la capitale de l'Italie ? », « Symbole chimique de l'azote ? ».
2. Les joueurs buzzent. Le premier buzz donne la parole : le joueur tape la lettre sur le téléphone.
3. **Bonne lettre** : aucun point. La lettre remplit toutes les cases vides où elle apparaît, dans tous les mots. Le joueur a la main.
4. Il choisit un mot par son numéro, parmi les mots qui contiennent cette lettre, pas encore trouvés et pas grisés.
5. La définition du mot s'affiche (TV et téléphone). Le joueur propose le mot.
   - **Bon mot** : le mot apparaît dans la grille, le joueur gagne 1 point par lettre du mot. Si ce mot complète un mot croisé, le joueur gagne aussi les points de ce mot.
   - **Mauvais mot** : rien. Le mot devient gris (déjà tenté). Il redevient jouable dès qu'une autre de ses lettres est révélée.
   - Dans les deux cas, on passe à la question suivante.
6. **Mauvaise lettre** : le joueur est éliminé de cette question, les autres peuvent buzzer.
7. **Personne ne trouve** (tous éliminés, ou le maître touche « Personne ne sait ») : la lettre est annoncée mais perdue. Elle n'est pas posée dans la grille. Elle n'apparaîtra que si un mot qui la contient est trouvé plus tard. On passe à la question suivante.

Précisions

- Une lettre révélée qui remplit à elle seule toutes les cases d'un mot : le mot compte comme trouvé, et ses points vont au joueur qui a trouvé la lettre.
- Le mot proposé doit avoir le bon nombre de lettres (le téléphone l'impose). Comparaison sans accents ni casse.
- La TV affiche la liste des lettres perdues.

SLAM

- Quand il a la main (après une bonne lettre, avant d'avoir proposé son mot), un joueur peut faire « SLAM », avec confirmation.
- Le jeu se fige. Le joueur remplit tous les mots restants, sans définitions, sur le téléphone. Les mots sont corrigés ensemble à la fin.
- Points restants : somme des points (1 par lettre) de tous les mots pas encore trouvés.
- **Réussite** : le joueur gagne tous les points restants. La grille est complète, la manche se termine.
- **Échec** (au moins un mot faux) : chaque adversaire encore en jeu gagne les points restants. La grille est corrigée (mots restants affichés), la manche se termine.

Plus de lettre à révéler

- Si aucune lettre utile ne reste (toutes révélées ou perdues) et que des mots manquent : « Dernière chance : SLAM ! » sur la TV.
- Tous les joueurs peuvent buzzer. Le premier buzz fait un SLAM, avec les règles ci-dessus.
- Le maître peut toucher « Corriger la grille » à tout moment : les mots restants s'affichent, personne ne marque.

Fin de manche

- La manche se termine quand la grille est complète (mots trouvés, SLAM ou correction).
- Égalité pour la 2e place (manche 1) ou pour la 1re place (manche 2) : **question de départage** entre les ex æquo. Une question à une lettre, hors grille. Première bonne lettre : gagné. Mauvaise lettre : éliminé de cette question. Tous éliminés ou « Personne ne sait » : nouvelle question.
- Écran de fin de manche : scores, qualifiés ou finaliste. Bouton « Manche suivante » (« Passer à la finale » après la manche 2) pour le maître.

## Finale

- Le finaliste joue seul. Les points des manches ne servent qu'à choisir le finaliste.
- La TV montre 8 numéros. Chacun cache une lettre, tirée au hasard parmi les lettres de la grille de finale (8 lettres différentes).
- Le finaliste choisit 5 numéros sur son téléphone. Les 5 lettres sont dévoilées, puis posées partout où elles apparaissent dans la grille.
- La grille de 7 mots s'affiche avec son thème. Le minuteur de 60 s démarre.
- Les définitions viennent une par une, dans l'ordre des numéros. Le finaliste tape le mot ou touche « Passer ».
  - Bon mot : il apparaît dans la grille, définition suivante.
  - Mauvais mot : message « Faux », il peut réessayer ou passer.
  - Les mots passés reviennent après le dernier.
- Une lettre posée qui remplit tout un mot : ce mot compte comme trouvé.
- Fin : temps écoulé ou grille complète. Les mots manquants sont affichés.
- Gains : 100 € par mot trouvé. Grille complète : 2 000 €.
- Les gains s'affichent à côté du finaliste dans le classement. Ils ne s'ajoutent pas aux points.
- Si la TV recharge pendant la finale, le minuteur reprend où il en était.

## Valeurs (dans `game/config.ts`)

| Réglage                        | Valeur       |
| ------------------------------ | ------------ |
| Joueurs                        | 2 à 4        |
| Mots en manche 1 / manche 2    | 10 / 12      |
| Qualifiés pour la manche 2     | 2            |
| Points d'un mot                | 1 par lettre |
| Mots en finale                 | 7            |
| Numéros en finale / à choisir  | 8 / 5        |
| Minuteur de finale             | 60 s         |
| Gain par mot en finale         | 100 €        |
| Gain grille complète en finale | 2 000 €      |

## Contenu

Grilles

- Jamais générées pendant la partie. Elles sont pré-générées et stockées en données (TS), faciles à relire et corriger à la main.
- Chaque grille : identifiant, taille, mots (numéro, position, sens, mot, définition), thème pour la finale.
- Taille maximale pour rester lisible sur la TV : 15 colonnes × 11 lignes (dans `game/config.ts`).
- Mots de 3 lettres au moins, sans espace ni tiret.
- Script hors ligne (`scripts/`, Node) : construit des grilles valides à partir d'une liste de mots + définitions.
- Validateur, lancé dans les tests : croisements cohérents, pas de lettres en conflit, tous les mots reliés, pas de doublon dans une grille, pas de mot partagé entre deux grilles d'un même type.
- Au départ : 15 grilles de 10 mots, 15 grilles de 12 mots, 20 grilles de finale. Pas de répétition dans une partie.

Questions

- Banque de questions dont la réponse est une seule lettre : 300 au moins, variées (alphabet, géographie, sciences, symboles chimiques, initiales, calcul, langue…).
- Chaque question a une seule réponse, sans ambiguïté, compréhensible par les enfants comme par les adultes.
- Au moins 6 questions par lettre, pour que chaque lettre de la grille puisse être demandée.
- Tirage : une lettre au hasard parmi les lettres utiles de la grille, puis une question pour cette lettre, pas encore posée dans la partie. Banque épuisée pour cette lettre : on repart de zéro.

Textes

- Normalisation : majuscules, accents retirés (É → E), ligatures dépliées (Œ → OE).
- Définitions en français correct, adaptées à toute la famille.

## Écran TV

- Lisible depuis le canapé : grands caractères, forts contrastes, grille bien visible.
- Zones : grille, question en cours, définition du mot choisi, scores (joueur qui a la main mis en avant), bandeau de message, lettres perdues, minuteur en finale.
- Animations simples : lettres qui apparaissent une par une, mot trouvé qui s'illumine, effet spécial pour un SLAM réussi.
- Sons générés en Web Audio (buzz, bon, faux, SLAM, fin du minuteur), pas de fichiers audio.
- Le Fire Stick est lent : pas d'animation coûteuse.

## Manette (téléphone)

- Gros boutons, utilisable d'une main.
- Affiche : manche, joueur qui a la main, scores, message en cours. Avec un téléphone par joueur : « Tu es X ».
- Choix du mode (maître seulement).
- Configuration avec un seul téléphone : nombre de joueurs, noms, bouton « Commencer ».
- Configuration avec un téléphone par joueur : nom du joueur, liste des inscrits, « Commencer » pour le maître.
- Question : gros bouton « BUZZ ! » (un bouton par joueur avec un seul téléphone, joueurs éliminés grisés).
- Clavier de lettres pour la réponse à la question.
- Choix du mot par numéro (mots non jouables grisés).
- Saisie du mot : longueur et lettres connues affichées, « Valider » et « Annuler ».
- Bouton « SLAM » avec confirmation, puis saisie de tous les mots restants.
- Finale : choix de 5 numéros sur 8, saisie du mot, « Passer ».
- Maître seulement : mode, commencer, « Personne ne sait », « Corriger la grille », manche suivante, abandonner, nouvelle partie.
- Boutons grisés tant que la TV anime.
- Mode test (`&test` dans l'adresse) : choix de la manche de départ (1, 2 ou finale) et grille forcée.

## Protocole

- Version actuelle du protocole : 1.
- Téléphone → TV :
  - `{ v, type: "hello", clientId }` au début de chaque connexion ;
  - `{ v, type: "chooseMode", mode }`, `{ v, type: "joinTeam", name }`, `{ v, type: "removeTeam", team }` avant la partie ;
  - `{ v, type: "action", action }`.
- TV → téléphone :
  - `{ v, type: "state", view, room }`. La `view` ne contient **jamais** les réponses : ni les mots non trouvés, ni les lettres non révélées, ni la réponse de la question, ni les lettres cachées de la finale. `room` est propre à chaque téléphone ;
  - `{ v, type: "replaced" }` au téléphone remplacé, avec un seul téléphone.
- La TV est la seule source de vérité. Elle vérifie qui envoie chaque message (maître, joueur qui a la main) et ignore le reste.
- Dans les deux sens : `{ v, type: "heartbeat" }` toutes les 5 s. Sans aucun message pendant 15 s, la connexion est considérée comme perdue.
- Tous les messages sont validés avec zod à la réception.
- Version différente : message ignoré et erreur affichée (« Mets à jour la page »).

## Hors périmètre (pour l'instant)

- Reprendre la place d'un joueur en pleine partie avec un autre téléphone
- Grilles ou questions personnalisées
- Génération de grilles pendant la partie
- Mode hors ligne sans serveur PeerJS

## Phases

0. Lecture du projet de référence, décisions, cette spécification.
1. Mise en place : dépôt, Vite + TypeScript strict, ESLint, Prettier, Vitest, scripts npm, GitHub Actions vers GitHub Pages.
2. Réseau : reprise de `net/` et `protocol/`, pages TV et manette minimales (connexion, deux modes, buzz). Test sur le vrai Fire Stick avant de continuer.
3. Contenu : format des grilles, script de génération, validateur, premier lot de grilles et de questions.
4. Cœur du jeu : `game/` complet (manches, buzz, SLAM, départage, finale) avec tests.
5. Vue TV.
6. Vue manette.
7. Sauvegarde et reprise.
8. Finitions : sons, animations, messages d'erreur, pages de test (`?mode=test-tv`, `?mode=test-manette`), README joueurs.

Chaque phase se termine par `npm run check` au vert, un résumé, la validation de l'utilisateur, puis un commit.
