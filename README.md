# Lettre à Lettre

Jeu familial de questions et de mots croisés. La TV affiche le jeu, les téléphones servent de manettes.

En cours de construction. Règles complètes : [docs/SPEC.md](docs/SPEC.md).

## Développement

Node.js 22 ou plus.

```bash
npm install
npm run dev
```

- `npm run check` : types, lint et tests (avant chaque commit)
- `npm run build` : version de production
- Chaque push sur `main` est vérifié puis déployé sur GitHub Pages.

Règles du projet pour le code : [CLAUDE.md](CLAUDE.md).
