import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { num } from "@/components/run/runHelpers";

const newRarityFor = (r) => (r === "mythic" ? "rare" : "uncommon");

export default function ReplacementPanel({
  decayedCard,
  rarity,
  season,
  deckCards,
  onApply,
  applying,
}) {
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRolled(null);
    setError(null);
    setRolling(false);
  }, [decayedCard?.name]);

  const newRarity = newRarityFor(rarity);

  const buildUrl = () => {
    const q = `f:standard game:arena r:${newRarity} t:${decayedCard.card_type} id<=${season.colours.toLowerCase()}`;
    return `https://api.scryfall.com/cards/random?q=${encodeURIComponent(q)}`;
  };

  const roll = async () => {
    setRolling(true);
    setError(null);
    setRolled(null);
    const url = buildUrl();
    try {
      let attempts = 0;
      let chosen = null;
      while (attempts < 10) {
        const res = await fetch(url);
        if (res.status === 404) {
          setError("Scryfall found no card matching the decay criteria.");
          setRolling(false);
          return;
        }
        if (!res.ok) {
          setError("Couldn't reach Scryfall.");
          setRolling(false);
          return;
        }
        const data = await res.json();
        const existing = deckCards.find((c) => c.name === data.name);
        if (existing && num(existing.copies) >= 4) {
          attempts++;
          continue;
        }
        chosen = data;
        break;
      }
      if (!chosen) {
        setError("Couldn't find a replacement not already at 4 copies.");
        setRolling(false);
        return;
      }
      setRolled(chosen);
    } catch (e) {
      setError("Couldn't reach Scryfall.");
    } finally {
      setRolling(false);
    }
  };

  const imageUrl =
    rolled?.image_uris?.small || rolled?.card_faces?.[0]?.image_uris?.small;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 flex flex-col items-center text-center">
        {rolling ? (
          <div className="flex items-center gap-2 py-6">
            <div className="w-5 h-5 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            <span>Rolling...</span>
          </div>
        ) : rolled ? (
          <>
            <Image
              src={imageUrl}
              alt={rolled.name}
              fittingType="fit"
              className="w-40 h-auto rounded-lg border"
            />
            <div className="space-y-1">
              <div className="text-lg font-bold">{rolled.name}</div>
              <div className="text-sm text-muted-foreground capitalize">
                {rolled.rarity} · {rolled.type_line}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full">
              <Button onClick={() => onApply("owned", rolled)} disabled={applying}>
                Owned
              </Button>
              <Button onClick={() => onApply("wildcard", rolled)} disabled={applying}>
                Wildcard
              </Button>
              <Button variant="outline" onClick={roll} disabled={applying}>
                Reroll
              </Button>
            </div>
          </>
        ) : error ? (
          <>
            <div className="text-destructive font-medium">{error}</div>
            <Button variant="outline" onClick={roll}>
              Try again
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={roll}>
            Roll replacement
          </Button>
        )}
      </CardContent>
    </Card>
  );
}