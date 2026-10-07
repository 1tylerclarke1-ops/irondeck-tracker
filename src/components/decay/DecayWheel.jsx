import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";

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

const DecayWheel = forwardRef(function DecayWheel(
  { cards, art, onLand, onSpinningChange },
  ref
) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const rotationRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const n = cards.length;
  const angle = n > 0 ? 360 / n : 360;

  useImperativeHandle(ref, () => ({
    spinTo: (card) => {
      if (spinning || n === 0) return;
      const target = cards.findIndex((c) => c.name === card.name);
      if (target < 0) return;
      setSpinning(true);
      onSpinningChange?.(true);
      setResult(null);
      const center = target * angle + angle / 2;
      const desiredMod = (360 - center) % 360;
      const base = rotationRef.current;
      const currentMod = base % 360;
      let delta = desiredMod - currentMod;
      if (delta < 0) delta += 360;
      const next = base + 360 * 5 + delta;
      rotationRef.current = next;
      setRotation(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSpinning(false);
        onSpinningChange?.(false);
        setResult(cards[target]);
        onLand?.(cards[target]);
      }, 4000);
    },
  }));

  const resultIndex = result
    ? cards.findIndex((c) => c.name === result.name)
    : -1;

  return (
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
            const entry = art[c.scryfall_id];
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
                  <path d={wedgePath(a0, a1)} fill={COLORS[i % COLORS.length]} />
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
  );
});

export default DecayWheel;