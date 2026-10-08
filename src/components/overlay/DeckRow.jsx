import React from "react";
import ManaSymbols from "@/components/overlay/ManaSymbols";
import { goldText, steelText, purpleText } from "@/lib/overlayText";

const DPRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const ASSETS = {
  steel: { badge: `${DPRE}74a8e34a0_badge-steel.png`, row: `${DPRE}3aa8873ea_row-steel.png` },
  salvaged: { badge: `${DPRE}3664fa241_badge-salvaged.png`, row: `${DPRE}7e7c5cbe9_row-salvaged.png` },
  rot: { badge: `${DPRE}01034fb60_badge-rot.png`, row: `${DPRE}20b18b2ec_row-rot.png` },
};

const FRAME_W = 482;

export default function DeckRow({
  card,
  copies,
  variant = "current",
  height = 74,
  corroding = false,
  entering = false,
  salvaged,
  glow = false,
}) {
  const cp = Number(copies ?? card.copies) || 0;
  const original = Number(card.original_copies) || 0;
  const isRotted = variant === "rusted";
  const showSalvaged =
    salvaged !== undefined ? salvaged : Boolean(card.is_decay_replacement);
  const boxCount = isRotted ? (original > 0 ? original - cp : 0) : cp;

  const state = isRotted ? "rot" : showSalvaged ? "salvaged" : "steel";
  const { badge, row } = ASSETS[state];

  const countFont = Math.max(10, height * 0.42);
  const titleFont = Math.max(9, height * 0.34);
  const tagFont = Math.max(7, height * 0.2);
  const manaScale = Math.max(0.45, Math.min(1.1, height / 52));

  const numberStyle = isRotted
    ? purpleText(countFont)
    : showSalvaged
    ? goldText(countFont)
    : steelText(countFont);

  const titleStyle = isRotted ? steelText(titleFont, true) : steelText(titleFont);

  let containerAnim = "none";
  if (corroding) containerAnim = "ovd-shake 0.5s ease-in-out infinite";
  else if (entering)
    containerAnim = isRotted
      ? "ovd-slidein 0.4s ease-out"
      : "ovd-dropin 0.4s ease-out";

  return (
    <div
      style={{
        position: "relative",
        width: FRAME_W,
        height,
        animation: containerAnim,
        boxShadow: glow ? "0 0 10px 2px rgba(180,140,240,0.5)" : "none",
      }}
    >
      {/* Frame image */}
      <img
        src={row}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: FRAME_W,
          height,
          objectFit: "fill",
          filter: isRotted ? "grayscale(0.5) brightness(0.85)" : "none",
          pointerEvents: "none",
        }}
      />
      {/* Purple tint over rotted bar */}
      {isRotted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(150,120,200,0.45)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Badge */}
      <img
        src={badge}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: height,
          height,
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
      {/* Copies number on badge */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: height,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...numberStyle,
        }}
      >
        {boxCount}
      </span>
      {/* Bar content */}
      <div
        style={{
          position: "absolute",
          left: height + 4,
          right: 12,
          top: 0,
          height,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            flex: 1,
            ...titleStyle,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.name}
        </span>
        {showSalvaged && !isRotted && (
          <span
            style={{
              flexShrink: 0,
              padding: "1px 5px",
              borderRadius: 4,
              background: "linear-gradient(180deg,#FFF0CD,#D68C3C)",
              color: "#1A120C",
              fontSize: tagFont,
              fontWeight: 800,
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            SALVAGED
          </span>
        )}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          <div style={{ transform: `scale(${manaScale})`, transformOrigin: "right center" }}>
            <ManaSymbols cost={card.mana_cost} />
          </div>
        </div>
      </div>
    </div>
  );
}