import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const restrictImports = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Folder dependency rules (see CLAUDE.md, "Architecture").
  {
    files: ['src/game/**/*.ts'],
    rules: {
      ...restrictImports([
        {
          regex: '^[.][.]/(?!shared/text$)',
          message: 'game/ may only depend on shared/text.',
        },
        { regex: '^(?!vitest$)[^.]', message: 'game/ must not depend on any library.' },
      ]),
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'fetch',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Inject randomness through deps.' },
        { object: 'Date', property: 'now', message: 'Inject the clock through deps.' },
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: restrictImports([
      {
        regex: '^[.][.]/(?!(game/|shared/text$))',
        message: 'content/ may only depend on game/ and shared/text.',
      },
      { regex: '^(?!vitest$)[^.]', message: 'content/ must not depend on any library.' },
    ]),
  },
  {
    files: ['src/protocol/**/*.ts'],
    rules: restrictImports([
      { regex: '^[.][.]/(?!game/)', message: 'protocol/ may only depend on game/.' },
      { regex: '^(?!(zod/mini|vitest)$)[^.]', message: 'protocol/ may only use zod/mini.' },
    ]),
  },
  {
    files: ['src/net/**/*.ts'],
    rules: restrictImports([
      {
        regex: '^[.][.]/(game|content|storage|tv|manette)/',
        message: 'net/ must not know game rules or views.',
      },
    ]),
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: restrictImports([
      { regex: '^[.][.]/', message: 'shared/ must not depend on other folders.' },
    ]),
  },
  {
    files: ['src/storage/**/*.ts'],
    rules: restrictImports([
      {
        regex: '^[.][.]/(net|tv|manette)/',
        message: 'storage/ must not depend on views or net/.',
      },
    ]),
  },
  {
    files: ['src/tv/**/*.ts'],
    rules: restrictImports([
      { regex: '^[.][.]/manette/', message: 'tv/ and manette/ must stay separate.' },
    ]),
  },
  {
    files: ['src/manette/**/*.ts'],
    rules: restrictImports([
      { regex: '^[.][.]/tv/', message: 'tv/ and manette/ must stay separate.' },
    ]),
  },
  prettier,
);
