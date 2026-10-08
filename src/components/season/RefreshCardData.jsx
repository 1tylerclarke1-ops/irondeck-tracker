import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { manaInfoFor } from "@/components/season/arenaImport";
import { resolveCards } from "@/lib/resolveCard";
import { cardHasOutsideTheGame } from "@/lib/scryfall";

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
      const entries = cards.map((c) => ({
        name: c.name,
        set: c.set || null,
        number: c.collector_number || null,
      }));
      const resolved = await resolveCards(entries);

      const updates = [];
      for (let i = 0; i < cards.length; i++) {
        const data = resolved[i].card;
        if (data) {
          const mi = manaInfoFor(data);
          updates.push({
            id: cards[i].id,
            scryfall_id: data.id,
            set: data.set,
            collector_number: data.collector_number,
            mana_cost: mi.mana_cost,
            colours: mi.colours,
            mana_value: mi.mana_value,
            outside_the_game: cardHasOutsideTheGame(data),
          });
        }
        setProgress(`${i + 1}/${cards.length}`);
      }

      if (updates.length) {
        await base44.entities.Card.bulkUpdate(updates);
      }
      const unresolved = cards.length - updates.length;
      setResult(
        `Updated ${updates.length} of ${cards.length} cards.${
          unresolved ? ` ${unresolved} unresolved — use Fix on the decklist.` : ""
        }`
      );
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
          Fills Scryfall id, set, collector number, mana cost, colours and mana
          value. Looks up by set + collector number, then a scored name search,
          then fuzzy name. Does not change copies, original copies, rarity or
          zone.
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && !refreshing && (
        <p className="text-sm text-green-600 dark:text-green-400">{result}</p>
      )}
    </div>
  );
}