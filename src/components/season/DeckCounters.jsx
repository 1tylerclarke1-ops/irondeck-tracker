import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function DeckCounters({ cards }) {
  const total = cards.reduce((sum, c) => sum + (c.copies || 0), 0);
  const mythics = cards
    .filter((c) => c.rarity === "mythic")
    .reduce((sum, c) => sum + (c.copies || 0), 0);
  const rares = cards
    .filter((c) => c.rarity === "rare")
    .reduce((sum, c) => sum + (c.copies || 0), 0);

  const counters = [
    { label: "Total cards", value: total },
    { label: "Mythics remaining", value: mythics },
    { label: "Rares remaining", value: rares },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {counters.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}