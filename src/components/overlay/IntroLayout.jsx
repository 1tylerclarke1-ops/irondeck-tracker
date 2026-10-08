import React, { useEffect, useState } from "react";
import { goldText, steelText, irondeckText, purpleText } from "@/lib/overlayText";
import { INTRO_BG, BADGE } from "@/lib/overlayAssets";

// Fixed 1920x1080 stage, scaled to fit the window so OBS and browsers look identical.
const STAGE_W = 1920;
const STAGE_H = 1080;

// Main grid on the left, sideboard column on the right, rotted row along the bottom.
const MAIN_X = 50;
const MAIN_W = 1500;
const MAIN_TOP = 330; // grid starts here (section title sits above it)
const MAIN_BOTTOM_FULL = 1010; // when nothing has rotted
const MAIN_BOTTOM_WITH_ROT = 800; // leaves room for the rotted row
const SIDE_X = 1600;
const SIDE_CARD_W = 220;
const SIDE_PEEK = 0.135; // how much of each stacked card shows
const GAP_X = 22;
const GAP_Y = 40;
const CARD_RATIO = 1.395; // card height / width
const MAX_TILE_W = 170;
const MINI_W = 120;

// Metal frames drawn in CSS so they always sit exactly on the card.
const FRAMES = {
  steel: {
    ring: "0 0 0 2px #0b0b0d, 0 0 0 5px #b9bfca, 0 0 0 6px #6b717c, 0 0 0 8px #0b0b0d",
    glow: "0 10px 18px rgba(0,0,0,0.75)",
  },
  scavenged: {
    ring: "0 0 0 2px #120a04, 0 0 0 5px #ffd38a, 0 0 0 6px #a8621e, 0 0 0 8px #120a04",
    glow: "0 0 22px 4px rgba(255,140,40,0.55), 0 10px 18px rgba(0,0,0,0.75)",
  },
  rot: {
    ring: "0 0 0 2px #0c0616, 0 0 0 5px #d4baff, 0 0 0 6px #5a2fa8, 0 0 0 8px #0c0616",
    glow: "0 0 22px 4px rgba(150,70,255,0.55), 0 10px 18px rgba(0,0,0,0.75)",
  },
};

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(
        Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
      );
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

// Pick the column count that gives the largest tiles while fitting every card.
function gridSize(count, areaW, areaH) {
  let best = { cols: 1, tileW: 0 };
  for (let cols = 1; cols <= Math.max(count, 1); cols++) {
    const rows = Math.ceil(count / cols);
    const byWidth = (areaW - (cols - 1) * GAP_X) / cols;
    const byHeight = (areaH - (rows - 1) * GAP_Y) / rows / CARD_RATIO;
    const tileW = Math.min(byWidth, byHeight, MAX_TILE_W);
    if (tileW > best.tileW) best = { cols, tileW };
  }
  return best;
}

function IntroTile({ card, imageUrl, tileW, variant = "steel", count }) {
  const tileH = tileW * CARD_RATIO;
  const frame = FRAMES[variant];
  const badgeSize = Math.round(tileW * 0.46);
  const radius = tileW * 0.055;
  const badgeSrc = BADGE[variant] || BADGE.steel;
  const numStyle =
    variant === "scavenged"
      ? goldText(badgeSize * 0.5)
      : variant === "rot"
      ? purpleText(badgeSize * 0.5)
      : steelText(badgeSize * 0.5);

  return (
    <div style={{ position: "relative", width: tileW, height: tileH }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          overflow: "hidden",
          background: "#16181d",
          boxShadow: `${frame.ring}, ${frame.glow}`,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: variant === "rot" ? "grayscale(1) brightness(0.7)" : "none",
            }}
          />
        ) : (
          <div
            style={{
              ...steelText(Math.max(10, tileW * 0.085)),
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 6,
              lineHeight: 1.2,
            }}
          >
            {card.name}
          </div>
        )}
        {variant === "rot" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(90,40,170,0.45)",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: (tileW - badgeSize) / 2,
          top: tileH - badgeSize * 0.55,
          width: badgeSize,
          height: badgeSize,
        }}
      >
        <img
          src={badgeSrc}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ ...numStyle, WebkitTextStroke: "2px #0A0806" }}>{count}</span>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ text, rot, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, ...style }}>
      <span style={rot ? purpleText(26) : steelText(26)}>{text}</span>
      <div
        style={{
          flex: 1,
          height: 2,
          background: rot
            ? "linear-gradient(90deg, rgba(190,160,250,0.8), rgba(190,160,250,0))"
            : "linear-gradient(90deg, rgba(120,96,63,0.9), rgba(120,96,63,0))",
        }}
      />
    </div>
  );
}

