import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function DeckCounters({ cards }) {
  const zoneOf = (c) => c.zone || "main";
  const main = cards
    .filter((c) => zoneOf(c) === "main")
    .reduce((sum, c) => sum + (c.copies || 0), 0);
  const sideboard = cards
    .filter((c) => zoneOf(c) === "sideboard")
    .reduce((sum, c) => sum + (c.copies || 0), 0);
  const mythics = cards
    .filter((c) => c.rarity === "mythic")
    .reduce((sum, c) => sum + (c.copies || 0), 0);
  const rares = cards
    .filter((c) => c.rarity === "rare")
    .reduce((sum, c) => sum + (c.copies || 0), 0);

  const counters = [
    { label: "Main deck", value: main },
    { label: "Sideboard", value: sideboard },
    { label: "Mythics remaining", value: mythics },
    { label: "Rares remaining", value: rares },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {counters.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold">{c.value}</div>
              <div className="text-sm text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {sideboard > 5 && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          Sideboard has {sideboard} cards, more than the 5-card limit.
        </div>
      )}
    </div>
  );
}