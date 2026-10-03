"use client";

import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GameState } from "@/lib/rummi/game";
import { cn } from "@/lib/utils";
import { Avatar } from "./players";

interface RoundOverDialogProps {
  game: GameState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNextRound: () => void;
  onNewGame: () => void;
}

export function RoundOverDialog({ game, open, onOpenChange, onNextRound, onNewGame }: RoundOverDialogProps) {
  const winner = game.players.find((p) => p.id === game.winnerId);
  const youWon = winner?.isHuman;
  const rows = [...game.players].sort((a, b) => b.score - a.score);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div
            className={cn(
              "mb-2 flex size-14 items-center justify-center rounded-2xl",
              youWon ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/70",
            )}
          >
            <Trophy className="size-7" />
          </div>
          <DialogTitle className="text-xl">{youWon ? "You won the round!" : `${winner?.name} wins round ${game.round}`}</DialogTitle>
          <DialogDescription>{game.log[0]?.text}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-3 py-2 text-right font-medium">Left</th>
                <th className="px-3 py-2 text-right font-medium">Round</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const r = game.roundResults?.find((x) => x.playerId === p.id);
                return (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar player={p} size="sm" />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.rack.length}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-medium tabular-nums",
                        (r?.delta ?? 0) > 0 ? "text-emerald-400" : (r?.delta ?? 0) < 0 ? "text-red-400" : "",
                      )}
                    >
                      {(r?.delta ?? 0) > 0 ? "+" : ""}
                      {r?.delta ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{p.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onNewGame}>New game</Button>
          <Button className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300" onClick={onNextRound}>
            Play round {game.round + 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