// MTGGoldfish-style column: one card per copy, stacked so each name strip shows.
function SideboardStack({ cards, images, total, top, bottom }) {
  const copies = [];
  cards.forEach((c) => {
    for (let i = 0; i < (Number(c.copies) || 0); i++) {
      copies.push({ card: c, key: `${c.id}-${i}` });
    }
  });
  const cardH = SIDE_CARD_W * CARD_RATIO;
  const step = cardH * SIDE_PEEK;
  const stackH = cardH + step * Math.max(copies.length - 1, 0);
  const y0 = top + Math.max(0, (bottom - top - stackH) / 2);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: SIDE_X,
          top: y0 + stackH / 2,
          transform: "translate(-50%, -50%) rotate(-90deg)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={steelText(26)}>SIDEBOARD · {total}</span>
      </div>
      {copies.map(({ card, key }, i) => (
        <div
          key={key}
          style={{
            position: "absolute",
            left: SIDE_X + 34,
            top: y0 + i * step,
            width: SIDE_CARD_W,
            height: cardH,
            borderRadius: SIDE_CARD_W * 0.05,
            overflow: "hidden",
            background: "#16181d",
            boxShadow: `${(card.is_decay_replacement ? FRAMES.scavenged : FRAMES.steel).ring}, 0 -4px 10px rgba(0,0,0,0.6)`,
          }}
        >
          {card.scryfall_id && images[card.scryfall_id]?.normal ? (
            <img
              src={images[card.scryfall_id].normal}
              alt={card.name}
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ ...steelText(16), padding: "10px 12px", lineHeight: 1.2 }}>
              {card.name}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function Plaque({ label, value, rot }) {
  return (
    <div
      style={{
        width: 250,
        height: 80,
        borderRadius: 14,
        background: "rgba(10,10,14,0.85)",
        border: `2px solid ${rot ? "#BEA0FA" : "#78603F"}`,
        boxShadow: rot ? "0 0 18px rgba(150,70,255,0.45)" : "0 4px 10px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <span style={steelText(20)}>{label}</span>
      <span style={rot ? purpleText(34) : goldText(34)}>{value}</span>
    </div>
  );
}

export default function IntroLayout({
  seasonNumber,
  day,
  runWins,
  best,
  record,
  rottedCount,
  sideboardCount,
  mainCount,
  cards,
  sideCards = [],
  rottedCards = [],
  images,
}) {
  const scale = useStageScale();
  const hasSide = sideCards.length > 0;
  const hasRot = rottedCards.length > 0;
  const mainW = hasSide ? MAIN_W : 1820;
  const mainBottom = hasRot ? MAIN_BOTTOM_WITH_ROT : MAIN_BOTTOM_FULL;
  const areaH = mainBottom - MAIN_TOP - 30; // room for the badges under the last row
  const { cols, tileW } = gridSize(cards.length, mainW, areaH);
  const gridW = cols * tileW + (cols - 1) * GAP_X;
  const mainLeft = MAIN_X + (mainW - gridW) / 2;
  const rows = Math.ceil(cards.length / cols);
  const gridH = rows * tileW * CARD_RATIO + (rows - 1) * GAP_Y;
  const gridTop = MAIN_TOP + Math.max(0, (areaH - gridH) / 2);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0d1016",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          backgroundImage: `url('${INTRO_BG}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "absolute",
            top: 30,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <span style={irondeckText(64)}>IRONDECK</span>
          <span style={goldText(46)}>
            SEASON {seasonNumber ?? "—"} · DAY {day ?? "—"}
          </span>
        </div>

        {/* Stat plaques */}
        <div
          style={{
            position: "absolute",
            top: 172,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 26,
          }}
        >
          <Plaque label="RUN" value={runWins ?? "—"} />
          <Plaque label="BEST" value={best ?? "—"} />
          <Plaque label="RECORD" value={record != null ? `${record} ${record === 1 ? "DAY" : "DAYS"}` : "—"} />
          <Plaque label="ROTTED" value={rottedCount} rot />
        </div>

        {/* MAIN */}
        <SectionTitle
          text={`MAIN · ${mainCount}`}
          style={{ position: "absolute", left: mainLeft, top: gridTop - 50, width: gridW }}
        />
        <div
          style={{
            position: "absolute",
            left: mainLeft,
            top: gridTop,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
            columnGap: GAP_X,
            rowGap: GAP_Y,
          }}
        >
          {cards.map((c) => (
            <IntroTile
              key={c.id}
              card={c}
              tileW={tileW}
              variant={c.is_decay_replacement ? "scavenged" : "steel"}
              count={Number(c.copies) || 0}
              imageUrl={c.scryfall_id ? images[c.scryfall_id]?.normal : null}
            />
          ))}
        </div>

        {/* SIDEBOARD column */}
        {hasSide && (
          <SideboardStack
            cards={sideCards}
            images={images}
            total={sideboardCount}
            top={gridTop - 50}
            bottom={gridTop + gridH + 30}
          />
        )}

        {/* ROTTED row */}
        {hasRot && (
          <>
            <SectionTitle
              text={`ROTTED · ${rottedCount}`}
              rot
              style={{ position: "absolute", left: MAIN_X, right: 50, top: mainBottom + 12 }}
            />
            <div
              style={{
                position: "absolute",
                left: MAIN_X,
                top: mainBottom + 62,
                display: "flex",
                gap: 22,
              }}
            >
              {rottedCards.map(({ card, rotted }) => (
                <IntroTile
                  key={card.id}
                  card={card}
                  tileW={MINI_W}
                  variant="rot"
                  count={rotted}
                  imageUrl={card.scryfall_id ? images[card.scryfall_id]?.normal : null}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}