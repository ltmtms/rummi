import { commitTurn, drawTile, type Difficulty, type GameState } from "./game";
import { analyzeMeld, arrangeTiles } from "./meld";
import { COLORS, INITIAL_MELD_MIN, newMeldId, tileKey, type Meld, type Tile } from "./tiles";

interface Candidate {
  keys: string[];
  jokers: number;
  value: number;
}

const NODE_LIMIT: Record<Difficulty, number> = { easy: 400, normal: 6000, hard: 40000 };

function countTiles(rack: Tile[]) {
  const counts = new Map<string, number>();
  let jokers = 0;
  for (const t of rack) {
    if (t.joker) jokers++;
    else counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
  }
  return { counts, jokers };
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [...combinations(rest, size - 1).map((c) => [head, ...c]), ...combinations(rest, size)];
}

function generateCandidates(counts: Map<string, number>, jokers: number, maxJokers: number): Candidate[] {
  const cands: Candidate[] = [];
  const usable = Math.min(jokers, maxJokers);

  for (let n = 1; n <= 13; n++) {
    const avail = COLORS.filter((c) => (counts.get(`${c}-${n}`) ?? 0) > 0);
    for (let size = 3; size <= 4; size++) {
      for (let j = 0; j <= usable; j++) {
        const real = size - j;
        if (real < 1 || real > avail.length) continue;
        for (const combo of combinations(avail, real)) {
          cands.push({ keys: combo.map((c) => `${c}-${n}`), jokers: j, value: n * size });
        }
      }
    }
  }

  for (const color of COLORS) {
    for (let start = 1; start <= 11; start++) {
      for (let end = start + 2; end <= 13; end++) {
        const keys: string[] = [];
        let missing = 0;
        let value = 0;
        for (let k = start; k <= end; k++) {
          value += k;
          if ((counts.get(`${color}-${k}`) ?? 0) > 0) keys.push(`${color}-${k}`);
          else missing++;
        }
        if (missing > usable) break;
        if (keys.length >= 1) cands.push({ keys, jokers: missing, value });
      }
    }
  }
  return cands;
}

function bestCombination(
  rack: Tile[],
  difficulty: Difficulty,
  needInitial: boolean,
): Candidate[] {
  const { counts, jokers } = countTiles(rack);
  const maxJokers = difficulty === "easy" ? (needInitial ? 1 : 0) : 2;
  const cands = generateCandidates(counts, jokers, maxJokers).sort(
    (a, b) => b.keys.length + b.jokers - (a.keys.length + a.jokers) || b.value - a.value,
  );

  const score = (chosen: Candidate[]) => {
    let tiles = 0;
    let jok = 0;
    let value = 0;
    for (const c of chosen) {
      tiles += c.keys.length + c.jokers;
      jok += c.jokers;
      value += c.value;
    }
    if (needInitial && value < INITIAL_MELD_MIN) return -Infinity;
    const remaining = rack.length - tiles;
    return tiles * 10 - jok * 4 + value * 0.05 + (remaining === 0 ? 1000 : 0);
  };

  let best: Candidate[] = [];
  let bestScore = needInitial ? -Infinity : 0;
  let nodes = 0;
  const limit = NODE_LIMIT[difficulty];
  const chosen: Candidate[] = [];
  let jokersLeft = jokers;

  const fits = (c: Candidate) => c.jokers <= jokersLeft && c.keys.every((k) => (counts.get(k) ?? 0) > 0);
  const take = (c: Candidate, dir: 1 | -1) => {
    jokersLeft -= c.jokers * dir;
    for (const k of c.keys) counts.set(k, (counts.get(k) ?? 0) - dir);
  };

  const rec = (from: number) => {
    nodes++;
    if (chosen.length > 0) {
      const s = score(chosen);
      if (s > bestScore) {
        bestScore = s;
        best = [...chosen];
      }
    }
    for (let i = from; i < cands.length && nodes < limit; i++) {
      const c = cands[i];
      if (!fits(c)) continue;
      take(c, 1);
      chosen.push(c);
      rec(i);
      chosen.pop();
      take(c, -1);
    }
  };
  rec(0);
  return best;
}

function materialize(rack: Tile[], combo: Candidate[]): { melds: Meld[]; rack: Tile[] } {
  let remaining = [...rack];
  const melds: Meld[] = [];
  for (const c of combo) {
    const tiles: Tile[] = [];
    for (const key of c.keys) {
      const idx = remaining.findIndex((t) => !t.joker && tileKey(t) === key);
      tiles.push(remaining[idx]);
      remaining = remaining.filter((_, i) => i !== idx);
    }
    for (let j = 0; j < c.jokers; j++) {
      const idx = remaining.findIndex((t) => t.joker);
      tiles.push(remaining[idx]);
      remaining = remaining.filter((_, i) => i !== idx);
    }
    melds.push({ id: newMeldId(), tiles: arrangeTiles(tiles) });
  }
  return { melds, rack: remaining };
}

