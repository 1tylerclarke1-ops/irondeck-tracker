import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { manaInfoFor } from "@/components/season/arenaImport";

export default function RefreshCardData({ seasonId, cards, onRefreshed }) {
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setResult(null);
    try {
      const uniqueNames = [...new Set(cards.map((c) => c.name))];
      const infoByName = {};
      let done = 0;
      for (const name of uniqueNames) {
        try {
          const res = await fetch(
            `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
          );
          if (res.ok) {
            const data = await res.json();
            infoByName[name.toLowerCase()] = manaInfoFor(data);
          }
        } catch {
          // skip individual lookup failures
        }
        done += 1;
        setProgress(`${done}/${uniqueNames.length}`);
        await new Promise((r) => setTimeout(r, 100));
      }

      const updates = cards
        .map((c) => {
          const info = infoByName[c.name.toLowerCase()];
          if (!info) return null;
          return {
            id: c.id,
            mana_cost: info.mana_cost,
            colours: info.colours,
            mana_value: info.mana_value,
          };
        })
        .filter(Boolean);

      if (updates.length) {
        await base44.entities.Card.bulkUpdate(updates);
      }
      setResult(`Updated ${updates.length} of ${cards.length} cards.`);
      onRefreshed();
    } catch (e) {
      setError(e.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button onClick={handleRefresh} disabled={refreshing || cards.length === 0}>
          {refreshing
            ? `Refreshing... ${progress || ""}`
            : "Refresh card data"}
        </Button>
        <span className="text-sm text-muted-foreground">
          Fills mana cost, colours and mana value from Scryfall by name. Does not
          change copies, rarity or zone.
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && !refreshing && (
        <p className="text-sm text-green-600 dark:text-green-400">{result}</p>
      )}
    </div>
  );
}