import { z } from "zod";
import type { Difficulty, GameConfig, GameState } from "./game";
import { numericHue, safeHue } from "./hue";
import { createDeck, type Color } from "./tiles";

// Zod's fast parser compiles with `new Function`. A strict CSP reports that
// probe even when the exception is caught, so stay on the interpreter.
z.config({ jitless: true });

export const SAVE_KEY = "rummi:game:v1";
export const CONFIG_KEY = "rummi:config:v1";
export const DEFAULT_CONFIG: GameConfig = { playerName: "", opponents: 2, difficulty: "normal" };

/** Reject oversized blobs before parsing. A real save is tens of kilobytes. */
const MAX_SAVE_CHARS = 250_000;

const COLORS = ["black", "blue", "orange", "red"] as const satisfies readonly Color[];
const TILE_ID = /^(?:(?:black|blue|orange|red)-(?:[1-9]|1[0-3])-[01]|joker-[01])$/;
const MELD_ID = /^m[0-9a-z]{4,40}$/;
const PLAYER_ID = /^[A-Za-z0-9_-]{1,32}$/;
const NO_CONTROLS = /^[^\u0000-\u001F\u007F]*$/;

const difficulties = ["easy", "normal", "hard"] as const satisfies readonly Difficulty[];

const hueSchema = z.unknown().transform((value, ctx) => {
  const n = numericHue(value);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "hue must be a finite number" });
    return 0;
  }
  return safeHue(n);
});

const tileSchema = z
  .strictObject({
    id: z.string().regex(TILE_ID),
    color: z.enum(COLORS).nullable(),
    number: z.int().min(1).max(13).nullable(),
    joker: z.boolean(),
  })
  .refine((tile) => {
    if (tile.joker) return tile.color === null && tile.number === null;
    return tile.color !== null && tile.number !== null && tile.id.startsWith(`${tile.color}-${tile.number}-`);
  });

const meldSchema = z.strictObject({
  id: z.string().regex(MELD_ID),
  tiles: z.array(tileSchema).min(1).max(106),
});

const playerSchema = z.strictObject({
  id: z.string().regex(PLAYER_ID),
  name: z.string().min(1).max(16).regex(NO_CONTROLS),
  isHuman: z.boolean(),
  rack: z.array(tileSchema).max(106),
  hasMelded: z.boolean(),
  score: z.int().min(-20_000_000).max(20_000_000),
  hue: hueSchema,
});

const logSchema = z.strictObject({
  id: z.int().nonnegative().max(1_000_000),
  text: z.string().min(1).max(300).regex(NO_CONTROLS),
  playerId: z.string().regex(PLAYER_ID).optional(),
});

const roundResultSchema = z.strictObject({
  playerId: z.string().regex(PLAYER_ID),
  delta: z.int().min(-100_000).max(100_000),
  penalty: z.int().min(0).max(10_000),
});

const gameStateSchema = z
  .strictObject({
    version: z.literal(1),
    round: z.int().min(1).max(100_000),
    difficulty: z.enum(difficulties),
    players: z.array(playerSchema).min(2).max(4),
    pool: z.array(tileSchema).max(106),
    table: z.array(meldSchema).max(106),
    current: z.int().nonnegative(),
    turnStart: z.strictObject({
      table: z.array(meldSchema).max(106),
      rack: z.array(tileSchema).max(106),
    }),
    status: z.enum(["playing", "over"]),
    winnerId: z.string().regex(PLAYER_ID).nullable(),
    roundResults: z.array(roundResultSchema).max(4).nullable(),
    consecutivePasses: z.int().nonnegative(),
    lastPlacedIds: z.array(z.string().regex(TILE_ID)).max(106),
    lastDrawnId: z.string().regex(TILE_ID).nullable(),
    log: z.array(logSchema).max(40),
    logCounter: z.int().nonnegative().max(1_000_000),
  })
  .refine(isCoherentGame);

const gameConfigSchema = z.strictObject({
  playerName: z.string().max(16).regex(NO_CONTROLS),
  opponents: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  difficulty: z.enum(difficulties),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function liveTileIds(state: {
  players: { rack: { id: string }[] }[];
  pool: { id: string }[];
  table: { tiles: { id: string }[] }[];
}): string[] {
  const ids: string[] = [];
  for (const player of state.players) for (const tile of player.rack) ids.push(tile.id);
  for (const tile of state.pool) ids.push(tile.id);
  for (const meld of state.table) for (const tile of meld.tiles) ids.push(tile.id);
  return ids;
}

function isCoherentGame(state: {
  players: { id: string; isHuman: boolean; rack: { id: string }[] }[];
  pool: { id: string }[];
  table: { tiles: { id: string }[] }[];
  current: number;
  status: "playing" | "over";
  winnerId: string | null;
  roundResults: { playerId: string }[] | null;
  consecutivePasses: number;
  log: { id: number }[];
  logCounter: number;
}): boolean {
  if (!state.players[0]?.isHuman) return false;
  if (state.players.slice(1).some((player) => player.isHuman)) return false;
  if (new Set(state.players.map((player) => player.id)).size !== state.players.length) return false;
  if (state.current >= state.players.length) return false;
  if (state.consecutivePasses > state.players.length) return false;

  const ids = liveTileIds(state);
  const expected = createDeck().map((tile) => tile.id);
  if (ids.length !== expected.length || new Set(ids).size !== ids.length) return false;
  const present = new Set(ids);
  if (expected.some((id) => !present.has(id))) return false;

  for (const entry of state.log) {
    if (entry.id > state.logCounter) return false;
  }

  if (state.status === "playing") return state.winnerId === null && state.roundResults === null;

  if (state.winnerId === null || state.roundResults === null) return false;
  if (!state.players.some((player) => player.id === state.winnerId)) return false;
  if (state.roundResults.length !== state.players.length) return false;
  const resultIds = new Set(state.roundResults.map((result) => result.playerId));
  return state.players.every((player) => resultIds.has(player.id));
}

export function parseGameState(data: unknown): GameState | null {
  const result = gameStateSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** Merge known config fields onto the defaults, then schema-check the result. */
export function parseGameConfig(data: unknown): GameConfig | null {
  if (!isRecord(data)) return null;
  const merged = {
    playerName: "playerName" in data ? data.playerName : DEFAULT_CONFIG.playerName,
    opponents: "opponents" in data ? data.opponents : DEFAULT_CONFIG.opponents,
    difficulty: "difficulty" in data ? data.difficulty : DEFAULT_CONFIG.difficulty,
  };
  const result = gameConfigSchema.safeParse(merged);
  return result.success ? result.data : null;
}

function readKey<T>(key: string, parse: (data: unknown) => T | null, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    if (raw.length > MAX_SAVE_CHARS) {
      localStorage.removeItem(key);
      return fallback;
    }
    const value = parse(JSON.parse(raw));
    if (value === null) {
      localStorage.removeItem(key);
      return fallback;
    }
    return value;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage can throw when it is disabled. Still start from a fresh game.
    }
    return fallback;
  }
}

export function loadSaved(): { game: GameState | null; config: GameConfig } {
  if (typeof window === "undefined") return { game: null, config: DEFAULT_CONFIG };
  return {
    config: readKey(CONFIG_KEY, parseGameConfig, DEFAULT_CONFIG),
    game: readKey(SAVE_KEY, parseGameState, null),
  };
}
