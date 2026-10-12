import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs, roundDay } from "@/lib/roundDay";
import { INTRO_BG } from "@/lib/overlayAssets";
import { goldText, irondeckText } from "@/lib/overlayText";

// IRON & ROT stream frame (designed at 1920 x 1080). Used by the IronDeck
// layout page. The game window (GAME, 1440 x 810 = 75%) is left TRANSPARENT so
// the Arena game source underneath shows through. A continuous band runs
// across the full width at the top (the HUD sits in it); the logo is the left
// end of that band and caps the deck sidebar below it.

export const GAME = { x: 480, y: 270, w: 1440, h: 810 };
export const BAND_H = GAME.y; // top band height
export const SIDE_W = GAME.x; // deck sidebar width
// Everything except the game window (even-odd polygon = rectangle with a hole)
const OUTSIDE_GAME = `polygon(evenodd, 0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 0, ${GAME.x}px ${GAME.y}px, ${GAME.x + GAME.w}px ${GAME.y}px, ${GAME.x + GAME.w}px ${GAME.y + GAME.h}px, ${GAME.x}px ${GAME.y + GAME.h}px, ${GAME.x}px ${GAME.y}px)`;
const LOGO_IMG =
  "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
// ember at the top, steel in the middle, rot purple at the bottom
const FRAME_GRAD =
  "linear-gradient(160deg,#FFD38A 0%,#E8892F 18%,#c7ced8 40%,#6d7684 60%,#8a5cf0 82%,#3a1d78 100%)";

// Fixed "random" positions so the embers and spores don't jump on refresh.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const r1 = seeded(11);
const EMBERS = Array.from({ length: 46 }, () => ({
  x: r1() * 1920,
  y: 120 + r1() * 420,
  s: 2 + r1() * 4,
  d: 6 + r1() * 8,
  delay: -r1() * 14,
  o: 0.4 + r1() * 0.6,
}));
const r2 = seeded(29);
const SPORES = Array.from({ length: 34 }, () => ({
  x: r2() * 470,
  y: 620 + r2() * 460,
  s: 3 + r2() * 5,
  d: 9 + r2() * 9,
  delay: -r2() * 18,
  o: 0.35 + r2() * 0.55,
}));

