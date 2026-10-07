import React from "react";

const RUST = "#a35a3d";
const RUST_TEXTURE =
  "https://media.base44.com/images/public/6ac605d777721f9149c6b225/3c387b3a0_image.png";
const SALVAGED_GREEN = "#2d8a4e";

export default function DeckRow({ card, imageUrl, loading }) {
  const copies = Number(card.copies) || 0;
  const original = Number(card.original_copies) || 0;
  const isReplacement = Boolean(card.is_decay_replacement);
  const rustedCount = original > 0 ? original - copies : 0;
  const isRusted = rustedCount > 0;
  const fullyRusted = isRusted && copies === 0;
  const rustedRatio = original > 0 ? rustedCount / original : 0;
  const leftCutPct = (1 - rustedRatio) * 100;
  const boxCount = isRusted ? original : copies;

  const barImgStyle = {
    display: "block",
    width: "100%",
    height: "auto",
    marginTop: "-4%",
  };

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: "6px" }}>
      {/* Copies box */}
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: "5px",
          border: `1px solid ${fullyRusted ? RUST : "rgba(255,255,255,0.7)"}`,
          background: fullyRusted ? RUST : "rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: "0.95rem" }}>×{boxCount}</span>
        {isRusted && !fullyRusted && (
          <span
            style={{
              fontSize: "0.5rem",
              fontWeight: 700,
              color: RUST,
              marginTop: "2px",
            }}
          >
            {rustedCount} rust
          </span>
        )}
      </div>

      {/* Card bar */}
      <div
        style={{
          position: "relative",
          flex: 1,
          aspectRatio: "1 / 0.105",
          borderRadius: "5px",
          overflow: "hidden",
          background: "#1a1d24",
          border: "1px solid rgba(255,255,255,0.12)",
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
              ...barImgStyle,
              filter: fullyRusted ? "grayscale(1) brightness(0.7)" : "none",
            }}
          />
        ) : null}

        {/* Partial rust: greyscale the rusted portion + texture overlay */}
        {isRusted && !fullyRusted && imageUrl && (
          <>
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                ...barImgStyle,
                position: "absolute",
                top: 0,
                left: 0,
                filter: "grayscale(1) brightness(0.7)",
                maskImage: `linear-gradient(to right, transparent ${leftCutPct}%, #000 ${
                  leftCutPct + 8
                }%)`,
                WebkitMaskImage: `linear-gradient(to right, transparent ${leftCutPct}%, #000 ${
                  leftCutPct + 8
                }%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: `${rustedRatio * 100}%`,
                backgroundImage: `url(${RUST_TEXTURE})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                maskImage: "linear-gradient(to right, transparent, #000 8%)",
                WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%)",
              }}
            />
          </>
        )}

        {/* Fully rusted: texture over the whole bar */}
        {fullyRusted && imageUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${RUST_TEXTURE})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.85,
            }}
          />
        )}

        {/* SALVAGED tag */}
        {isReplacement && (
          <div
            style={{
              position: "absolute",
              top: "-1px",
              right: "6px",
              padding: "1px 5px",
              borderRadius: "8px",
              background: SALVAGED_GREEN,
              color: "#fff",
              fontSize: "0.48rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            SALVAGED
          </div>
        )}
      </div>
    </div>
  );
}