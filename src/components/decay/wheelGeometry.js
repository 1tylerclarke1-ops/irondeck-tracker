export const COLORS = [
  "#1e293b",
  "#334155",
  "#0f766e",
  "#7c2d12",
  "#4c1d95",
  "#9d174d",
  "#854d0e",
  "#155e75",
];

export const CX = 150;
export const CY = 150;
export const R = 148;

export const shortName = (name) => {
  const base = name.split(",")[0].trim();
  return base.length > 14 ? base.slice(0, 14) + "…" : base;
};

export const pointAt = (angleDeg, radius = R) => {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
};

export const wedgePath = (a0, a1) => {
  const [x0, y0] = pointAt(a0);
  const [x1, y1] = pointAt(a1);
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
};

export const labelTransform = (phi) => {
  const [lx, ly] = pointAt(phi, R * 0.62);
  let r = phi - 90;
  r = ((r % 360) + 360) % 360;
  if (r > 180) r -= 360;
  if (r > 90) r -= 180;
  else if (r < -90) r += 180;
  return { x: lx, y: ly, rotate: r };
};