export default function OverlayFrame() {
  const [season, setSeason] = useState(null);
  const [day, setDay] = useState(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = "";
      body.style.background = "";
    };
  }, []);

  // Season and day for the logo corner
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const seasons = await base44.entities.Season.filter({ status: "active" });
        const s = seasons && seasons[0];
        if (!active) return;
        setSeason(s || null);
        if (!s) return;
        const [runs, climbs, logs] = await Promise.all([
          base44.entities.Run.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
          loadDayLogs(s.id),
        ]);
        if (!active) return;
        const climb = [...climbs].sort((a, b) => (b.number || 0) - (a.number || 0))[0];
        setDay(
          roundDay({
            logs,
            climb,
            playing: runs.some((r) => r.round_status === "playing"),
          })
        );
      } catch {
        // keep last values
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const rivets = useMemo(
    () => [
      [GAME.x, GAME.y],
      [GAME.x + GAME.w, GAME.y],
      [GAME.x, GAME.y + GAME.h],
      [GAME.x + GAME.w, GAME.y + GAME.h],
    ],
    []
  );

  return (
    <div style={{ position: "fixed", inset: 0, width: 1920, height: 1080, overflow: "hidden" }}>
      <style>{`
        @keyframes fr-ember { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: var(--o); } 100% { transform: translateY(-160px); opacity: 0; } }
        @keyframes fr-spore { 0% { transform: translate(0,0); opacity: 0; } 20% { opacity: var(--o); } 100% { transform: translate(18px,-90px); opacity: 0; } }
        @keyframes fr-pulse { 0%,100% { opacity: .85; } 50% { opacity: 1; } }
      `}</style>

      {/* Background, glows, embers and spores: everywhere except the game window */}
      <div style={{ position: "absolute", inset: 0, clipPath: OUTSIDE_GAME }}>
        {/* Background art, darkened */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `url('${INTRO_BG}') center/cover no-repeat, #0d1016`,
            filter: "brightness(0.3) saturate(1.2)",
          }}
        />
        {/* Brushed steel texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.022) 0 2px, transparent 2px 9px)",
          }}
        />
        {/* Forge glow (top-left), rot glow (bottom-left), faint ember top-right */}
        <Glow x={-250} y={-250} w={1000} h={750} c="rgba(255,110,20,0.5)" />
        <Glow x={-200} y={650} w={900} h={700} c="rgba(120,50,255,0.55)" />
        <Glow x={1300} y={-200} w={900} h={450} c="rgba(255,150,60,0.28)" />

        {/* Embers rising from the forge */}
        {EMBERS.map((e, i) => (
          <div
            key={`e${i}`}
            style={{
              position: "absolute",
              left: e.x,
              top: e.y,
              width: e.s,
              height: e.s,
              borderRadius: "50%",
              background: "#ffb060",
              boxShadow: "0 0 8px 2px rgba(255,140,40,0.9)",
              "--o": e.o,
              animation: `fr-ember ${e.d}s linear ${e.delay}s infinite`,
            }}
          />
        ))}
        {/* Spores drifting up from the rot */}
        {SPORES.map((p, i) => (
          <div
            key={`s${i}`}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.s,
              height: p.s,
              borderRadius: "50%",
              background: "#c9a8ff",
              boxShadow: "0 0 10px 3px rgba(150,90,255,0.85)",
              "--o": p.o,
              animation: `fr-spore ${p.d}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}

        {/* Top band: one continuous HUD strip across the full width */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1920,
            height: BAND_H,
            background: "linear-gradient(180deg, rgba(6,7,11,0.62) 0%, rgba(6,7,11,0.35) 100%)",
          }}
        />
      </div>

      {/* Game window frame: iron at the top, rotting at the bottom */}
      <div
        style={{
          position: "absolute",
          left: GAME.x - 7,
          top: GAME.y - 7,
          width: GAME.w + 14,
          height: GAME.h + 14,
          boxSizing: "border-box",
          border: "7px solid transparent",
          borderImage: `${FRAME_GRAD} 1`,
          boxShadow: "0 0 30px 6px rgba(255,110,20,0.35), 0 0 40px 8px rgba(120,50,255,0.25)",
          clipPath: OUTSIDE_GAME,
        }}
      />
      {rivets.map(([x, y], i) => (
        <div
          key={`r${i}`}
          style={{
            position: "absolute",
            left: x - 9,
            top: y - 9,
            width: 18,
            height: 18,
            transform: "rotate(45deg)",
            border: "2px solid #1a120c",
            background: FRAME_GRAD,
            boxShadow: "0 0 10px rgba(255,140,40,0.7)",
          }}
        />
      ))}

      {/* Rot vines creeping up from the bottom-left */}
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      >
        <defs>
          <linearGradient id="fr-vine" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#a77bff" />
            <stop offset="1" stopColor="#5a2fa8" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <g
          stroke="url(#fr-vine)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          style={{ animation: "fr-pulse 4s ease-in-out infinite" }}
        >
          <path d="M480 1080 C500 1030 455 990 492 940 S470 860 505 800 S478 740 498 690" />
          <path d="M480 1080 C540 1060 580 1085 640 1062 S720 1076 790 1060" />
          <path d="M470 1080 C440 1040 470 1000 440 960 S462 900 436 860" />
          <path d="M0 1080 C30 1050 10 1010 46 980 S30 930 60 900" />
        </g>
        <g fill="#c9a8ff">
          <circle cx="505" cy="800" r="5" />
          <circle cx="790" cy="1060" r="5" />
          <circle cx="498" cy="690" r="4" />
          <circle cx="436" cy="860" r="4" />
        </g>

        {/* Ember tendrils at the top-right corner (mirror of the rot vines) */}
        <g
          stroke="#ff9a3c"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 6px rgba(255,140,40,0.9))",
            animation: "fr-pulse 3s ease-in-out infinite",
          }}
        >
          <path d="M1912 270 C1892 232 1916 202 1898 162 S1916 104 1896 62" strokeOpacity="0.9" />
          <path d="M1920 268 C1862 250 1822 274 1762 258 S1684 272 1612 256" strokeOpacity="0.85" />
          <path d="M1904 272 C1880 246 1868 220 1846 236" strokeOpacity="0.6" strokeWidth="3.5" />
        </g>
        <g fill="#ffd38a" style={{ filter: "drop-shadow(0 0 8px rgba(255,140,40,1))" }}>
          <circle cx="1896" cy="62" r="5" />
          <circle cx="1612" cy="256" r="5" />
          <circle cx="1846" cy="236" r="4" />
        </g>
      </svg>

      {/* Logo corner */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SIDE_W,
          height: BAND_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <img
          src={LOGO_IMG}
          alt=""
          draggable={false}
          style={{
            height: 190,
            width: "auto",
            maxWidth: "none",
            filter: "drop-shadow(0 0 18px rgba(255,110,20,0.55)) drop-shadow(0 6px 10px #000)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={irondeckText(44)}>IRONDECK</div>
          <div
            style={{
              fontFamily: '"Barlow Condensed", sans-serif',
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: 3,
              lineHeight: 1.25,
              textTransform: "uppercase",
              color: "#FFD38A",
              textShadow: "0 0 2px #000, 0 2px 4px #000",
            }}
          >
            Can a rotting deck
            <br />
            reach Mythic?
          </div>
          <div style={goldText(22)}>
            SEASON {season?.season_number ?? "—"} · DAY {day ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Glow({ x, y, w, h, c }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: "50%",
        background: c,
        filter: "blur(120px)",
      }}
    />
  );
}