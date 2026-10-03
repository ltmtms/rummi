"use client";

import {
  ArrowDown01,
  BookOpen,
  Check,
  Layers,
  Lightbulb,
  LogOut,
  Rows3,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { playBotTurn, planMove } from "@/lib/rummi/bot";
import {
  canMove,
  commitTurn,
  createGame,
  currentPlayer,
  drawTile,
  initialMeldPoints,
  isLockedMeld,
  isLockedTile,
  moveTiles,
  placedThisTurn,
  resetTurn,
  sortRack,
  tableOriginIds,
  validateTurn,
  type GameConfig,
  type GameState,
  type MoveTarget,
} from "@/lib/rummi/game";
import { INITIAL_MELD_MIN, type SortMode } from "@/lib/rummi/tiles";
import { cn } from "@/lib/utils";
import { Board, useDropTarget } from "./board";
import { Avatar, OpponentCard, ThinkingDots } from "./players";
import { RoundOverDialog } from "./round-over-dialog";
import { RulesDialog } from "./rules-dialog";
import { StartScreen } from "./start-screen";
import { TileView } from "./tile-view";

const SAVE_KEY = "rummi:game:v1";
const CONFIG_KEY = "rummi:config:v1";
const DEFAULT_CONFIG: GameConfig = { playerName: "", opponents: 2, difficulty: "normal" };

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-7 w-5 items-center justify-center rounded-[5px] tile-face text-sm font-bold text-[#dc2f3a]">
        R
      </span>
      <span className="text-base font-semibold tracking-tight text-white">Rummi</span>
    </span>
  );
}

const noopSubscribe = () => () => {};

function loadSaved(): { game: GameState | null; config: GameConfig } {
  if (typeof window === "undefined") return { game: null, config: DEFAULT_CONFIG };
  let config = DEFAULT_CONFIG;
  let game: GameState | null = null;
  try {
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GameState;
      if (parsed.version === 1) game = parsed;
    }
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
  return { game, config };
}

