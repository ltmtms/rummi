import { COLORS, type Tile } from "./tiles";

export type MeldKind = "run" | "group";

export interface MeldAnalysis {
  valid: boolean;
  kind: MeldKind | null;
  value: number;
  ordered: Tile[];
  reason?: string;
}

function asRun(tiles: Tile[]): { ordered: Tile[]; value: number } | null {
  const n = tiles.length;
  if (n < 3 || n > 13) return null;
  const jokers = tiles.filter((t) => t.joker);
  const regular = tiles.filter((t) => !t.joker);
  if (regular.length === 0) return null;
  const color = regular[0].color;
  if (regular.some((t) => t.color !== color)) return null;
  const sorted = [...regular].sort((a, b) => a.number! - b.number!);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].number === sorted[i - 1].number) return null;
  }
  const min = sorted[0].number!;
  const max = sorted[sorted.length - 1].number!;
  if (max - min + 1 > n) return null;

  let start = min;
  if (start + n - 1 > 13) start = 14 - n;

  const byNumber = new Map(sorted.map((t) => [t.number!, t]));
  const spare = [...jokers];
  const ordered: Tile[] = [];
  let value = 0;
  for (let k = start; k < start + n; k++) {
    ordered.push(byNumber.get(k) ?? spare.shift()!);
    value += k;
  }
  return { ordered, value };
}

function asGroup(tiles: Tile[]): { ordered: Tile[]; value: number } | null {
  const n = tiles.length;
  if (n < 3 || n > 4) return null;
  const regular = tiles.filter((t) => !t.joker);
  if (regular.length === 0) return null;
  const num = regular[0].number!;
  if (regular.some((t) => t.number !== num)) return null;
  const colors = new Set(regular.map((t) => t.color));
  if (colors.size !== regular.length) return null;
  const ordered = [
    ...[...regular].sort((a, b) => COLORS.indexOf(a.color!) - COLORS.indexOf(b.color!)),
    ...tiles.filter((t) => t.joker),
  ];
  return { ordered, value: num * n };
}

export function analyzeMeld(tiles: Tile[]): MeldAnalysis {
  if (tiles.length < 3) {
    return { valid: false, kind: null, value: 0, ordered: tiles, reason: "Sets need at least 3 tiles" };
  }
  const run = asRun(tiles);
  if (run) return { valid: true, kind: "run", ...run };
  const group = asGroup(tiles);
  if (group) return { valid: true, kind: "group", ...group };
  return { valid: false, kind: null, value: 0, ordered: tiles, reason: "Not a valid run or group" };
}

export function arrangeTiles(tiles: Tile[]): Tile[] {
  return analyzeMeld(tiles).ordered;
}
