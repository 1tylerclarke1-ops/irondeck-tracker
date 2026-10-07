import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const RUST = "#cc5a3a";
const RUST_GLOW = "rgba(204,90,58,0.9)";
const RED = "#c0392b";
const RED_GLOW = "rgba(192,57,43,0.9)";
const MYTHIC = "#e0533a";
const RARE = "#d4af37";
const PANEL_BG =
  "linear-gradient(180deg, rgba(43,47,55,0.82) 0%, rgba(20,23,29,0.82) 100%)";
const PANEL_BORDER = "rgba(204,90,58,0.4)";

export default function Overlay() {
  const [data, setData] = useState(null);

  const [popSlot, setPopSlot] = useState(null);
  const [shakePip, setShakePip] = useState(null);
  const [cleared, setCleared] = useState(false);
  const [died, setDied] = useState(false);
  const [flashAll, setFlashAll] = useState(false);

  const prevWins = useRef(null);
  const prevLosses = useRef(null);
  const popTimer = useRef(null);
  const shakeTimer = useRef(null);
  const clearedTimer = useRef(null);
  const diedTimer = useRef(null);

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

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const seasons = await base44.entities.Season.filter({ status: "active" });
        if (!active) return;
        const season = seasons && seasons[0];
        if (!season) {
          setData({ season: null });
          return;
        }
        const [runs, cards] = await Promise.all([
          base44.entities.Run.filter({ season_id: season.id }),
          base44.entities.Card.filter({ season_id: season.id }),
        ]);
        if (!active) return;
        const sortedRuns = [...runs].sort(
          (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
        );
        const currentRun =
          runs.find((r) => r.result === "in_progress") || sortedRuns[0] || null;
        const bestRun = runs.reduce(
          (m, r) => Math.max(m, r.total_wins || 0),
          0
        );
        const mythics = cards
          .filter((c) => c.rarity === "mythic")
          .reduce((s, c) => s + (c.copies || 0), 0);
        const rares = cards
          .filter((c) => c.rarity === "rare")
          .reduce((s, c) => s + (c.copies || 0), 0);
        setData({ season, currentRun, bestRun, mythics, rares });
      } catch (e) {
        // keep last data on error
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Animate only on value changes, not on every refresh.
  useEffect(() => {
    const wins = data?.currentRun ? Number(data.currentRun.stage_wins || 0) : 0;
    const losses = data?.currentRun
      ? Number(data.currentRun.stage_losses || 0)
      : 0;

    if (prevWins.current === null) {
      prevWins.current = wins;
      prevLosses.current = losses;
      return;
    }

    if (wins > prevWins.current) {
      setPopSlot(wins - 1);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopSlot(null), 500);
      if (wins >= 7) {
        setCleared(true);
        setFlashAll(true);
        if (clearedTimer.current) clearTimeout(clearedTimer.current);
        clearedTimer.current = setTimeout(() => {
          setCleared(false);
          setFlashAll(false);
        }, 3000);
      }
    }
    if (losses > prevLosses.current) {
      setShakePip(losses);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShakePip(null), 500);
      if (losses >= 2) {
        setDied(true);
        if (diedTimer.current) clearTimeout(diedTimer.current);
        diedTimer.current = setTimeout(() => setDied(false), 3000);
      }
    }

    prevWins.current = wins;
    prevLosses.current = losses;
  }, [data]);

  useEffect(
    () => () => {
      if (popTimer.current) clearTimeout(popTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (clearedTimer.current) clearTimeout(clearedTimer.current);
      if (diedTimer.current) clearTimeout(diedTimer.current);
    },
    []
  );

  const s = data;
  const wins = s?.currentRun ? Number(s.currentRun.stage_wins || 0) : 0;
  const losses = s?.currentRun ? Number(s.currentRun.stage_losses || 0) : 0;

  return (
    <div
      className="w-screen h-screen flex items-start justify-center pt-10"
      style={{ background: "transparent" }}
    >
      <style>{`
        @keyframes ov-pop { 0% { transform: scale(0.5); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
        @keyframes ov-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(4px); } }
        @keyframes ov-flash { 0%,100% { filter: brightness(1); box-shadow: 0 0 0 rgba(204,90,58,0); } 50% { filter: brightness(1.7); box-shadow: 0 0 22px rgba(204,90,58,0.95); } }
        @keyframes ov-pulse { 0%,100% { box-shadow: 0 0 6px rgba(204,90,58,0.5); } 50% { box-shadow: 0 0 18px rgba(204,90,58,0.95); } }
        @keyframes ov-msg { 0% { opacity: 0; transform: translateY(6px) scale(0.92); } 15% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-4px) scale(0.96); } }
      `}</style>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          padding: "0.7rem 1.6rem",
          borderRadius: "12px",
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          backdropFilter: "blur(6px)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "-9px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0 8px",
            fontSize: "0.55rem",
            letterSpacing: "0.22em",
            fontWeight: 700,
            color: RUST,
            background: "linear-gradient(180deg, rgba(43,47,55,0.95) 0%, rgba(26,29,35,0.95) 100%)",
            borderRadius: "4px",
          }}
        >
          IRONDECK
        </span>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.1rem",
            alignItems: "center",
            minWidth: "92px",
          }}
        >
          <SideStat
            label="Attempt"
            value={s?.currentRun ? `#${s.currentRun.attempt_number}` : "—"}
          />
          <SideStat label="Stage" value={s?.currentRun?.stage ?? "—"} />
        </div>

        <Divider />

        <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-end" }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const won = i < wins;
            const isCurrent = i === wins;
            const isPop = popSlot === i;
            const isFlash = flashAll;
            const lit = won || isCurrent;
            const grow = 0.7 + (i / 7) * 0.5; // 0.7 -> 1.2
            const bright = lit ? 1 : 0.3 + (i / 7) * 0.2;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.18rem",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 34,
                    height: 50,
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: won
                      ? "linear-gradient(180deg, rgba(204,90,58,0.22) 0%, rgba(204,90,58,0.06) 100%)"
                      : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${
                      isCurrent
                        ? RUST
                        : won
                        ? "rgba(204,90,58,0.85)"
                        : "rgba(255,255,255,0.14)"
                    }`,
                    boxShadow: isCurrent
                      ? `0 0 14px ${RUST_GLOW}, inset 0 0 8px rgba(204,90,58,0.3)`
                      : won
                      ? "inset 0 0 6px rgba(204,90,58,0.25)"
                      : "none",
                    animation: isFlash
                      ? "ov-flash 0.6s ease-in-out infinite"
                      : isPop
                      ? "ov-pop 0.5s ease-out"
                      : isCurrent
                      ? "ov-pulse 1.6s ease-in-out infinite"
                      : "none",
                  }}
                >
                  <IronIcon size={grow} bright={bright} lit={lit} />
                  {isCurrent && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 2,
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        color: "#fff",
                        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                      }}
                    >
                      {wins}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.5rem",
                    letterSpacing: "0.04em",
                    fontWeight: 700,
                    color: lit
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {i} {i === 1 ? "Win" : "Wins"}
                </span>
              </div>
            );
          })}
        </div>

        <Divider />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.1rem",
            minWidth: "92px",
          }}
        >
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {[0, 1].map((i) => {
              const lost = i < losses;
              const isShake = shakePip === i;
              return (
                <div
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    transform: "rotate(45deg)",
                    background: lost ? RED : "transparent",
                    border: `1.5px solid ${
                      lost ? "rgba(192,57,43,0.9)" : "rgba(255,255,255,0.22)"
                    }`,
                    boxShadow: lost ? `0 0 8px ${RED_GLOW}` : "none",
                    animation: isShake ? "ov-shake 0.5s ease-in-out" : "none",
                  }}
                />
              );
            })}
          </div>
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.16em",
              fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            RUN WINS
          </span>
          <span
            style={{
              fontSize: "2.6rem",
              fontWeight: 800,
              lineHeight: 1,
              color: "#fff",
            }}
          >
            {s?.currentRun?.total_wins ?? "—"}
          </span>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Best {s?.bestRun ?? "—"}
          </span>
          <div
            style={{
              display: "flex",
              gap: "0.7rem",
              alignItems: "center",
              marginTop: "0.2rem",
            }}
          >
            <Gem color={MYTHIC} count={s?.mythics ?? 0} label="M" />
            <Gem color={RARE} count={s?.rares ?? 0} label="R" />
          </div>
        </div>

        {(cleared || (died && !cleared)) && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginTop: "0.5rem",
              fontSize: "1.3rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: cleared ? RUST : RED,
              textShadow: `0 0 16px ${cleared ? RUST_GLOW : RED_GLOW}`,
              animation: "ov-msg 3s ease-in-out forwards",
              whiteSpace: "nowrap",
            }}
          >
            {cleared ? "STAGE CLEARED" : "RUN DEATH"}
          </div>
        )}
      </div>
    </div>
  );
}

function SideStat({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.14em",
          fontWeight: 700,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff" }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        alignSelf: "stretch",
        background: "rgba(255,255,255,0.12)",
      }}
    />
  );
}

function IronIcon({ size, bright, lit }) {
  const w = 26 * size;
  const h = 18 * size;
  const id = `iron-${Math.round(size * 100)}-${lit ? 1 : 0}`;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 26 18"
      style={{ opacity: bright, display: "block" }}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit ? "#d7dde6" : "#8a93a3"} />
          <stop offset="0.5" stopColor={lit ? "#737d8c" : "#4a525e"} />
          <stop offset="1" stopColor={lit ? "#2b303a" : "#1c2029"} />
        </linearGradient>
      </defs>
      <path
        d="M4 15 L6 4 H20 L22 15 Z"
        fill={`url(#${id}-g)`}
        stroke={lit ? "rgba(204,90,58,0.7)" : "rgba(255,255,255,0.18)"}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path d="M6 4 H20 L18.5 7.5 H7.5 Z" fill={lit ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)"} />
    </svg>
  );
}

function Gem({ color, count, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "999px",
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span style={{ fontSize: "0.7rem", fontWeight: 800, color: color }}>
        {label}
      </span>
      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>
        {count}
      </span>
    </div>
  );
}