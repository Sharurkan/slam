/// <reference types="node" />
/**
 * Builds the grids from the word lists in scripts/sources/ and writes them to
 * src/content/grids/. Run with `npm run generate:grids`. Never used during a game.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildGrid, drawGrid, shuffle, type WordEntry } from '../src/content/grid-builder.ts';
import { validateFinalGrid, validateGrid, validateGridSet } from '../src/content/validate.ts';
import {
  FINAL_WORD_COUNT,
  MAX_GRID_HEIGHT,
  MAX_GRID_WIDTH,
  ROUND_WORD_COUNTS,
} from '../src/game/config.ts';
import type { FinalGrid, Grid } from '../src/game/grid.ts';
import { normalizeText } from '../src/shared/text.ts';

const ROUND_WORDS_FILE = 'scripts/sources/round-words.txt';
const FINAL_THEMES_FILE = 'scripts/sources/final-themes.txt';
const OUTPUT_DIR = 'src/content/grids';
const GRIDS_PER_ROUND = 50;
/** Change it to get other grids from the same words. */
const SEED = 2026;
/** Words offered to the builder for one round grid, drawn from the unused ones. */
const SAMPLE_SIZE = 40;
const SAMPLES_PER_GRID = 30;
const ATTEMPTS_PER_SAMPLE = 40;

interface Theme {
  name: string;
  entries: WordEntry[];
}

/** Small seeded generator (mulberry32): the same seed always gives the same grids. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function contentLines(file: string): { text: string; line: number }[] {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(({ text }) => text !== '' && !text.startsWith('# '));
}

/** "MOT | Définition" → { answer: "MOT", clue: "Définition" }. */
function parseEntry(text: string, where: string): WordEntry {
  const [word = '', ...clueParts] = text.split('|');
  const answer = normalizeText(word.trim());
  const clue = clueParts.join('|').trim();
  if (!/^[A-Z]+$/.test(answer) || clue === '') {
    throw new Error(`${where}: expected "MOT | Définition", got "${text}"`);
  }
  return { answer, clue };
}

function readRoundWords(): WordEntry[] {
  return contentLines(ROUND_WORDS_FILE).map(({ text, line }) =>
    parseEntry(text, `${ROUND_WORDS_FILE}:${String(line)}`),
  );
}

/** "## Thème" starts a theme; the word lines below belong to it. */
function readThemes(): Theme[] {
  const themes: Theme[] = [];
  for (const { text, line } of contentLines(FINAL_THEMES_FILE)) {
    if (text.startsWith('## ')) {
      themes.push({ name: text.slice(3).trim(), entries: [] });
      continue;
    }
    const theme = themes[themes.length - 1];
    const where = `${FINAL_THEMES_FILE}:${String(line)}`;
    if (theme === undefined) throw new Error(`${where}: word before the first "## Thème"`);
    theme.entries.push(parseEntry(text, where));
  }
  return themes;
}

function reportDuplicates(entries: readonly WordEntry[]): void {
  const seen = new Set<string>();
  for (const { answer } of entries) {
    if (seen.has(answer)) throw new Error(`Word ${answer} appears twice in the sources`);
    seen.add(answer);
  }
}

function buildRoundGrids(
  pool: WordEntry[],
  round: number,
  random: () => number,
): { grids: Grid[]; pool: WordEntry[] } {
  const wordCount = ROUND_WORD_COUNTS[round - 1] ?? 0;
  const grids: Grid[] = [];
  let unused = pool;
  for (let index = 1; index <= GRIDS_PER_ROUND; index += 1) {
    const id = `m${String(round)}-${String(index).padStart(2, '0')}`;
    const grid = buildFromSamples(id, unused, wordCount, random);
    const used = new Set(grid.words.map((word) => word.answer));
    unused = unused.filter((entry) => !used.has(entry.answer));
    grids.push(grid);
  }
  return { grids, pool: unused };
}

function buildFromSamples(
  id: string,
  pool: readonly WordEntry[],
  wordCount: number,
  random: () => number,
): Grid {
  for (let sample = 0; sample < SAMPLES_PER_GRID; sample += 1) {
    const entries = shuffle(pool, random).slice(0, SAMPLE_SIZE);
    const grid = buildGrid(id, entries, options(wordCount, random));
    // A clue that names another word of the grid would give it away: try other words.
    if (grid !== null && validateGrid(grid, wordCount).length === 0) return grid;
  }
  throw new Error(`${id}: no grid found, add words to ${ROUND_WORDS_FILE}`);
}

