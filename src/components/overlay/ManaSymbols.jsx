import React from "react";

const MANA_COLORS = {
  W: { bg: "#e8d8b0", fg: "#1a1a1a" },
  U: { bg: "#0e68ab", fg: "#ffffff" },
  B: { bg: "#2a2520", fg: "#ffffff" },
  R: { bg: "#d3202a", fg: "#ffffff" },
  G: { bg: "#00733e", fg: "#ffffff" },
};

function parseManaCost(mc) {
  if (!mc) return [];
  const matches = mc.match(/\{[^}]+\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

export default function ManaSymbols({ cost }) {
  const tokens = parseManaCost(cost);
  if (!tokens.length) return null;
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
      {tokens.map((t, i) => {
        const upper = t.toUpperCase();
        const isColor = MANA_COLORS[upper];
        const bg = isColor ? isColor.bg : "#7f878d";
        const fg = isColor ? isColor.fg : "#ffffff";
        const isLong = upper.length > 1;
        return (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: isLong ? undefined : 16,
              height: 16,
              padding: isLong ? "0 4px" : "0",
              borderRadius: isLong ? "8px" : "50%",
              background: bg,
              color: fg,
              fontSize: isLong ? "0.48rem" : "0.62rem",
              fontWeight: 700,
              lineHeight: 1,
              boxShadow: "0 1px 2px rgba(0,0,0,0.45)",
              boxSizing: "border-box",
            }}
          >
            {upper}
          </span>
        );
      })}
    </div>
  );
}