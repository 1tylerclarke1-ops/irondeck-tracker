import React from "react";
import { goldText, purpleText } from "@/lib/overlayText";

const CARD_W = 240;
const CARD_H = 336;

export default function DeathCardFrame({
  image,
  name,
  label,
  tone = "gold",
  drained = false,
  style,
}) {
  const border = tone === "rot" ? "#7c5aa8" : "#d68c3c";
  const glow = tone === "rot" ? "rgba(124,90,168,0.55)" : "rgba(214,140,60,0.55)";
  const labelStyle = tone === "rot" ? purpleText(20) : goldText(20);

  return (
    <div style={{ position: "relative", width: CARD_W, height: CARD_H, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          border: `3px solid ${border}`,
          boxShadow: `0 0 20px 5px ${glow}`,
          overflow: "hidden",
          background: "#0b0b12",
          filter: drained
            ? "grayscale(0.85) brightness(0.55) sepia(0.35)"
            : "none",
          transition: "filter 1.5s ease",
        }}
      >
        {image ? (
          <img
            src={image}
            alt={name || ""}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#fff",
              padding: "0 1rem",
              textAlign: "center",
              fontSize: "1rem",
              fontWeight: 700,
            }}
          >
            {name}
          </div>
        )}
        {drained && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(80,60,120,0.4)",
              transition: "opacity 1.5s ease",
            }}
          />
        )}
      </div>
      {label && (
        <div
          style={{
            position: "absolute",
            top: -16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 16px",
            borderRadius: 8,
            background: "#0b0b12",
            border: `2px solid ${border}`,
            whiteSpace: "nowrap",
            ...labelStyle,
            letterSpacing: "2px",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}