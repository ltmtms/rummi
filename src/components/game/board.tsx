"use client";

import { Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { analyzeMeld } from "@/lib/rummi/meld";
import type { MoveTarget } from "@/lib/rummi/game";
import type { Meld } from "@/lib/rummi/tiles";
import { cn } from "@/lib/utils";
import { TileView } from "./tile-view";

interface BoardProps {
  table: Meld[];
  myTurn: boolean;
  hasMelded: boolean;
  selected: Set<string>;
  hasSelection: boolean;
  lastPlacedIds: Set<string>;
  originIds: Set<string>;
  isLockedMeld: (meld: Meld) => boolean;
  onTileClick: (tileId: string) => void;
  onDragTile: (e: React.DragEvent, tileId: string) => void;
  onMove: (target: MoveTarget, ids?: string[]) => void;
}

function readDrop(e: React.DragEvent): string[] | null {
  try {
    const ids = JSON.parse(e.dataTransfer.getData("application/x-rummi"));
    return Array.isArray(ids) ? ids : null;
  } catch {
    return null;
  }
}

export function useDropTarget(onDropIds: (ids: string[]) => void, enabled: boolean) {
  const [over, setOver] = useState(false);
  return {
    over: over && enabled,
    props: enabled
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes("application/x-rummi")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOver(true);
          },
          onDragLeave: (e: React.DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setOver(false);
            const ids = readDrop(e);
            if (ids) onDropIds(ids);
          },
        }
      : {},
  };
}

function MeldView({
  meld,
  props,
}: {
  meld: Meld;
  props: Omit<BoardProps, "table">;
}) {
  const analysis = analyzeMeld(meld.tiles);
  const locked = props.myTurn && props.isLockedMeld(meld);
  const canTarget = props.myTurn && !locked;
  const drop = useDropTarget((ids) => props.onMove({ type: "meld", meldId: meld.id }, ids), canTarget);
  const isNew = props.myTurn && !meld.tiles.some((t) => props.originIds.has(t.id));
  const showPoints = isNew && !props.hasMelded && analysis.valid;

  return (
    <div
      {...drop.props}
      className={cn(
        "group/meld relative flex items-center gap-1 rounded-xl p-1.5 transition-colors",
        "bg-black/15 ring-1 ring-white/5",
        !analysis.valid && "bg-red-500/10 ring-0 outline-2 outline-dashed outline-red-400/70",
        drop.over && "bg-amber-300/15 ring-2 ring-amber-300",
      )}
    >
      {(!analysis.valid || showPoints) && (
        <span
          className={cn(
            "absolute -top-2.5 left-2 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow",
            analysis.valid ? "bg-emerald-400 text-emerald-950" : "bg-red-500 text-white",
          )}
        >
          {analysis.valid ? (
            `+${analysis.value}`
          ) : (
            <>
              <TriangleAlert className="size-2.5" /> {meld.tiles.length < 3 ? "Too short" : "Invalid"}
            </>
          )}
        </span>
      )}
      {meld.tiles.map((tile) => {
        const tileLocked = props.myTurn && locked;
        return (
          <TileView
            key={tile.id}
            tile={tile}
            size="md"
            locked={tileLocked}
            selected={props.selected.has(tile.id)}
            highlight={props.lastPlacedIds.has(tile.id) ? "placed" : null}
            onClick={props.myTurn ? () => props.onTileClick(tile.id) : undefined}
            draggable={props.myTurn && !tileLocked}
            onDragStart={(e) => props.onDragTile(e, tile.id)}
          />
        );
      })}
      {canTarget && props.hasSelection && (
        <button
          type="button"
          aria-label="Add selected tiles to this set"
          onClick={() => props.onMove({ type: "meld", meldId: meld.id })}
          className="flex h-12 w-8 items-center justify-center rounded-md border-2 border-dashed border-amber-300/70 text-amber-200 transition hover:bg-amber-300/15 sm:h-14 sm:w-9"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Board(props: BoardProps) {
  const { table, myTurn, hasSelection, onMove, hasMelded } = props;
  const newSet = useDropTarget((ids) => onMove({ type: "new" }, ids), myTurn);

  return (
    <div className="flex min-h-full flex-wrap content-start items-start gap-x-3 gap-y-5 p-4 pt-6 sm:p-6 sm:pt-7">
      {table.map((meld) => (
        <MeldView key={meld.id} meld={meld} props={props} />
      ))}

      {myTurn && (
        <button
          type="button"
          {...newSet.props}
          onClick={() => onMove({ type: "new" })}
          disabled={!hasSelection}
          className={cn(
            "flex h-[60px] items-center gap-2 rounded-xl border-2 border-dashed px-4 text-sm font-medium transition sm:h-[68px]",
            hasSelection || newSet.over
              ? "border-amber-300/80 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
              : "border-white/15 text-white/35",
            newSet.over && "bg-amber-300/25",
          )}
        >
          <Plus className="size-4" /> New set
        </button>
      )}

      {table.length === 0 && (
        <div className="flex w-full flex-col items-center justify-center py-10 text-center sm:py-16">
          <p className="text-base font-medium text-white/70">The table is empty</p>
          <p className="mt-1 max-w-sm text-balance text-sm text-white/40">
            {myTurn && !hasMelded
              ? "Select tiles from your rack and lay down sets worth 30+ points to open."
              : "Sets appear here once a player makes their initial meld of 30+ points."}
          </p>
        </div>
      )}
    </div>
  );
}