function options(wordCount: number, random: () => number) {
  return {
    wordCount,
    maxWidth: MAX_GRID_WIDTH,
    maxHeight: MAX_GRID_HEIGHT,
    random,
    attempts: ATTEMPTS_PER_SAMPLE,
  };
}

function buildFinalGrids(themes: readonly Theme[], random: () => number): FinalGrid[] {
  return themes.map((theme, index) => {
    const id = `f-${String(index + 1).padStart(2, '0')}`;
    for (let sample = 0; sample < SAMPLES_PER_GRID; sample += 1) {
      const grid = buildGrid(id, theme.entries, options(FINAL_WORD_COUNT, random));
      if (
        grid !== null &&
        validateFinalGrid({ ...grid, theme: theme.name }, FINAL_WORD_COUNT).length === 0
      ) {
        return { ...grid, theme: theme.name };
      }
    }
    throw new Error(`${id} (${theme.name}): no grid found, add words to this theme`);
  });
}

/** One word per line and the grid drawn above it, to proofread by hand. */
function gridSource(grid: Grid, theme?: string): string {
  const picture = drawGrid(grid).map((row) => `   * ${row}`);
  const words = grid.words.map(
    (w) =>
      `      { number: ${String(w.number)}, row: ${String(w.row)}, col: ${String(w.col)}, ` +
      `direction: '${w.direction}', answer: '${w.answer}', clue: ${JSON.stringify(w.clue)} },`,
  );
  return [
    '  /*',
    ...picture,
    '   */',
    '  {',
    `    id: '${grid.id}',`,
    ...(theme === undefined ? [] : [`    theme: ${JSON.stringify(theme)},`]),
    `    width: ${String(grid.width)},`,
    `    height: ${String(grid.height)},`,
    '    words: [',
    ...words,
    '    ],',
    '  },',
  ].join('\n');
}

function writeGrids(file: string, constant: string, type: string, sources: string[]): void {
  const header = [
    '// Generated by scripts/generate-grids.ts (npm run generate:grids), then proofread by hand.',
    '// Clues can be fixed here directly. Changing a word means changing the sources and',
    '// generating again. The tests check every grid (src/content/content.test.ts).',
    `import type { ${type} } from '../../game/grid';`,
    '',
    `export const ${constant}: readonly ${type}[] = [`,
  ];
  writeFileSync(`${OUTPUT_DIR}/${file}`, [...header, ...sources, '];', ''].join('\n'));
}

function main(): void {
  const random = seeded(SEED);
  const themes = readThemes();
  const roundWords = readRoundWords();
  reportDuplicates([...roundWords, ...themes.flatMap((theme) => theme.entries)]);
  // The longer grids first, while the most words are left to choose from.
  const round2 = buildRoundGrids(roundWords, 2, random);
  const round1 = buildRoundGrids(round2.pool, 1, random);
  const finals = buildFinalGrids(themes, random);
  const errors = [
    ...round1.grids.flatMap((grid) => validateGrid(grid, ROUND_WORD_COUNTS[0] ?? 0)),
    ...round2.grids.flatMap((grid) => validateGrid(grid, ROUND_WORD_COUNTS[1] ?? 0)),
    ...finals.flatMap((grid) => validateFinalGrid(grid, FINAL_WORD_COUNT)),
    ...validateGridSet([...round1.grids, ...round2.grids, ...finals]),
  ];
  if (errors.length > 0) throw new Error(errors.join('\n'));
  writeGrids(
    'round1.ts',
    'ROUND_1_GRIDS',
    'Grid',
    round1.grids.map((grid) => gridSource(grid)),
  );
  writeGrids(
    'round2.ts',
    'ROUND_2_GRIDS',
    'Grid',
    round2.grids.map((grid) => gridSource(grid)),
  );
  writeGrids(
    'final.ts',
    'FINAL_GRIDS',
    'FinalGrid',
    finals.map((grid) => gridSource(grid, grid.theme)),
  );
  console.warn(
    `${String(round1.grids.length + round2.grids.length)} round grids, ` +
      `${String(finals.length)} final grids, ${String(round1.pool.length)} words left unused.`,
  );
}

main();
