import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { contentSecurityPolicy } from "./csp";
import { createGame, drawTile, moveTiles } from "./rummi/game";
import { numericHue, safeHue } from "./rummi/hue";
import { CONFIG_KEY, DEFAULT_CONFIG, loadSaved, parseGameConfig, parseGameState, SAVE_KEY } from "./rummi/persist";
import { createDeck, shuffle } from "./rummi/tiles";

const config = { playerName: "Sam", opponents: 2 as const, difficulty: "normal" as const };

function roundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("content security policy", () => {
  it("stays on self and omits eval and frame-ancestors in production", () => {
    const policy = contentSecurityPolicy("production");
    assert.match(policy, /default-src 'self'/);
    assert.match(policy, /font-src 'self'/);
    assert.match(policy, /object-src 'none'/);
    assert.equal(policy.includes("unsafe-eval"), false);
    assert.equal(policy.includes("frame-ancestors"), false);
    assert.equal(policy.includes("\n"), false);
    assert.equal(policy.includes('"'), false);
  });

  it("allows eval only outside production", () => {
    assert.match(contentSecurityPolicy("development"), /unsafe-eval/);
    assert.equal(contentSecurityPolicy("production").includes("unsafe-eval"), false);
  });
});

describe("safeHue", () => {
  it("clamps finite numbers and numeric strings", () => {
    assert.equal(safeHue(152), 152);
    assert.equal(safeHue(9999), 360);
    assert.equal(safeHue(-4), 0);
    assert.equal(safeHue("200"), 200);
    assert.equal(safeHue(" 90 "), 90);
  });

  it("does not treat css fragments as numbers", () => {
    assert.equal(numericHue("0); background: url(https://evil.test)"), null);
    assert.equal(safeHue("0); background: url(https://evil.test)"), 0);
    assert.equal(safeHue("12px"), 0);
    assert.equal(safeHue({ toString: () => "10" }), 0);
    assert.equal(safeHue(Number.POSITIVE_INFINITY), 0);
    assert.equal(safeHue(Number.NaN), 0);
  });
});

describe("saved game schema", () => {
  it("accepts a fresh game, a placed meld, and a later round", () => {
    const state = createGame(config);
    assert.ok(parseGameState(roundTrip(state)));
    const placed = moveTiles(state, state.players[0].rack.slice(0, 3).map((tile) => tile.id), { type: "new" });
    assert.ok(parseGameState(roundTrip(placed)));
    const drawn = drawTile(state);
    assert.ok(parseGameState(roundTrip(drawn)));
    const next = createGame(config, state);
    assert.equal(next.round, 2);
    assert.ok(parseGameState(roundTrip(next)));
  });

  it("clamps a finite out-of-range hue and rejects a css payload", () => {
    const state = createGame(config);
    const high = structuredClone(state);
    high.players[0].hue = 480;
    const parsed = parseGameState(roundTrip(high));
    assert.equal(parsed?.players[0].hue, 360);

    const numericString = structuredClone(state);
    (numericString.players[0] as { hue: unknown }).hue = "210";
    assert.equal(parseGameState(roundTrip(numericString))?.players[0].hue, 210);

    const hostile = structuredClone(state);
    (hostile.players[0] as { hue: unknown }).hue = "0); color: red";
    assert.equal(parseGameState(roundTrip(hostile)), null);
  });

  it("rejects a different version and unknown fields", () => {
    const state = roundTrip(createGame(config)) as Record<string, unknown>;
    assert.equal(parseGameState({ ...state, version: 2 }), null);
    assert.equal(parseGameState({ ...state, extra: true }), null);
  });

  it("merges a partial config and rejects a bad one", () => {
    assert.deepEqual(parseGameConfig({ playerName: "Sam" }), {
      playerName: "Sam",
      opponents: 2,
      difficulty: "normal",
    });
    assert.equal(parseGameConfig({ opponents: 9, difficulty: "god" }), null);
    assert.equal(parseGameConfig(["nope"]), null);
    assert.deepEqual(parseGameConfig({ playerName: "Sam", opponents: 2, difficulty: "normal", extra: true }), {
      playerName: "Sam",
      opponents: 2,
      difficulty: "normal",
    });
  });
});

describe("loadSaved", { concurrency: 1 }, () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  afterEach(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  function install(entries: Record<string, string>): Map<string, string> {
    const store = new Map(Object.entries(entries));
    const storage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
    return store;
  }

  it("keeps a valid save and fills missing config fields", () => {
    const state = createGame(config);
    const store = install({
      [SAVE_KEY]: JSON.stringify(state),
      [CONFIG_KEY]: JSON.stringify({ playerName: "Sam" }),
    });
    const loaded = loadSaved();
    assert.equal(loaded.game?.players[0].name, "Sam");
    assert.equal(loaded.config.opponents, 2);
    assert.equal(store.has(SAVE_KEY), true);
  });

  it("clears a key when json or the schema is bad and starts fresh", () => {
    const state = createGame(config);
    const store = install({
      [SAVE_KEY]: "{",
      [CONFIG_KEY]: JSON.stringify({ opponents: 9 }),
    });
    const loaded = loadSaved();
    assert.equal(loaded.game, null);
    assert.deepEqual(loaded.config, DEFAULT_CONFIG);
    assert.equal(store.has(SAVE_KEY), false);
    assert.equal(store.has(CONFIG_KEY), false);

    const again = install({ [SAVE_KEY]: JSON.stringify({ ...state, version: 2 }) });
    assert.equal(loadSaved().game, null);
    assert.equal(again.has(SAVE_KEY), false);
  });
});

describe("shuffle", () => {
  it("returns a permutation using crypto, not Math.random", () => {
    const deck = createDeck();
    const original = Math.random;
    Math.random = () => {
      throw new Error("Math.random");
    };
    try {
      const shuffled = shuffle(deck);
      assert.equal(shuffled.length, deck.length);
      assert.deepEqual(
        shuffled.map((tile) => tile.id).sort(),
        deck.map((tile) => tile.id).sort(),
      );
      assert.notDeepEqual(
        shuffled.map((tile) => tile.id),
        deck.map((tile) => tile.id),
      );
    } finally {
      Math.random = original;
    }
  });
});