export function Game() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [saved] = useState(loadSaved);
  const [game, setGame] = useState<GameState | null>(saved.game);
  const [config, setConfig] = useState<GameConfig>(saved.config);
  const [screen, setScreen] = useState<"start" | "play">(saved.game?.status === "playing" ? "play" : "start");
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const [hint, setHint] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("run");
  const [drawnId, setDrawnId] = useState<string | null>(null);

  const turnKey = game ? `${game.round}:${game.current}:${game.logCounter}` : "";
  const selected = useMemo(() => (selection.key === turnKey ? selection.ids : []), [selection, turnKey]);
  const hintIds = hint.key === turnKey ? hint.ids : [];
  const setSelected = useCallback(
    (update: string[] | ((prev: string[]) => string[])) =>
      setSelection((s) => {
        const prev = s.key === turnKey ? s.ids : [];
        return { key: turnKey, ids: typeof update === "function" ? update(prev) : update };
      }),
    [turnKey],
  );
  const setHintIds = (ids: string[]) => setHint({ key: turnKey, ids });
  const roundOverOpen = game?.status === "over" && dismissedRound !== game.round;
  const setRoundOverOpen = (open: boolean) => setDismissedRound(open ? null : (game?.round ?? null));

  useEffect(() => {
    if (!hydrated) return;
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  }, [game, hydrated]);

  useEffect(() => {
    if (screen !== "play" || !game || game.status !== "playing") return;
    if (currentPlayer(game).isHuman) return;
    const delay = 900 + Math.random() * 700;
    const timer = setTimeout(() => setGame((g) => (g && g.status === "playing" ? playBotTurn(g) : g)), delay);
    return () => clearTimeout(timer);
  }, [game, screen]);

  useEffect(() => {
    if (hint.ids.length === 0) return;
    const timer = setTimeout(() => setHint({ key: "", ids: [] }), 4000);
    return () => clearTimeout(timer);
  }, [hint]);

  const startGame = useCallback((cfg: GameConfig) => {
    setConfig(cfg);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    setGame(createGame(cfg));
    setDismissedRound(null);
    setDrawnId(null);
    setScreen("play");
  }, []);

  const move = useCallback(
    (target: MoveTarget, ids?: string[]) => {
      if (!game) return;
      const tileIds = ids ?? selected;
      const err = canMove(game, tileIds, target);
      if (err) {
        if (tileIds.length > 0) toast.error(err);
        return;
      }
      setGame(moveTiles(game, tileIds, target));
      setSelected([]);
    },
    [game, selected, setSelected],
  );

  const derived = useMemo(() => {
    if (!game) return null;
    const me = game.players[0];
    const myTurn = game.status === "playing" && game.current === 0;
    return {
      me,
      myTurn,
      placed: myTurn ? placedThisTurn(game) : [],
      originIds: myTurn ? tableOriginIds(game) : new Set<string>(),
      meldPoints: myTurn && !me.hasMelded ? initialMeldPoints(game) : 0,
      changed: myTurn && game.table !== game.turnStart.table,
      lastPlaced: new Set(game.lastPlacedIds),
    };
  }, [game]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const rackDrop = useDropTarget((ids) => move({ type: "rack" }, ids), !!derived?.myTurn);

  if (!hydrated) {
    return (
      <main className="felt flex min-h-dvh flex-1 items-center justify-center">
        <span className="text-sm text-white/50">Shuffling tiles…</span>
      </main>
    );
  }

  if (screen === "start" || !game || !derived) {
    return (
      <>
        <StartScreen
          initial={config}
          canResume={game?.status === "playing"}
          onStart={startGame}
          onResume={() => setScreen("play")}
          onRules={() => setRulesOpen(true)}
        />
        <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      </>
    );
  }

  const { me, myTurn, placed, originIds, meldPoints, changed, lastPlaced } = derived;
  const active = currentPlayer(game);
  const opponents = game.players.slice(1);
  const selectedOnTable = selected.some((id) => !me.rack.some((t) => t.id === id));

  const toggleTile = (id: string) => {
    if (!myTurn) return;
    if (isLockedTile(game, id)) {
      toast.error(`Make your initial meld (${INITIAL_MELD_MIN}+ points) before rearranging the table`);
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const dragTile = (e: React.DragEvent, id: string) => {
    const ids = selected.includes(id) ? selected : [id];
    e.dataTransfer.setData("application/x-rummi", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  };

  const endTurn = () => {
    const err = validateTurn(game);
    if (err) {
      toast.error(err);
      return;
    }
    setDrawnId(null);
    setGame(commitTurn(game));
  };

  const draw = () => {
    const next = drawTile(game);
    setDrawnId(next.lastDrawnId);
    setGame(next);
  };

  const undo = () => {
    setGame(resetTurn(game));
    setSelected([]);
  };

  const showHint = () => {
    const plan = planMove(resetTurn(game), 0);
    if (!plan) {
      toast("No play found — drawing a tile is your best option.");
      return;
    }
    if (changed) setGame(resetTurn(game));
    setSelected([]);
    setHintIds(plan.placed.map((t) => t.id));
    toast(`Try playing the ${plan.placed.length} highlighted tile${plan.placed.length > 1 ? "s" : ""}.`, { duration: 3000 });
  };

  const nextRound = () => {
    setDrawnId(null);
    setGame(createGame({ ...config, opponents: game.players.length - 1, difficulty: game.difficulty }, game));
    setRoundOverOpen(false);
  };

  const sort = (mode: SortMode) => {
    setSortMode(mode);
    setGame(sortRack(game, 0, mode));
  };

  const statusText = (() => {
    if (game.status === "over") return "Round over";
    if (!myTurn) return null;
    if (selected.length > 0) return `${selected.length} selected — tap + on a set or New set`;
    if (placed.length > 0) return `${placed.length} tile${placed.length > 1 ? "s" : ""} played this turn`;
    return me.hasMelded ? "Your turn — play tiles or draw" : "Your turn — open with 30+ points or draw";
  })();

  return (
    <main className="felt relative flex h-dvh flex-1 flex-col overflow-hidden">
      <div className="felt-dots pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/5 px-3 sm:px-5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden text-xs text-white/40 sm:inline">Round {game.round}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="flex h-8 items-center gap-1.5 rounded-lg bg-black/30 px-2.5 text-xs text-white/70 ring-1 ring-white/10"
            title="Tiles left in the pool"
          >
            <Layers className="size-3.5" />
            <span className="tabular-nums font-medium text-white">{game.pool.length}</span>
            <span className="hidden sm:inline">in pool</span>
          </span>
          <Button variant="ghost" size="icon" aria-label="How to play" title="How to play" onClick={() => setRulesOpen(true)}>
            <BookOpen />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Leave game" title="Back to menu" onClick={() => setScreen("start")}>
            <LogOut />
          </Button>
        </div>
      </header>

      <section className="relative z-10 flex shrink-0 gap-2 overflow-x-auto px-3 py-3 sm:px-5">
        {opponents.map((p) => (
          <OpponentCard key={p.id} player={p} active={game.status === "playing" && active.id === p.id} />
        ))}
      </section>

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <Board
            table={game.table}
            myTurn={myTurn}
            hasMelded={me.hasMelded}
            selected={selectedSet}
            hasSelection={selected.length > 0}
            lastPlacedIds={lastPlaced}
            originIds={originIds}
            isLockedMeld={(m) => isLockedMeld(game, m)}
            onTileClick={toggleTile}
            onDragTile={dragTile}
            onMove={move}
          />
        </div>

        <aside className="hidden w-64 shrink-0 flex-col gap-4 border-l border-white/5 p-4 xl:flex">
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Scores</h2>
            <ul className="space-y-1.5">
              {[...game.players]
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <Avatar player={p} size="sm" />
                    <span className="flex-1 truncate text-white/80">{p.name}</span>
                    <span className="tabular-nums font-medium text-white">{p.score}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Activity</h2>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-xs leading-relaxed text-white/55">
              {game.log.map((entry, i) => (
                <li key={entry.id} className={cn(i === 0 && "text-white/90")}>
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section
        {...rackDrop.props}
        className={cn(
          "relative z-10 shrink-0 border-t border-white/10 bg-zinc-950/70 backdrop-blur-xl transition-colors",
          rackDrop.over && "bg-zinc-900/90",
          myTurn && "border-t-emerald-400/40",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar player={me} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  {me.name}
                  {me.hasMelded && (
                    <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Opened</span>
                  )}
                </div>
                <div className="text-xs text-white/50">
                  {statusText ?? (
                    <span className="flex items-center gap-1.5">
                      Waiting for {active.name} <ThinkingDots />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {myTurn && !me.hasMelded && (
              <div className="flex items-center gap-2 text-xs">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all", meldPoints >= INITIAL_MELD_MIN ? "bg-emerald-400" : "bg-amber-400")}
                    style={{ width: `${Math.min(100, (meldPoints / INITIAL_MELD_MIN) * 100)}%` }}
                  />
                </div>
                <span className={cn("tabular-nums", meldPoints >= INITIAL_MELD_MIN ? "text-emerald-300" : "text-white/60")}>
                  {meldPoints}/{INITIAL_MELD_MIN} to open
                </span>
              </div>
            )}
          </div>

          <div
            className={cn(
              "flex min-h-[64px] flex-wrap content-start gap-1.5 rounded-2xl bg-gradient-to-b from-amber-950/40 to-amber-950/20 p-2 ring-1 ring-amber-200/10 sm:min-h-[84px]",
              rackDrop.over && "ring-2 ring-amber-300",
              myTurn && selectedOnTable && "ring-amber-300/50",
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget && selectedOnTable) move({ type: "rack" });
            }}
          >
            {me.rack.length === 0 && <p className="m-auto text-sm text-white/40">Your rack is empty</p>}
            {me.rack.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                size="lg"
                selected={selectedSet.has(tile.id)}
                highlight={hintIds.includes(tile.id) ? "hint" : tile.id === drawnId ? "drawn" : null}
                onClick={myTurn ? () => toggleTile(tile.id) : undefined}
                draggable={myTurn}
                onDragStart={(e) => dragTile(e, tile.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-white/60", sortMode === "run" && "bg-white/10 text-white")}
                onClick={() => sort("run")}
                title="Sort by color, then number"
              >
                <Rows3 /> Runs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-white/60", sortMode === "group" && "bg-white/10 text-white")}
                onClick={() => sort("group")}
                title="Sort by number, then color"
              >
                <ArrowDown01 /> Groups
              </Button>
              {myTurn && (
                <Button variant="ghost" size="sm" className="text-white/60" onClick={showHint}>
                  <Lightbulb /> Hint
                </Button>
              )}
            </div>
            {game.status === "over" && (
              <div className="flex flex-1 items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setRoundOverOpen(true)}>
                  Results
                </Button>
                <Button className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300" onClick={nextRound}>
                  Next round
                </Button>
              </div>
            )}
            {myTurn && (
              <div className="flex flex-1 items-center justify-end gap-2">
                {selectedOnTable && (
                  <Button variant="outline" onClick={() => move({ type: "rack" })}>
                    Back to rack
                  </Button>
                )}
                <Button variant="outline" onClick={undo} disabled={!changed}>
                  <Undo2 /> Undo
                </Button>
                {placed.length === 0 ? (
                  <Button className="min-w-28 bg-sky-400 text-sky-950 hover:bg-sky-300" onClick={draw}>
                    {game.pool.length > 0 ? "Draw tile" : "Pass"}
                  </Button>
                ) : (
                  <Button className="min-w-28 bg-emerald-400 text-emerald-950 hover:bg-emerald-300" onClick={endTurn}>
                    <Check /> End turn
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      {game.status === "over" && (
        <RoundOverDialog
          game={game}
          open={roundOverOpen}
          onOpenChange={setRoundOverOpen}
          onNextRound={nextRound}
          onNewGame={() => {
            setRoundOverOpen(false);
            setScreen("start");
          }}
        />
      )}
    </main>
  );
}
