import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const COLORS = [
  "#1e293b",
  "#334155",
  "#0f766e",
  "#7c2d12",
  "#4c1d95",
  "#9d174d",
  "#854d0e",
  "#155e75",
];

const rarityLabel = (r) => (r === "mythic" ? "Mythic" : "Rare");
const downgradeLabel = (r) => (r === "mythic" ? "Rare" : "Uncommon");

export default function SpinWheel({ cards, rarity, onDecayed }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const rotationRef = useRef(0);

  const n = cards.length;
  const angle = 360 / n;

  const buildGradient = () => {
    if (n <= 1) return COLORS[0];
    const stops = cards.map(
      (_, i) => `${COLORS[i % COLORS.length]} ${i * angle}deg ${(i + 1) * angle}deg`
    );
    return `conic-gradient(${stops.join(",")})`;
  };

  const spin = () => {
    if (spinning || n === 0) return;
    setSpinning(true);
    setResult(null);
    const target = Math.floor(Math.random() * n);
    const center = target * angle + angle / 2;
    const desiredMod = (360 - center) % 360;
    const base = rotationRef.current;
    const currentMod = base % 360;
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;
    const next = base + 360 * 5 + delta;
    rotationRef.current = next;
    setRotation(next);
    setTimeout(() => {
      setSpinning(false);
      setResult(cards[target]);
      onDecayed?.(cards[target]);
    }, 4000);
  };

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col items-center space-y-6">
        <div className="relative w-72 h-72">
          <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-[16px] border-l-transparent border-r-transparent border-t-foreground"></div>
          </div>
          <div
            className="absolute inset-0 rounded-full border-4 border-foreground shadow-lg"
            style={{
              background: buildGradient(),
              transform: `rotate(${rotation}deg)`,
              transition: "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)",
            }}
          >
            {cards.map((c, i) => {
              const center = i * angle + angle / 2;
              return (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${center}deg)` }}
                >
                  <span
                    className="absolute left-1/2 top-2 w-[76px] -translate-x-1/2 text-center text-white text-[10px] font-semibold truncate"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
                    title={c.name}
                  >
                    {c.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <Button size="lg" onClick={spin} disabled={spinning}>
          {spinning ? "Spinning..." : "Spin"}
        </Button>
        {result && (
          <div className="text-center text-lg font-semibold">
            {result.name} loses one copy: {rarityLabel(rarity)} → {downgradeLabel(rarity)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}