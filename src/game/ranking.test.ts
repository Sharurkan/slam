import { describe, expect, it } from 'vitest';
import { rankTeams } from './ranking';

const team = (name: string, ...scores: number[]) => ({ name, scores });

describe('rankTeams', () => {
  it('puts the finalist first, then round 2 players, then round 1 players by score', () => {
    const teams = [team('A', 9), team('B', 5, 3), team('C', 7, 8), team('D', 2)];
    expect(rankTeams(teams, 1)).toEqual([
      { team: 1, rank: 1 },
      { team: 2, rank: 2 },
      { team: 0, rank: 3 },
      { team: 3, rank: 4 },
    ]);
  });

  it('ranks by the last round played when there is no final', () => {
    const teams = [team('A', 9), team('B', 5, 3), team('C', 7, 8)];
    expect(rankTeams(teams, null).map((ranked) => ranked.team)).toEqual([2, 1, 0]);
  });

  it('gives tied players the same rank', () => {
    const teams = [team('A', 4), team('B', 6), team('C', 4)];
    expect(rankTeams(teams, null)).toEqual([
      { team: 1, rank: 1 },
      { team: 0, rank: 2 },
      { team: 2, rank: 2 },
    ]);
  });
});
