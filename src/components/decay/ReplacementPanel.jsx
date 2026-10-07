import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import useCardImagesById from "@/hooks/useCardImagesById";

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
  rollRarity,
  replacementCard,
  rolling,
  onRollReplacement,
  onApply,
  applying,
}) {
  const [oldCard, setOldCard] = useState({
    name: decayedCard.name,
    rarity,
    imageUrl: null,
    loading: true,
  });

  const sid = decayedCard.scryfall_id;
  const byId = useCardImagesById(sid ? [sid] : []);

  useEffect(() => {
    const entry = sid ? byId[sid] : null;
    setOldCard({
      name: decayedCard.name,
      rarity,
      imageUrl: entry?.normal ?? null,
      loading: sid ? entry === undefined : false,
    });
  }, [sid, decayedCard.name, rarity, byId]);

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
          <div className="self-center text-2xl font-bold text-muted-foreground">
            →
          </div>
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
            ) : replacementCard ? (
              <CardFace
                name={replacementCard.name}
                rarity={replacementCard.rarity}
                imageUrl={replacementCard.imageUrl}
                loading={false}
              />
            ) : (
              <div className="w-36 h-52 flex items-center justify-center">
                <Button
                  size="sm"
                  onClick={onRollReplacement}
                  disabled={!rollRarity}
                >
                  Roll replacement
                </Button>
              </div>
            )}
          </div>
        </div>
        {replacementCard && (
          <div className="grid grid-cols-3 gap-3 w-full">
            <Button onClick={() => onApply("owned")} disabled={applying}>
              Owned
            </Button>
            <Button onClick={() => onApply("wildcard")} disabled={applying}>
              Wildcard
            </Button>
            <Button
              variant="outline"
              onClick={onRollReplacement}
              disabled={applying || rolling}
            >
              Reroll
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}