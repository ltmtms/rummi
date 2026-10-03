"use client";

import { Smile } from "lucide-react";
import type { Color, Tile } from "@/lib/rummi/tiles";
import { cn } from "@/lib/utils";

const COLOR_CLASS: Record<Color, string> = {
  black: "text-zinc-900",
  blue: "text-[#2f5fe0]",
  orange: "text-[#ea6a12]",
  red: "text-[#dc2f3a]",
};

const DOT_CLASS: Record<Color, string> = {
  black: "bg-zinc-900",
  blue: "bg-[#2f5fe0]",
  orange: "bg-[#ea6a12]",
  red: "bg-[#dc2f3a]",
};

export type TileSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<TileSize, string> = {
  sm: "h-9 w-[26px] text-sm rounded-[5px]",
  md: "h-12 w-9 text-xl sm:h-14 sm:w-10 sm:text-2xl rounded-md",
  lg: "h-14 w-10 text-2xl sm:h-[68px] sm:w-12 sm:text-[28px] rounded-lg",
};

interface TileViewProps {
  tile: Tile;
  size?: TileSize;
  selected?: boolean;
  highlight?: "placed" | "drawn" | "hint" | null;
  locked?: boolean;
  draggable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
}

export function TileView({
  tile,
  size = "md",
  selected,
  highlight,
  locked,
  draggable,
  onClick,
  onDragStart,
  className,
}: TileViewProps) {
  const label = tile.joker ? "Joker" : `${tile.color} ${tile.number}`;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "tile-face relative flex shrink-0 select-none flex-col items-center justify-center font-bold leading-none tabular-nums transition-[transform,box-shadow] duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-default",
        onClick && !locked && "cursor-pointer hover:-translate-y-0.5",
        draggable && "cursor-grab active:cursor-grabbing",
        SIZE_CLASS[size],
        selected && "-translate-y-1.5 ring-[3px] ring-amber-400 hover:-translate-y-1.5",
        highlight === "placed" && !selected && "ring-2 ring-emerald-400/90",
        highlight === "drawn" && !selected && "ring-2 ring-sky-400/90 animate-tile-pop",
        highlight === "hint" && !selected && "ring-[3px] ring-fuchsia-400 animate-pulse",
        locked && "opacity-80",
        className,
      )}
    >
      {tile.joker ? (
        <Smile
          className={cn(
            "text-[#dc2f3a]",
            size === "sm" ? "size-4" : size === "md" ? "size-6 sm:size-7" : "size-7 sm:size-8",
          )}
          strokeWidth={2.6}
        />
      ) : (
        <>
          <span className={cn(COLOR_CLASS[tile.color!], "-mt-1 tracking-tight")}>{tile.number}</span>
          <span
            className={cn(
              "absolute rounded-full opacity-80",
              DOT_CLASS[tile.color!],
              size === "sm" ? "bottom-1 size-1" : "bottom-1.5 size-1.5 sm:bottom-2",
            )}
          />
        </>
      )}
    </button>
  );
}
