"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tile } from "@/lib/rummi/tiles";
import { TileView } from "./tile-view";

const t = (color: Tile["color"], number: number | null, i = 0): Tile => ({
  id: `ex-${color}-${number}-${i}`,
  color,
  number,
  joker: number === null,
});

const RUN = [t("blue", 4), t("blue", 5), t("blue", 6), t("blue", 7)];
const GROUP = [t("black", 9), t("orange", 9), t("red", 9)];
const JOKER = [t("red", 11), t(null, null), t("red", 13)];

export function RulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">How to play</DialogTitle>
          <DialogDescription>Be the first to play every tile from your rack.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h3 className="font-medium text-foreground">Sets</h3>
            <p>
              A <span className="text-foreground">run</span> is 3 or more consecutive numbers in one color. A{" "}
              <span className="text-foreground">group</span> is 3 or 4 tiles of the same number in different colors.
            </p>
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-emerald-950/40 p-3">
              <div className="flex gap-1">{RUN.map((x) => <TileView key={x.id} tile={x} size="sm" />)}</div>
              <div className="flex gap-1">{GROUP.map((x) => <TileView key={x.id} tile={x} size="sm" />)}</div>
              <div className="flex gap-1">{JOKER.map((x) => <TileView key={x.id} tile={x} size="sm" />)}</div>
            </div>
            <p>Jokers stand in for any tile. A joker left on your rack costs 30 points.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-medium text-foreground">Your turn</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your first play must be one or more sets from your own rack worth at least 30 points.</li>
              <li>After that, you can add to sets on the table and rearrange them freely — split runs, swap jokers, borrow tiles.</li>
              <li>At the end of your turn every set on the table must be valid and you must have played at least one tile.</li>
              <li>If you can&apos;t or don&apos;t want to play, draw a tile instead.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="font-medium text-foreground">Controls</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Tap tiles to select them, then tap <span className="text-foreground">+</span> on a set or the <span className="text-foreground">New set</span> slot.</li>
              <li>On desktop you can also drag tiles onto sets, the New set slot, or back to your rack.</li>
              <li>Undo restores the table and your rack to the start of your turn.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="font-medium text-foreground">Scoring</h3>
            <p>
              When someone empties their rack, everyone else loses the value of their remaining tiles and the winner gains the
              total. If the pool runs dry and nobody can play, the lowest rack wins.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
