import { analyzeMeld, arrangeTiles } from "./meld";
import {
  createDeck,
  INITIAL_MELD_MIN,
  newMeldId,
  rackPenalty,
  shuffle,
  sortTiles,
  STARTING_HAND,
  type Meld,
  type SortMode,
  type Tile,
} from "./tiles";

export type Difficulty = "easy" | "normal" | "hard";

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  rack: Tile[];
  hasMelded: boolean;
  score: number;
  hue: number;
}

export interface LogEntry {
  id: number;
  text: string;
  playerId?: string;
}

export interface GameState {
  version: 1;
  round: number;
  difficulty: Difficulty;
  players: Player[];
  pool: Tile[];
  table: Meld[];
  current: number;
  turnStart: { table: Meld[]; rack: Tile[] };
  status: "playing" | "over";
  winnerId: string | null;
  roundResults: { playerId: string; delta: number; penalty: number }[] | null;
  consecutivePasses: number;
  lastPlacedIds: string[];
  lastDrawnId: string | null;
  log: LogEntry[];
  logCounter: number;
}

export interface GameConfig {
  playerName: string;
  opponents: number;
  difficulty: Difficulty;
}

export type MoveTarget = { type: "meld"; meldId: string } | { type: "new" } | { type: "rack" };

const BOT_NAMES = ["Ava", "Milo", "Iris", "Kai", "Nova", "Theo"];
const HUES = [152, 262, 24, 200, 330, 48];

export function createGame(config: GameConfig, previous?: GameState): GameState {
  const deck = shuffle(createDeck());
  const botNames = shuffle(BOT_NAMES);
  const players: Player[] = [];
  const count = config.opponents + 1;
  for (let i = 0; i < count; i++) {
    const prev = previous?.players[i];
    players.push({
      id: prev?.id ?? (i === 0 ? "you" : `bot-${i}`),
      name: prev?.name ?? (i === 0 ? config.playerName || "You" : botNames[i - 1]),
      isHuman: i === 0,
      rack: sortTiles(deck.splice(0, STARTING_HAND), "run"),
      hasMelded: false,
      score: prev?.score ?? 0,
      hue: HUES[i],
    });
  }
  const round = previous ? previous.round + 1 : 1;
  const first = (round - 1) % count;
  const state: GameState = {
    version: 1,
    round,
    difficulty: config.difficulty,
    players,
    pool: deck,
    table: [],
    current: first,
    turnStart: { table: [], rack: players[first].rack },
    status: "playing",
    winnerId: null,
    roundResults: null,
    consecutivePasses: 0,
    lastPlacedIds: [],
    lastDrawnId: null,
    log: [],
    logCounter: 0,
  };
  return addLog(state, `Round ${round} begins. First turn: ${players[first].name}.`);
}

function addLog(state: GameState, text: string, playerId?: string): GameState {
  const id = state.logCounter + 1;
  return { ...state, logCounter: id, log: [{ id, text, playerId }, ...state.log].slice(0, 40) };
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.current];
}

export function tableOriginIds(state: GameState): Set<string> {
  return new Set(state.turnStart.table.flatMap((m) => m.tiles.map((t) => t.id)));
}

export function placedThisTurn(state: GameState): Tile[] {
  const rackIds = new Set(currentPlayer(state).rack.map((t) => t.id));
  return state.turnStart.rack.filter((t) => !rackIds.has(t.id));
}

export function initialMeldPoints(state: GameState): number {
  const origin = tableOriginIds(state);
  return state.table
    .filter((m) => !m.tiles.some((t) => origin.has(t.id)))
    .reduce((sum, m) => {
      const a = analyzeMeld(m.tiles);
      return sum + (a.valid ? a.value : 0);
    }, 0);
}

export function isLockedTile(state: GameState, tileId: string): boolean {
  if (currentPlayer(state).hasMelded) return false;
  return tableOriginIds(state).has(tileId);
}

export function isLockedMeld(state: GameState, meld: Meld): boolean {
  if (currentPlayer(state).hasMelded) return false;
  const origin = tableOriginIds(state);
  return meld.tiles.some((t) => origin.has(t.id));
}

export function canMove(state: GameState, tileIds: string[], target: MoveTarget): string | null {
  if (state.status !== "playing") return "The round is over";
  const player = currentPlayer(state);
  if (!player.isHuman) return "Wait for your turn";
  if (tileIds.length === 0) return "Select tiles first";
  const origin = tableOriginIds(state);
  if (target.type === "rack" && tileIds.some((id) => origin.has(id))) {
    return "Tiles already on the table can't go back to your rack";
  }
  if (!player.hasMelded) {
    if (tileIds.some((id) => origin.has(id))) {
      return `Make your initial meld (${INITIAL_MELD_MIN}+ points) before rearranging the table`;
    }
    if (target.type === "meld") {
      const meld = state.table.find((m) => m.id === target.meldId);
      if (meld && isLockedMeld(state, meld)) {
        return `Make your initial meld (${INITIAL_MELD_MIN}+ points) before adding to existing sets`;
      }
    }
  }
  return null;
}

