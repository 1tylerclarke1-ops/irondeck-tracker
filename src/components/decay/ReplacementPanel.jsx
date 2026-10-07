import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";
import { rarityFor, typeFor, manaInfoFor } from "@/components/season/arenaImport";

const OTHER_RARITY = { uncommon: "common", common: "uncommon" };

const COLOUR_LAND = {
  w: "Plains",
  u: "Island",
  b: "Swamp",
  r: "Mountain",
  g: "Forest",
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
  const [rollRarity, setRollRarity] = useState(null);
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
    setRollRarity(null);
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

  const isLand = decayedCard.card_type === "land";

  const buildQuery = (rarityVal) => {
    const typeFilter = isLand ? "t:land" : "-t:land";
    return `f:standard game:arena r:${rarityVal} ${typeFilter} id<=${(
      season.colours || ""
    ).toLowerCase()}`;
  };

  const randomUrl = (q) =>
    `https://api.scryfall.com/cards/random?q=${encodeURIComponent(q)}`;

  const normalize = (data) => ({
    name: data.name,
    rarity: rarityFor(data),
    card_type: typeFor(data),
    imageUrl:
      data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal || null,
    ...manaInfoFor(data),
  });

  const pickBasicLand = () => {
    const colours = (season.colours || "")
      .toLowerCase()
      .split("")
      .filter((c) => COLOUR_LAND[c]);
    const pool = colours.length > 0 ? colours : ["w", "u", "b", "r", "g"];
    const choice = pool[Math.floor(Math.random() * pool.length)];
    return COLOUR_LAND[choice];
  };

  const tryRarity = async (q) => {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(randomUrl(q));
      if (res.status === 404) return { none: true, reason: "404" };
      if (!res.ok) throw new Error("Couldn't reach Scryfall.");
      const data = await res.json();
      const existing = deckCards.find((c) => c.name === data.name);
      if (existing && num(existing.copies) >= 4) continue;
      return { card: normalize(data) };
    }
    return { none: true, reason: "copies" };
  };

  const roll = async () => {
    setRolling(true);
    setError(null);
    setRolled(null);
    const first = Math.random() < 0.5 ? "uncommon" : "common";
    setRollRarity(first);
    const order = [first, OTHER_RARITY[first]];
    try {
      for (const rar of order) {
        const result = await tryRarity(buildQuery(rar));
        if (result.card) {
          setRolled(result.card);
          return;
        }
      }
      if (isLand) {
        const name = pickBasicLand();
        setRolled({
          name,
          rarity: "basic",
          card_type: "land",
          imageUrl: null,
          mana_cost: "",
          colours: "",
          mana_value: 0,
        });
        return;
      }
      setError("Scryfall found no card matching the decay criteria.");
    } catch (e) {
      setError("Couldn't reach Scryfall.");
    } finally {
      setRolling(false);
    }
  };

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
            {rollRarity && (
              <div className="text-xs text-muted-foreground mb-1">
                Rarity roll: {cap(rollRarity)}
              </div>
            )}
            {rolling ? (
              <div className="w-36 h-52 rounded-lg border bg-muted flex items-center justify-center">
                <div className="w-5 h-5 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : rolled ? (
              <CardFace
                name={rolled.name}
                rarity={rolled.rarity}
                imageUrl={rolled.imageUrl}
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
            <Button onClick={() => onApply("owned", rolled, rollRarity)} disabled={applying}>
              Owned
            </Button>
            <Button onClick={() => onApply("wildcard", rolled, rollRarity)} disabled={applying}>
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