function tryPlaceTile(table: Meld[], tile: Tile, allowSplit: boolean): Meld[] | null {
  for (const meld of table) {
    const merged = analyzeMeld([...meld.tiles, tile]);
    if (merged.valid) {
      return table.map((m) => (m.id === meld.id ? { ...m, tiles: merged.ordered } : m));
    }
  }
  if (!allowSplit) return null;
  for (const meld of table) {
    const a = analyzeMeld(meld.tiles);
    if (a.kind !== "run") continue;
    const ordered = a.ordered;
    for (let p = 2; p <= ordered.length - 2; p++) {
      const left = ordered.slice(0, p);
      const right = ordered.slice(p);
      for (const [l, r] of [
        [[...left, tile], right],
        [left, [tile, ...right]],
      ]) {
        const la = analyzeMeld(l);
        const ra = analyzeMeld(r);
        if (la.valid && ra.valid) {
          return table.flatMap((m) =>
            m.id === meld.id ? [{ ...m, tiles: la.ordered }, { id: newMeldId(), tiles: ra.ordered }] : [m],
          );
        }
      }
    }
  }
  return null;
}

function removableTiles(table: Meld[]): { tile: Tile; meldId: string }[] {
  const out: { tile: Tile; meldId: string }[] = [];
  for (const meld of table) {
    const a = analyzeMeld(meld.tiles);
    if (!a.valid || meld.tiles.length < 4) continue;
    const picks = a.kind === "group" ? a.ordered : [a.ordered[0], a.ordered[a.ordered.length - 1]];
    for (const tile of picks) if (!tile.joker) out.push({ tile, meldId: meld.id });
  }
  return out;
}

function borrowStep(table: Meld[], rack: Tile[], difficulty: Difficulty): { table: Meld[]; rack: Tile[] } | null {
  for (const { tile, meldId } of removableTiles(table)) {
    const combo = bestCombination([...rack, tile], difficulty, false);
    if (combo.length === 0) continue;
    const { melds, rack: rest } = materialize([...rack, tile], combo);
    if (rest.some((t) => t.id === tile.id)) continue;
    const nextTable = [
      ...table.map((m) => (m.id === meldId ? { ...m, tiles: arrangeTiles(m.tiles.filter((t) => t.id !== tile.id)) } : m)),
      ...melds,
    ];
    if (nextTable.every((m) => analyzeMeld(m.tiles).valid)) return { table: nextTable, rack: rest };
  }
  return null;
}

export interface PlannedMove {
  table: Meld[];
  rack: Tile[];
  placed: Tile[];
}

export function planMove(state: GameState, playerIndex: number): PlannedMove | null {
  const player = state.players[playerIndex];
  const difficulty = state.difficulty;
  const combo = bestCombination(player.rack, difficulty, !player.hasMelded);
  const materialized = materialize(player.rack, combo);
  const melds = materialized.melds;
  let rack = materialized.rack;
  let table = [...state.table, ...melds];

  if (player.hasMelded) {
    const allowSplit = difficulty === "hard";
    const maxExtensions = difficulty === "easy" ? 1 : Infinity;
    let extensions = 0;
    if (difficulty !== "easy") {
      for (let i = 0; i < 4 && rack.length > 0; i++) {
        const step = borrowStep(table, rack, difficulty);
        if (!step) break;
        table = step.table;
        rack = step.rack;
      }
    }
    let progress = true;
    while (progress && extensions < maxExtensions) {
      progress = false;
      for (const tile of rack) {
        if (tile.joker && rack.some((t) => !t.joker)) continue;
        const next = tryPlaceTile(table, tile, allowSplit);
        if (next) {
          table = next;
          rack = rack.filter((t) => t.id !== tile.id);
          extensions++;
          progress = true;
          break;
        }
      }
    }
  }

  const rackIds = new Set(rack.map((t) => t.id));
  const placed = player.rack.filter((t) => !rackIds.has(t.id));
  if (placed.length === 0) return null;
  return { table, rack, placed };
}

export function playBotTurn(state: GameState): GameState {
  const move = planMove(state, state.current);
  if (!move) return drawTile(state);
  const players = state.players.map((p, i) => (i === state.current ? { ...p, rack: move.rack } : p));
  return commitTurn({ ...state, players, table: move.table });
}
