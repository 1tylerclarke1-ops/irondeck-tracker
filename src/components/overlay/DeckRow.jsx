import React from "react";
import ManaSymbols from "./ManaSymbols";

const RUST = "#cc5a3a";

const COLOR_TINTS = {
  W: "rgba(232,216,176,0.20)",
  U: "rgba(40,110,180,0.28)",
  B: "rgba(50,48,46,0.55)",
  R: "rgba(200,60,50,0.28)",
  G: "rgba(40,140,70,0.28)",
};

const COLOR_ACCENTS = {
  W: "#e8d8b0",
  U: "#3a8ad9",
  B: "#7a7a7a",
  R: "#e0533a",
  G: "#4caf50",
};

function tintFor(colours) {
  if (!colours) return { bg: "rgba(140,140,145,0.15)", accent: "#9ba3a8" };
  const list = colours.split("").filter((c) => COLOR_TINTS[c]);
  if (!list.length) return { bg: "rgba(140,140,145,0.15)", accent: "#9ba3a8" };
  const bg =
    list.length === 1
      ? COLOR_TINTS[list[0]]
      : `linear-gradient(90deg, ${list.map((c) => COLOR_TINTS[c]).join(", ")})`;
  return { bg, accent: COLOR_ACCENTS[list[0]] };
}

export default function DeckRow({ card }) {
  const copies = Number(card.copies) || 0;
  const original = Number(card.original_copies) || 0;
  const isReplacement = Boolean(card.is_decay_replacement);
  const isLand = card.card_type === "land";
  const rusted = original > 0 && copies < original;
  const fullyRusted = original > 0 && copies === 0;
  const rustedCount = rusted ? original - copies : 0;
  const displayCopies = rusted ? original : copies;
  const { bg, accent } = tintFor(card.colours);

  const rowBg = fullyRusted
    ? `linear-gradient(rgba(204,90,58,0.30), rgba(204,90,58,0.30)), ${bg}`
    : bg;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.24rem 0.5rem 0.24rem 0.6rem",
        borderRadius: "6px",
        background: rowBg,
        border: `1px solid ${
          fullyRusted ? "rgba(204,90,58,0.55)" : "rgba(255,255,255,0.10)"
        }`,
        opacity: fullyRusted ? 0.9 : 1,
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: fullyRusted ? RUST : accent,
          borderRadius: "6px 0 0 6px",
        }}
      />

      {/* Copies box */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 26,
          borderRadius: "4px",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.14)",
          fontWeight: 800,
          fontSize: "0.9rem",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {displayCopies}
        {rusted && !fullyRusted && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "4px",
              background: `linear-gradient(135deg, transparent 52%, ${RUST} 52%)`,
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        )}
        {fullyRusted && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "4px",
              background: "rgba(204,90,58,0.5)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Name */}
      <div
        style={{
          flex: 1,
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#fff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textDecoration: fullyRusted ? "line-through" : "none",
          opacity: fullyRusted ? 0.85 : 1,
        }}
      >
        {card.name}
        {isReplacement && (
          <span
            style={{
              marginLeft: "0.4rem",
              fontSize: "0.52rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: RUST,
              border: `1px solid ${RUST}`,
              borderRadius: "3px",
              padding: "0.05rem 0.22rem",
              verticalAlign: "middle",
            }}
          >
            NEW
          </span>
        )}
      </div>

      {/* Mana symbols */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        {!isLand && <ManaSymbols cost={card.mana_cost} />}
      </div>

      {/* Rusted label */}
      {rusted && (
        <span
          style={{
            flexShrink: 0,
            fontSize: "0.6rem",
            fontWeight: 700,
            color: RUST,
            whiteSpace: "nowrap",
          }}
        >
          x{rustedCount} rusted
        </span>
      )}
    </div>
  );
}