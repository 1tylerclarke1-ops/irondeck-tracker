import React, { useEffect, useState } from "react";
import { goldText, steelText, irondeckText, purpleText } from "@/lib/overlayText";
import { INTRO_BG, TILE_FRAME, BADGE } from "@/lib/overlayAssets";

const STAGE_W = 1920;
const STAGE_H = 1080;
const GRID_TOP = 290;
const GRID_W = 1820;
const GRID_H = 690;
const GAP_X = 22;
const GAP_Y = 40;
const CARD_RATIO = 1.395;
const MAX_TILE_W = 170;
const FRAME_BASE_W = 300;
const FRAME_MARGIN = 22;

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

function gridSize(count) {
  let best = { cols: 1, tileW: 0 };
  for (let cols = 1; cols <= Math.max(count, 1); cols++) {
    const rows = Math.ceil(count / cols);
    const byWidth = (GRID_W - (cols - 1) * GAP_X) / cols;
    const byHeight = (GRID_H - (rows - 1) * GAP_Y) / rows / CARD_RATIO;
    const tileW = Math.min(byWidth, byHeight, MAX_TILE_W);
    if (tileW > best.tileW) best = { cols, tileW };
  }
  return best;
}

function IntroTile({ card, imageUrl, tileW }) {
  const tileH = tileW * CARD_RATIO;
  const scavenged = Boolean(card.is_decay_replacement);
  const frameOffset = (FRAME_MARGIN * tileW) / FRAME_BASE_W;
  const badgeSize = Math.round(tileW * 0.46);
  const copies = Number(card.copies) || 0;

  return (
    <div style={{ position: "relative", width: tileW, height: tileH }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: tileW * 0.055, boxShadow: "0 8px 14px rgba(0,0,0,0.7)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: tileW * 0.055, overflow: "hidden", background: "#16181d" }}>
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ ...steelText(Math.max(11, tileW * 0.085)), height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center", textAlign: "center", padding: 8, lineHeight: 1.2 }}>
            {card.name}
          </div>
        )}
      </div>
      <img src={scavenged ? TILE_FRAME.scavenged : TILE_FRAME.steel} alt="" draggable={false}
        style={{ position: "absolute", left: -frameOffset, top: -frameOffset,
          width: tileW + frameOffset * 2, height: tileH + frameOffset * 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: (tileW - badgeSize) / 2, top: tileH - badgeSize * 0.55,
        width: badgeSize, height: badgeSize }}>
        <img src={scavenged ? BADGE.scavenged : BADGE.steel} alt="" draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ ...(scavenged ? goldText(badgeSize * 0.5) : steelText(badgeSize * 0.5)), WebkitTextStroke: "2px #0A0806" }}>
            {copies}
          </span>
        </div>
      </div>
    </div>
  );
}

function Plaque({ label, value, rot }) {
  return (
    <div style={{ width: 250, height: 80, borderRadius: 14, background: "rgba(10,10,14,0.85)",
      border: `2px solid ${rot ? "#BEA0FA" : "#78603F"}`,
      boxShadow: rot ? "0 0 18px rgba(150,70,255,0.45)" : "0 4px 10px rgba(0,0,0,0.6)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <span style={steelText(20)}>{label}</span>
      <span style={rot ? purpleText(34) : goldText(34)}>{value}</span>
    </div>
  );
}

export default function IntroLayout({ seasonNumber, day, runWins, best, record, rottedCount,
  sideboardCount, mainCount, cards, images }) {
  const scale = useStageScale();
  const { cols, tileW } = gridSize(cards.length);
  const rows = Math.ceil(cards.length / cols);
  const gridH = rows * tileW * CARD_RATIO + (rows - 1) * GAP_Y;
  const footer = [
    sideboardCount > 0 ? `SIDEBOARD ${sideboardCount}` : null,
    `${mainCount} CARDS`,
    rottedCount > 0 ? `THE ROT HAS CLAIMED ${rottedCount}` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0d1016", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: STAGE_W, height: STAGE_H,
        transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center center",
        backgroundImage: `url('${INTRO_BG}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div style={{ position: "absolute", top: 30, left: 0, right: 0, display: "flex",
          flexDirection: "column", alignItems: "center", gap: 18 }}>
          <span style={irondeckText(64)}>IRONDECK</span>
          <span style={goldText(46)}>SEASON {seasonNumber ?? "—"} · DAY {day ?? "—"}</span>
        </div>
        <div style={{ position: "absolute", top: 172, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26 }}>
          <Plaque label="RUN" value={runWins ?? "—"} />
          <Plaque label="BEST" value={best ?? "—"} />
          <Plaque label="RECORD" value={record != null ? `${record} DAYS` : "—"} />
          <Plaque label="ROTTED" value={rottedCount} rot />
        </div>
        <div style={{ position: "absolute", top: GRID_TOP + (GRID_H - gridH) / 2, left: 0, right: 0,
          display: "flex", justifyContent: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, columnGap: GAP_X, rowGap: GAP_Y }}>
            {cards.map((c) => (
              <IntroTile key={c.id} card={c} tileW={tileW}
                imageUrl={c.scryfall_id ? images[c.scryfall_id]?.normal : null} />
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center" }}>
          <span style={steelText(22)}>{footer}</span>
        </div>
      </div>
    </div>
  );
}