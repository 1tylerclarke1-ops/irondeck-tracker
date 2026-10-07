import React, { useEffect, useRef, useState } from "react";
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

const CX = 150;
const CY = 150;
const R = 148;

const shortName = (name) => {
  const base = name.split(",")[0].trim();
  return base.length > 14 ? base.slice(0, 14) + "…" : base;
};

const pointAt = (angleDeg, radius = R) => {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
};

const wedgePath = (a0, a1) => {
  const [x0, y0] = pointAt(a0);
  const [x1, y1] = pointAt(a1);
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
};

const labelTransform = (phi) => {
  const [lx, ly] = pointAt(phi, R * 0.62);
  let r = phi - 90;
  r = ((r % 360) + 360) % 360;
  if (r > 180) r -= 360;
  if (r > 90) r -= 180;
  else if (r < -90) r += 180;
  return { x: lx, y: ly, rotate: r };
};

export default function SpinWheel({ cards, onDecayed }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [art, setArt] = useState({});
  const rotationRef = useRef(0);

  const n = cards.length;
  const angle = n > 0 ? 360 / n : 360;

  useEffect(() => {
    let active = true;
    const names = cards.map((c) => c.name);
    const fetchOne = async (name) => {
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
        );
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    };
    (async () => {
      const out = {};
      const batch = 8;
      for (let i = 0; i < names.length; i += batch) {
        const slice = names.slice(i, i + batch);
        const results = await Promise.all(slice.map(fetchOne));
        results.forEach((data, idx) => {
          if (!data) return;
          const artCrop =
            data.image_uris?.art_crop ||
            data.card_faces?.[0]?.image_uris?.art_crop ||
            null;
          const normal =
            data.image_uris?.normal ||
            data.card_faces?.[0]?.image_uris?.normal ||
            null;
          out[slice[idx]] = { artCrop, normal, artist: data.artist };
        });
        if (!active) return;
        setArt({ ...out });
      }
    })();
    return () => {
      active = false;
    };
  }, [cards]);

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

  const resultArt = result ? art[result.name] : null;
  const resultIndex = result
    ? cards.findIndex((c) => c.name === result.name)
    : -1;

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col items-center space-y-6">
        <div className="relative w-72 h-72">
          <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-[16px] border-l-transparent border-r-transparent border-t-foreground"></div>
          </div>
          <svg viewBox="0 0 300 300" className="w-full h-full">
            <defs>
              {cards.map((c, i) => {
                const a0 = i * angle;
                const a1 = (i + 1) * angle;
                return (
                  <clipPath id={`clip-${i}`} key={i}>
                    <path d={wedgePath(a0, a1)} />
                  </clipPath>
                );
              })}
              <radialGradient id="centreFade" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.85)" />
                <stop offset="40%" stopColor="rgba(0,0,0,0.3)" />
                <stop offset="60%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>
            <g
              transform={`rotate(${rotation} ${CX} ${CY})`}
              style={{
                transition: "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)",
              }}
            >
              {cards.map((c, i) => {
                const a0 = i * angle;
                const a1 = (i + 1) * angle;
                const phi = i * angle + angle / 2;
                const entry = art[c.name];
                const lt = labelTransform(phi);
                return (
                  <g key={i}>
                    {entry?.artCrop ? (
                      <image
                        href={entry.artCrop}
                        x={CX - R}
                        y={CY - R}
                        width={2 * R}
                        height={2 * R}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#clip-${i})`}
                      />
                    ) : (
                      <path
                        d={wedgePath(a0, a1)}
                        fill={COLORS[i % COLORS.length]}
                      />
                    )}
                    <path
                      d={wedgePath(a0, a1)}
                      fill="none"
                      stroke="white"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                    <text
                      x={lt.x}
                      y={lt.y}
                      transform={`rotate(${lt.rotate} ${lt.x} ${lt.y})`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={11}
                      fontWeight={700}
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                    >
                      {shortName(c.name)}
                    </text>
                  </g>
                );
              })}
              {result && !spinning && resultIndex >= 0 && (
                <path
                  d={wedgePath(resultIndex * angle, (resultIndex + 1) * angle)}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={4}
                />
              )}
            </g>
            <circle cx={CX} cy={CY} r={R} fill="url(#centreFade)" />
          </svg>
        </div>
        <Button size="lg" onClick={spin} disabled={spinning}>
          {spinning ? "Spinning..." : "Spin"}
        </Button>
        {result && (
          <div className="flex flex-col items-center gap-2">
            {resultArt?.normal && (
              <img
                src={resultArt.normal}
                alt={result.name}
                className="w-40 h-auto rounded-lg border"
              />
            )}
            <div className="text-lg font-semibold">{result.name}</div>
            {resultArt?.artist && (
              <div className="text-sm text-muted-foreground">
                Art by {resultArt.artist}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}