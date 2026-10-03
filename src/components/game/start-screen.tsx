"use client";

import { BookOpen, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Difficulty, GameConfig } from "@/lib/rummi/game";
import type { Tile } from "@/lib/rummi/tiles";
import { cn } from "@/lib/utils";
import { TileView } from "./tile-view";

const HERO: Tile[] = [
  { id: "h1", color: "red", number: 7, joker: false },
  { id: "h2", color: "blue", number: 7, joker: false },
  { id: "h3", color: null, number: null, joker: true },
  { id: "h4", color: "orange", number: 7, joker: false },
  { id: "h5", color: "black", number: 7, joker: false },
];

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Relaxed", hint: "Bots play simple sets and rarely use jokers." },
  { value: "normal", label: "Classic", hint: "Bots extend sets and borrow tiles from the table." },
  { value: "hard", label: "Sharp", hint: "Bots search deeper and split runs to dump tiles." },
];

interface StartScreenProps {
  initial: GameConfig;
  canResume: boolean;
  onStart: (config: GameConfig) => void;
  onResume: () => void;
  onRules: () => void;
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-lg text-sm font-medium text-white/60 transition-colors hover:text-white",
            value === o.value && "bg-white text-zinc-900 shadow hover:text-zinc-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StartScreen({ initial, canResume, onStart, onResume, onRules }: StartScreenProps) {
  const [name, setName] = useState(initial.playerName);
  const [opponents, setOpponents] = useState(initial.opponents);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);

  return (
    <main className="felt relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-4 py-10">
      <div className="felt-dots pointer-events-none absolute inset-0" />
      <div className="relative grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section className="text-center lg:text-left">
          <div className="mb-8 flex justify-center gap-1.5 lg:justify-start">
            {HERO.map((tile, i) => (
              <div key={tile.id} style={{ transform: `rotate(${(i - 2) * 4}deg) translateY(${Math.abs(i - 2) * 4}px)` }}>
                <div className="animate-tile-pop" style={{ animationDelay: `${i * 70}ms` }}>
                  <TileView tile={tile} size="lg" />
                </div>
              </div>
            ))}
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">Rummi</h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-lg text-white/70 lg:mx-0">
            The classic tile rummy game, rebuilt for the browser. Build runs and groups, rework the table, and race to empty your rack.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-white/50 lg:justify-start">
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">106 tiles</span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">2–4 players</span>
            <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">Autosaves locally</span>
          </div>
        </section>

        <form
          className="rounded-2xl bg-zinc-950/60 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            onStart({ playerName: name.trim() || "You", opponents, difficulty });
          }}
        >
          <h2 className="text-lg font-semibold text-white">New game</h2>
          <p className="mt-1 text-sm text-white/50">Play against computer opponents.</p>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/80">Your name</Label>
              <Input
                id="name"
                value={name}
                maxLength={16}
                onChange={(e) => setName(e.target.value)}
                placeholder="You"
                className="h-10 bg-black/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Opponents</Label>
              <Segmented
                label="Opponents"
                value={opponents}
                onChange={setOpponents}
                options={[1, 2, 3].map((n) => ({ value: n, label: `${n} bot${n > 1 ? "s" : ""}` }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Difficulty</Label>
              <Segmented
                label="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))}
              />
              <p className="text-xs text-white/50">{DIFFICULTIES.find((d) => d.value === difficulty)?.hint}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-2">
            <Button type="submit" size="lg" className="h-11 bg-emerald-400 text-base text-emerald-950 hover:bg-emerald-300">
              <Play className="fill-current" /> Start game
            </Button>
            {canResume && (
              <Button type="button" size="lg" variant="outline" className="h-11" onClick={onResume}>
                <RotateCw /> Resume saved game
              </Button>
            )}
            <Button type="button" variant="ghost" className="h-10 text-white/70" onClick={onRules}>
              <BookOpen /> How to play
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
