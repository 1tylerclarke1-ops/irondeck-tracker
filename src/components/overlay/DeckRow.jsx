import React from "react";

const RUST = "#a35a3d";
const RUST_TEXTURE =
  "https://media.base44.com/images/public/6ac605d777721f9149c6b225/3c387b3a0_image.png";
const SALVAGED_GREEN = "#2d8a4e";

export default function DeckRow({
  card,
  imageUrl,
  loading,
  height = 44,
  variant = "current",
  glow = false,
  corroding = false,
  entering = false,
  salvaged,
  copies,
}) {
  const cp = Number(copies ?? card.copies) || 0;
  const original = Number(card.original_copies) || 0;
  const showSalvaged =
    salvaged !== undefined ? salvaged : Boolean(card.is_decay_replacement);
  const rustedCount = original > 0 ? original - cp : 0;

  const isRusted = variant === "rusted";
  const boxCount = isRusted ? rustedCount : cp;

  const scale = height / 44;
  const boxSize = height;
  const countFont = Math.max(0.58, 0.95 * scale);
  const salvagedFont = Math.max(0.4, 0.48 * scale);

  const barImgStyle = {
    display: "block",
    width: "100%",
    height: "auto",
    marginTop: "-4%",
  };

  let containerAnim = "none";
  if (corroding) containerAnim = "ovd-shake 0.5s ease-in-out infinite";
  else if (entering)
    containerAnim = isRusted
      ? "ovd-slidein 0.4s ease-out"
      : "ovd-dropin 0.4s ease-out";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: "6px",
        height,
        borderRadius: "5px",
        boxShadow: glow ? "0 0 10px 2px rgba(251,191,36,0.55)" : "none",
        animation: containerAnim,
      }}
    >
      {/* Copies box */}
      <div
        style={{
          width: boxSize,
          height: boxSize,
          flexShrink: 0,
          borderRadius: "5px",
          border: `1px solid ${isRusted ? RUST : "rgba(255,255,255,0.7)"}`,
          background: isRusted ? RUST : "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          lineHeight: 1,
          overflow: "hidden",
        }}
      >
        <span style={{ fontSize: `${countFont}rem` }}>×{boxCount}</span>
      </div>

      {/* Card bar */}
      <div
        style={{
          position: "relative",
          flex: 1,
          height,
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
              filter: isRusted ? "grayscale(1) brightness(0.7)" : "none",
            }}
          />
        ) : null}

        {/* Rusted variant: texture over the whole bar */}
        {isRusted && imageUrl && (
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

        {/* Corroding: rust texture spreads left to right over 2s */}
        {corroding && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${RUST_TEXTURE})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transformOrigin: "left center",
              animation: "ovd-corrode 2s ease-out forwards",
              opacity: 0.9,
            }}
          />
        )}

        {/* SALVAGED tag (current variant only) */}
        {showSalvaged && !isRusted && (
          <div
            style={{
              position: "absolute",
              top: "-1px",
              right: "6px",
              padding: "1px 5px",
              borderRadius: "8px",
              background: SALVAGED_GREEN,
              color: "#fff",
              fontSize: `${salvagedFont}rem`,
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