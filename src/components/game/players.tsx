"use client";

import { Check } from "lucide-react";
import type { Player } from "@/lib/rummi/game";
import { cn } from "@/lib/utils";

export function Avatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-inner ring-1 ring-white/20",
        size === "sm" ? "size-6 text-[11px]" : "size-9 text-sm",
      )}
      style={{
        background: `linear-gradient(135deg, oklch(0.72 0.15 ${player.hue}), oklch(0.5 0.16 ${player.hue + 30}))`,
      }}
    >
      {player.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="thinking-dot size-1 rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

export function OpponentCard({ player, active }: { player: Player; active: boolean }) {
  const backs = Math.min(player.rack.length, 14);
  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-3 rounded-2xl bg-zinc-950/50 px-3 py-2 ring-1 ring-white/10 backdrop-blur transition-all",
        active && "bg-zinc-900/80 ring-2 ring-emerald-400/80 shadow-[0_0_24px_-6px] shadow-emerald-400/50",
      )}
    >
      <Avatar player={player} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-white">{player.name}</span>
          {player.hasMelded && (
            <span title="Has made initial meld" className="flex size-4 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
          {active ? (
            <span className="flex items-center gap-1.5 text-emerald-300">
              Thinking <ThinkingDots />
            </span>
          ) : (
            <>
              <span className="hidden gap-px sm:flex" aria-hidden>
                {Array.from({ length: backs }).map((_, i) => (
                  <span key={i} className="h-3 w-[5px] rounded-[1px] bg-gradient-to-b from-amber-100 to-amber-200/70" />
                ))}
              </span>
              <span className="tabular-nums">{player.rack.length} tiles</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
