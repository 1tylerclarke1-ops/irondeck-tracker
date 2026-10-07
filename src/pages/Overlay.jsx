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
const SUBPANEL_BG =
  "linear-gradient(180deg, rgba(15,18,24,0.92) 0%, rgba(8,10,14,0.92) 100%)";

const INGOTS = {
  hot: [
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/98ce32099_ingot-hot-0.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/2949c0d23_ingot-hot-1.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/9cc6798df_ingot-hot-2.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/df17cf01c_ingot-hot-3.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/fe24bbb13_ingot-hot-4.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/cbd4a3ec9_ingot-hot-5.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/32c0d296b_ingot-hot-6.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/a47113b5f_ingot-hot-7.png",
  ],
  cold: [
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/dfba089ae_ingot-cold-0.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/09f49bc04_ingot-cold-1.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/8a68977ec_ingot-cold-2.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/6fa391509_ingot-cold-3.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/047310e12_ingot-cold-4.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/6534a00a3_ingot-cold-5.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/fd09f87a6_ingot-cold-6.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/554e37c78_ingot-cold-7.png",
  ],
};

const LOSS_EMPTY =
  "https://media.base44.com/images/public/6ac605d777721f9149c6b225/25582b81c_generated_image.png";
const LOSS_FILLED =
  "https://media.base44.com/images/public/6ac605d777721f9149c6b225/2d86cec4c_generated_image.png";

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
        @keyframes ov-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(4px); } }
        @keyframes ov-flash { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.7) drop-shadow(0 0 10px rgba(204,90,58,0.95)); } }
        @keyframes ov-pulse { 0%,100% { box-shadow: 0 0 6px rgba(204,90,58,0.45); } 50% { box-shadow: 0 0 16px rgba(204,90,58,0.9); } }
        @keyframes ov-msg { 0% { opacity: 0; transform: translateY(6px) scale(0.92); } 15% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-4px) scale(0.96); } }
        @keyframes ov-crosspop { 0% { transform: scale(0.8); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
      `}</style>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          gap: "1.3rem",
          padding: "0.7rem 1.4rem",
          borderRadius: "14px",
          background: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          backdropFilter: "blur(6px)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        {/* LEFT: IRONDECK + Attempt + Stage */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.3rem",
            minWidth: "84px",
          }}
        >
          <span
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.24em",
              fontWeight: 800,
              color: RUST,
            }}
          >
            IRONDECK
          </span>
          <SideStat
            label="Attempt"
            value={s?.currentRun ? `#${s.currentRun.attempt_number}` : "—"}
          />
          <SideStat label="Stage" value={s?.currentRun?.stage ?? "—"} />
        </div>

        <Divider />

        {/* CENTER: 8 ingots on a shared baseline */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-end",
            padding: "0.2rem 0",
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const won = i < wins;
            const isCurrent = i === wins;
            const isPop = popSlot === i;
            const isFlash = flashAll;
            const dim = i > wins;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.3rem",
                  opacity: dim ? 0.45 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 46,
                    height: 72,
                    boxSizing: "border-box",
                    padding: 3,
                    borderRadius: "11px",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    border: `2px solid ${isCurrent ? RUST : "transparent"}`,
                    boxShadow: isCurrent
                      ? `0 0 14px ${RUST_GLOW}, inset 0 0 8px rgba(204,90,58,0.25)`
                      : "none",
                    animation: isCurrent
                      ? "ov-pulse 1.6s ease-in-out infinite"
                      : "none",
                  }}
                >
                  <IngotImage index={i} won={won} pop={isPop} flash={isFlash} />
                  {isCurrent && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: -7,
                        left: -7,
                        width: 22,
                        height: 22,
                        borderRadius: "999px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: RUST,
                        border: "2px solid rgba(255,255,255,0.9)",
                        boxShadow: `0 0 10px ${RUST_GLOW}`,
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      {wins}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.5rem",
                    letterSpacing: "0.03em",
                    fontWeight: 700,
                    color: dim
                      ? "rgba(255,255,255,0.4)"
                      : "rgba(255,255,255,0.8)",
                  }}
                >
                  {i} {i === 1 ? "Win" : "Wins"}
                </span>
              </div>
            );
          })}
        </div>

        <Divider />

        {/* RIGHT: losses (top) + run-wins panel (bottom) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "0.55rem",
            alignSelf: "stretch",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.18rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              {[0, 1].map((i) => {
                const lost = i < losses;
                const isShake = shakePip === i;
                return (
                  <img
                    key={i}
                    src={lost ? LOSS_FILLED : LOSS_EMPTY}
                    alt=""
                    draggable={false}
                    style={{
                      width: 26,
                      height: 26,
                      objectFit: "contain",
                      filter: lost
                        ? `drop-shadow(0 0 8px ${RED_GLOW})`
                        : "none",
                      animation: isShake
                        ? "ov-shake 0.5s ease-in-out"
                        : "none",
                      pointerEvents: "none",
                    }}
                  />
                );
              })}
            </div>
            <span
              style={{
                fontSize: "0.5rem",
                letterSpacing: "0.02em",
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Run ends at 2 losses
            </span>
          </div>

          <div
            style={{
              background: SUBPANEL_BG,
              border: `1px solid ${RUST}`,
              borderRadius: "10px",
              padding: "0.45rem 0.7rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.05rem",
              boxShadow: "0 0 12px rgba(204,90,58,0.22)",
              minWidth: "96px",
            }}
          >
            <span
              style={{
                fontSize: "0.55rem",
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: RUST,
              }}
            >
              RUN WINS
            </span>
            <span
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                lineHeight: 1,
                color: "#fff",
              }}
            >
              {s?.currentRun?.total_wins ?? "—"}
            </span>
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Best {s?.bestRun ?? "—"}
            </span>
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                alignItems: "center",
                marginTop: "0.15rem",
              }}
            >
              <Gem color={MYTHIC} count={s?.mythics ?? 0} label="M" />
              <Gem color={RARE} count={s?.rares ?? 0} label="R" />
            </div>
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
          fontSize: "0.58rem",
          letterSpacing: "0.14em",
          fontWeight: 700,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff" }}>
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

function IngotImage({ index, won, pop, flash }) {
  const anim = pop
    ? "ov-crosspop 0.5s ease-out"
    : flash
    ? "ov-flash 0.6s ease-in-out infinite"
    : "none";
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        animation: anim,
      }}
    >
      <img
        src={INGOTS.cold[index]}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center bottom",
          opacity: won ? 0 : 1,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
        }}
      />
      <img
        src={INGOTS.hot[index]}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center bottom",
          opacity: won ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function Gem({ color, count, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      <div
        style={{
          width: 11,
          height: 11,
          borderRadius: "999px",
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: color }}>
        {label}
      </span>
      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>
        {count}
      </span>
    </div>
  );
}