export function moveTiles(state: GameState, tileIds: string[], target: MoveTarget): GameState {
  if (canMove(state, tileIds, target)) return state;
  const ids = new Set(tileIds);
  const player = currentPlayer(state);
  const moving: Tile[] = [];

  for (const t of player.rack) if (ids.has(t.id)) moving.push(t);
  for (const m of state.table) for (const t of m.tiles) if (ids.has(t.id)) moving.push(t);
  if (moving.length === 0) return state;

  let rack = player.rack.filter((t) => !ids.has(t.id));
  let table = state.table
    .map((m) => {
      const remaining = m.tiles.filter((t) => !ids.has(t.id));
      return remaining.length === m.tiles.length ? m : { ...m, tiles: arrangeTiles(remaining) };
    })
    .filter((m) => m.tiles.length > 0);

  if (target.type === "rack") {
    rack = [...rack, ...moving];
  } else if (target.type === "new") {
    table = [...table, { id: newMeldId(), tiles: arrangeTiles(moving) }];
  } else {
    const exists = table.some((m) => m.id === target.meldId);
    table = exists
      ? table.map((m) => (m.id === target.meldId ? { ...m, tiles: arrangeTiles([...m.tiles, ...moving]) } : m))
      : [...table, { id: newMeldId(), tiles: arrangeTiles(moving) }];
  }

  const players = state.players.map((p, i) => (i === state.current ? { ...p, rack } : p));
  return { ...state, players, table };
}

export function resetTurn(state: GameState): GameState {
  const players = state.players.map((p, i) =>
    i === state.current ? { ...p, rack: state.turnStart.rack } : p,
  );
  return { ...state, players, table: state.turnStart.table };
}

export function validateTurn(state: GameState): string | null {
  const placed = placedThisTurn(state);
  if (placed.length === 0) return "Play at least one tile from your rack, or draw a tile";
  const invalid = state.table.find((m) => !analyzeMeld(m.tiles).valid);
  if (invalid) return "Every set on the table must be a valid run or group";
  const player = currentPlayer(state);
  if (!player.hasMelded) {
    const pts = initialMeldPoints(state);
    if (pts < INITIAL_MELD_MIN) {
      return `Your initial meld is worth ${pts} points — you need at least ${INITIAL_MELD_MIN}`;
    }
  }
  return null;
}

export function sortRack(state: GameState, playerIndex: number, mode: SortMode): GameState {
  const players = state.players.map((p, i) => (i === playerIndex ? { ...p, rack: sortTiles(p.rack, mode) } : p));
  const turnStart =
    playerIndex === state.current ? { ...state.turnStart, rack: sortTiles(state.turnStart.rack, mode) } : state.turnStart;
  return { ...state, players, turnStart };
}

export function commitTurn(state: GameState): GameState {
  const placed = placedThisTurn(state);
  const player = currentPlayer(state);
  const wasMelded = player.hasMelded;
  const players = state.players.map((p, i) => (i === state.current ? { ...p, hasMelded: true } : p));
  let next: GameState = {
    ...state,
    players,
    table: state.table.map((m) => ({ ...m, tiles: arrangeTiles(m.tiles) })),
    lastPlacedIds: placed.map((t) => t.id),
    lastDrawnId: null,
    consecutivePasses: 0,
  };
  const tileWord = placed.length === 1 ? "tile" : "tiles";
  next = addLog(
    next,
    wasMelded
      ? `${player.name} played ${placed.length} ${tileWord}.`
      : `${player.name} opened with ${placed.length} ${tileWord}.`,
    player.id,
  );
  if (players[state.current].rack.length === 0) return finishRound(next, player.id);
  return advance(next);
}

export function drawTile(state: GameState): GameState {
  let next = resetTurn(state);
  const player = currentPlayer(next);
  if (next.pool.length === 0) {
    next = addLog({ ...next, lastPlacedIds: [], lastDrawnId: null, consecutivePasses: next.consecutivePasses + 1 }, `${player.name} passed — the pool is empty.`, player.id);
    if (next.consecutivePasses >= next.players.length) return finishRound(next, null);
    return advance(next);
  }
  const [drawn, ...pool] = next.pool;
  const players = next.players.map((p, i) => (i === next.current ? { ...p, rack: [...p.rack, drawn] } : p));
  next = addLog(
    { ...next, pool, players, lastPlacedIds: [], lastDrawnId: drawn.id, consecutivePasses: 0 },
    `${player.name} drew a tile.`,
    player.id,
  );
  return advance(next);
}

function advance(state: GameState): GameState {
  const current = (state.current + 1) % state.players.length;
  return {
    ...state,
    current,
    turnStart: { table: state.table, rack: state.players[current].rack },
  };
}

function finishRound(state: GameState, winnerId: string | null): GameState {
  let winner = winnerId;
  if (!winner) {
    winner = [...state.players].sort((a, b) => rackPenalty(a.rack) - rackPenalty(b.rack))[0].id;
  }
  const penalties = state.players.map((p) => ({ id: p.id, penalty: rackPenalty(p.rack) }));
  const winnerPenalty = penalties.find((p) => p.id === winner)!.penalty;
  const pot = penalties.filter((p) => p.id !== winner).reduce((s, p) => s + p.penalty - winnerPenalty, 0);
  const roundResults = penalties.map((p) => ({
    playerId: p.id,
    penalty: p.penalty,
    delta: p.id === winner ? pot : -(p.penalty - winnerPenalty),
  }));
  const players = state.players.map((p) => ({
    ...p,
    score: p.score + roundResults.find((r) => r.playerId === p.id)!.delta,
  }));
  const winnerName = players.find((p) => p.id === winner)!.name;
  return addLog(
    { ...state, players, status: "over", winnerId: winner, roundResults },
    winnerId ? `${winnerName} played the last tile and wins the round!` : `The pool ran dry. ${winnerName} wins with the fewest points left.`,
    winner,
  );
}
