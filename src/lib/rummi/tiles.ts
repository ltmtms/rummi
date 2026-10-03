export type Color = "black" | "blue" | "orange" | "red";

export const COLORS: Color[] = ["black", "blue", "orange", "red"];

export interface Tile {
  id: string;
  color: Color | null;
  number: number | null;
  joker: boolean;
}

export interface Meld {
  id: string;
  tiles: Tile[];
}

export const JOKER_PENALTY = 30;
export const INITIAL_MELD_MIN = 30;
export const STARTING_HAND = 14;

export function createDeck(): Tile[] {
  const deck: Tile[] = [];
  for (const color of COLORS) {
    for (let n = 1; n <= 13; n++) {
      for (let copy = 0; copy < 2; copy++) {
        deck.push({ id: `${color}-${n}-${copy}`, color, number: n, joker: false });
      }
    }
  }
  deck.push({ id: "joker-0", color: null, number: null, joker: true });
  deck.push({ id: "joker-1", color: null, number: null, joker: true });
  return deck;
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function tileKey(t: Tile): string {
  return t.joker ? "joker" : `${t.color}-${t.number}`;
}

export function penaltyValue(t: Tile): number {
  return t.joker ? JOKER_PENALTY : (t.number ?? 0);
}

export function rackPenalty(rack: Tile[]): number {
  return rack.reduce((s, t) => s + penaltyValue(t), 0);
}

const colorIndex = (c: Color | null) => (c ? COLORS.indexOf(c) : 99);

export type SortMode = "run" | "group";

export function sortTiles(tiles: Tile[], mode: SortMode): Tile[] {
  return [...tiles].sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? 1 : -1;
    if (a.joker) return a.id.localeCompare(b.id);
    if (mode === "run") {
      return colorIndex(a.color) - colorIndex(b.color) || a.number! - b.number! || a.id.localeCompare(b.id);
    }
    return a.number! - b.number! || colorIndex(a.color) - colorIndex(b.color) || a.id.localeCompare(b.id);
  });
}

let meldCounter = 0;
export function newMeldId(): string {
  meldCounter += 1;
  return `m${Date.now().toString(36)}${meldCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
