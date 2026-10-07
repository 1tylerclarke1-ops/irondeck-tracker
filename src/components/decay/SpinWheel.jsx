import React, { useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DecayWheel from "./DecayWheel";
import useCardImagesById from "@/hooks/useCardImagesById";

export default function SpinWheel({ cards, onDecayed, onSpin, spinRef }) {
  const art = useCardImagesById(
    cards.map((c) => c.scryfall_id).filter(Boolean)
  );
  const wheelRef = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  useImperativeHandle(spinRef, () => ({
    spinTo: (card) => wheelRef.current?.spinTo(card),
  }));

  const handleLand = (card) => {
    setResult(card);
    onDecayed?.(card);
  };

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col items-center space-y-6">
        <DecayWheel
          ref={wheelRef}
          cards={cards}
          art={art}
          onLand={handleLand}
          onSpinningChange={setSpinning}
        />
        <Button size="lg" onClick={() => onSpin?.()} disabled={spinning}>
          {spinning ? "Spinning..." : "Spin"}
        </Button>
        {result && (
          <div className="flex flex-col items-center gap-2">
            {art[result.scryfall_id]?.normal && (
              <img
                src={art[result.scryfall_id].normal}
                alt={result.name}
                className="w-40 h-auto rounded-lg border"
              />
            )}
            <div className="text-lg font-semibold">{result.name}</div>
            {art[result.scryfall_id]?.artist && (
              <div className="text-sm text-muted-foreground">
                Art by {art[result.scryfall_id].artist}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}