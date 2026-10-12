import type { Team } from './state';

export interface RankedTeam {
  team: number;
  /** 1 for the best; tied teams share a rank. */
  rank: number;
}

/**
 * The finalist first, then the players who went furthest, then the best score
 * of the last round they played.
 */
export function rankTeams(teams: readonly Team[], finalist: number | null): RankedTeam[] {
  const key = (team: number): number[] => {
    const scores = teams[team]?.scores ?? [];
    return [team === finalist ? 1 : 0, scores.length, scores[scores.length - 1] ?? 0];
  };
  const compare = (a: number, b: number): number => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < ka.length; i += 1) {
      const diff = (kb[i] ?? 0) - (ka[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  const order = teams.map((_, index) => index).sort((a, b) => compare(a, b) || a - b);
  return order.map((team) => ({
    team,
    rank: 1 + order.filter((other) => compare(other, team) < 0).length,
  }));
}
