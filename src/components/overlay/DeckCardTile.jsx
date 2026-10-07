import React from "react";

const RUST = "#cc5a3a";

export default function DeckCardTile({ card, imageUrl, loading }) {
  const copies = Number(card.copies) || 0;
  const original = Number(card.original_copies) || 0;
  const rusted = original > 0 && copies < original;
  const fullyRusted = original > 0 && copies === 0;
  const rustedCount = rusted ? original - copies : 0;
  const badgeCount = rusted ? original : copies;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.55)",
        aspectRatio: "5 / 7",
        background: "#1a1d24",
      }}
    >
      {loading ? (
        <div
          className="animate-pulse"
          style={{ position: "absolute", inset: 0, background: "#2a2e36" }}
        />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={card.name}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: rusted ? "grayscale(0.85) brightness(0.65)" : "none",
            opacity: fullyRusted ? 0.5 : 1,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.5rem",
            textAlign: "center",
            fontSize: "0.72rem",
            color: "#9aa0aa",
          }}
        >
          {card.name}
        </div>
      )}

      {/* Rust tint overlay */}
      {rusted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(204,90,58,${fullyRusted ? 0.45 : 0.28})`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Copies badge */}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          minWidth: 26,
          height: 26,
          padding: "0 7px",
          borderRadius: "13px",
          background: rusted ? RUST : "rgba(0,0,0,0.72)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "#fff",
          fontSize: "0.82rem",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {badgeCount}
      </div>

      {/* Rust count */}
      {rusted && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            padding: "0.12rem 0.5rem",
            borderRadius: "5px",
            background: "rgba(0,0,0,0.72)",
            border: `1px solid ${RUST}`,
            color: RUST,
            fontSize: "0.64rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          ×{rustedCount} rusted
        </div>
      )}
    </div>
  );
}