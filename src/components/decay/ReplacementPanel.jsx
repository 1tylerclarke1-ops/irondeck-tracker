import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";

const newRarityFor = (r) => (r === "mythic" ? "rare" : "uncommon");

function CardFace({ name, rarity, imageUrl, loading }) {
  return (
    <div className="w-36 flex flex-col items-center text-center gap-1">
      {loading ? (
        <div className="w-36 h-52 rounded-lg border bg-muted animate-pulse" />
      ) : imageUrl ? (
        <img src={imageUrl} alt={name} className="w-36 h-auto rounded-lg border" />
      ) : (
        <div className="w-36 h-52 rounded-lg border bg-muted flex items-center justify-center p-2 text-sm font-medium text-center">
          {name}
        </div>
      )}
      <div className="text-sm font-semibold leading-tight">{name}</div>
      <div className="text-xs text-muted-foreground capitalize">{rarity}</div>
    </div>
  );
}

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
  const [oldCard, setOldCard] = useState({
    name: decayedCard.name,
    rarity,
    imageUrl: null,
    loading: true,
  });

  useEffect(() => {
    setRolled(null);
    setError(null);
    setRolling(false);
  }, [decayedCard?.name]);

  useEffect(() => {
    let active = true;
    setOldCard({ name: decayedCard.name, rarity, imageUrl: null, loading: true });
    fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(decayedCard.name)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (!data) {
          setOldCard((o) => ({ ...o, loading: false, imageUrl: null }));
          return;
        }
        const url =
          data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal;
        setOldCard({ name: decayedCard.name, rarity, imageUrl: url, loading: false });
      })
      .catch(() => {
        if (active) setOldCard((o) => ({ ...o, loading: false, imageUrl: null }));
      });
    return () => {
      active = false;
    };
  }, [decayedCard?.name, rarity]);

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

  const newImageUrl =
    rolled?.image_uris?.normal || rolled?.card_faces?.[0]?.image_uris?.normal;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 flex flex-col items-center">
        <div className="flex items-start justify-center gap-3">
          <CardFace
            name={oldCard.name}
            rarity={oldCard.rarity}
            imageUrl={oldCard.imageUrl}
            loading={oldCard.loading}
          />
          <div className="self-center text-2xl font-bold text-muted-foreground">→</div>
          <div className="w-36 flex flex-col items-center">
            {rolling ? (
              <div className="w-36 h-52 rounded-lg border bg-muted flex items-center justify-center">
                <div className="w-5 h-5 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : rolled ? (
              <CardFace
                name={rolled.name}
                rarity={rolled.rarity}
                imageUrl={newImageUrl}
                loading={false}
              />
            ) : error ? (
              <div className="w-36 space-y-2 text-center">
                <div className="text-destructive text-sm font-medium">{error}</div>
                <Button variant="outline" size="sm" onClick={roll}>
                  Try again
                </Button>
              </div>
            ) : (
              <div className="w-36 h-52 flex items-center justify-center">
                <Button size="sm" onClick={roll}>
                  Roll replacement
                </Button>
              </div>
            )}
          </div>
        </div>
        {rolled && (
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
        )}
      </CardContent>
    </Card>
  );
}