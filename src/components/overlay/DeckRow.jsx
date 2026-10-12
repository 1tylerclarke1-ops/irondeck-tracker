import React, { useState } from "react";
import ManaSymbols from "@/components/overlay/ManaSymbols";
import { goldText, steelText, purpleText } from "@/lib/overlayText";
import { BADGE } from "@/lib/overlayAssets";
import { usePlateImage } from "@/lib/plateImages";

const FRAME_W = 482;
const PLATE_RATIO = 11.85; // width / height of a card's name plate

// The name plate sits at 6.2%–93.8% across and 5.1%–10.4% down a Scryfall card image.
const PLATE_IMG = { width: "114.2%", marginLeft: "-7.1%", marginTop: "-8.1%" };
// Planeswalker frames have their name plate higher up the card.
// (If planeswalker names sit too high or low, nudge marginTop by 0.5% at a time.)
const PLATE_IMG_PW = { width: "114.2%", marginLeft: "-7.1%", marginTop: "-5.4%" };

// Scryfall card image (redirects to the picture). Only the name plate is shown.
const scryCardImage = (id) =>
  id ? `https://api.scryfall.com/cards/${id}?format=image&version=normal` : null;

// Metal frames drawn in CSS so they always sit exactly on the plate.
const FRAMES = {
  steel: "0 0 0 1px #0b0b0d, 0 0 0 3px #b9bfca, 0 0 0 4px #6b717c, 0 0 0 5px #0b0b0d",
  scavenged:
    "0 0 0 1px #120a04, 0 0 0 3px #ffd38a, 0 0 0 4px #a8621e, 0 0 0 5px #120a04, 0 0 12px 2px rgba(255,140,40,0.55)",
  rot: "0 0 0 1px #0c0616, 0 0 0 3px #d4baff, 0 0 0 4px #5a2fa8, 0 0 0 5px #0c0616, 0 0 12px 2px rgba(150,70,255,0.55)",
};

export default function DeckRow({
  card,
  copies,
  variant = "current",
  height = 74,
  corroding = false,
  entering = false,
  salvaged,
  glow = false,
  imageUrl,
}) {
  // 1st choice: a clean standard printing found by name; 2nd: the imported
  // printing; last: a plain text row.
  const plate = usePlateImage(imageUrl === undefined ? card.name : null);
  const [failed, setFailed] = useState(0); // 1 = clean image failed, 2 = both failed
  const fallback = scryCardImage(card.scryfall_id);
  let src = null;
  if (imageUrl !== undefined) src = failed ? null : imageUrl;
  else if (plate && plate.url && failed < 1) src = plate.url;
  else if (plate && failed < 2) src = fallback;
  const isPw = plate?.url && failed < 1 ? plate.pw : card.card_type === "planeswalker";
  const cp = Number(copies ?? card.copies) || 0;
  const original = Number(card.original_copies) || 0;
  const isRotted = variant === "rusted";
  const showScavenged =
    salvaged !== undefined ? salvaged : Boolean(card.is_decay_replacement);
  const boxCount = isRotted ? (original > 0 ? original - cp : 0) : cp;
  const state = isRotted ? "rot" : showScavenged ? "scavenged" : "steel";

  // Plate size: fill the space right of the badge, but never taller than the row.
  const badgeSize = height;
  const maxPlateW = FRAME_W - badgeSize - 10;
  const plateH = Math.min(height - 6, maxPlateW / PLATE_RATIO);
  const plateW = plateH * PLATE_RATIO;

  const countFont = Math.max(11, badgeSize * 0.5);
  const nameFont = Math.max(9, plateH * 0.5);
  const tagFont = Math.max(7, plateH * 0.26);
  const manaScale = Math.max(0.45, Math.min(1.1, plateH / 40));

  const numberStyle = isRotted
    ? purpleText(countFont)
    : showScavenged
    ? goldText(countFont)
    : steelText(countFont);

  let containerAnim = "none";
  if (corroding) containerAnim = "ovd-shake 0.5s ease-in-out infinite";
  else if (entering)
    containerAnim = isRotted ? "ovd-slidein 0.4s ease-out" : "ovd-dropin 0.4s ease-out";

  return (
    <div
      style={{
        position: "relative",
        width: FRAME_W,
        height,
        animation: containerAnim,
        filter: glow ? "drop-shadow(0 0 8px rgba(180,140,240,0.8))" : "none",
      }}
    >
      {/* Diamond copies badge */}
      <img
        src={BADGE[state]}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: badgeSize,
          height: badgeSize,
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: badgeSize,
          height: badgeSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...numberStyle,
          WebkitTextStroke: "1px #0A0806",
        }}
      >
        {boxCount}
      </span>

      {/* Card name plate, framed */}
      <div
        style={{
          position: "absolute",
          left: badgeSize + 6,
          top: (height - plateH) / 2,
          width: plateW,
          height: plateH,
          borderRadius: plateH * 0.22,
          overflow: "hidden",
          background: "#1b1c21",
          boxShadow: FRAMES[state],
        }}
      >
        {src ? (
          <img
            src={src}
            alt={card.name}
            draggable={false}
            onError={() => setFailed((f) => (plate?.url && f < 1 ? 1 : 2))}
            style={{
              display: "block",
              ...(isPw ? PLATE_IMG_PW : PLATE_IMG),
              filter: isRotted ? "grayscale(1) brightness(0.75)" : "none",
            }}
          />
        ) : (
          // No image (loading or blocked): readable name + mana cost on a dark plate
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: `0 ${plateH * 0.3}px`,
              background: "linear-gradient(180deg, #2a2b31, #17181c)",
            }}
          >
            <span
              style={{
                flex: 1,
                fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif',
                fontWeight: 700,
                fontSize: nameFont,
                color: isRotted ? "#cbbbe6" : "#ece6d8",
                textShadow: "0 1px 2px #000",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {card.name}
            </span>
            <div style={{ transform: `scale(${manaScale})`, transformOrigin: "right center" }}>
              <ManaSymbols cost={card.mana_cost} />
            </div>
          </div>
        )}
        {isRotted && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(90,40,170,0.45)",
              mixBlendMode: "multiply",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {showScavenged && !isRotted && (
          <span
            style={{
              position: "absolute",
              left: badgeSize + 6 + plateW - plateH * 2.2,
              top: (height - plateH) / 2,
              transform: "translate(-100%, -55%)",
              padding: "2px 5px",
              borderRadius: 4,
              background: "linear-gradient(180deg,#FFF0CD,#D68C3C)",
              color: "#1A120C",
              fontSize: tagFont,
              fontWeight: 800,
              letterSpacing: "0.05em",
              lineHeight: 1,
              boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            SCAVENGED
          </span>
        )}
    </div>
  );
}