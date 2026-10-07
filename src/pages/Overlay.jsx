import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const RUST = "#cc5a3a";
const RUST_GLOW = "rgba(204,90,58,0.9)";
const RED = "#c0392b";
const RED_GLOW = "rgba(192,57,43,0.9)";
const PANEL = "rgba(26,29,35,0.72)";
const PANEL_BORDER = "rgba(204,90,58,0.35)";

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
      setPopSlot(wins);
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
      className="w-screen h-screen flex items-center justify-center"
      style={{ background: "transparent" }}
    >
      <style>{`
        @keyframes ov-pop { 0% { transform: scale(0.4); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
        @keyframes ov-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
        @keyframes ov-flash { 0%,100% { filter: brightness(1); box-shadow: 0 0 0 rgba(204,90,58,0); } 50% { filter: brightness(1.7); box-shadow: 0 0 22px rgba(204,90,58,0.95); } }
        @keyframes ov-msg { 0% { opacity: 0; transform: translateY(8px) scale(0.92); } 15% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-4px) scale(0.96); } }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2.5rem",
          padding: "1.5rem 2.25rem",
          borderRadius: "16px",
          background: PANEL,
          border: `1px solid ${PANEL_BORDER}`,
          boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            alignItems: "center",
            minWidth: "120px",
          }}
        >
          <SideStat
            label="Attempt"
            value={s?.currentRun ? `#${s.currentRun.attempt_number}` : "—"}
          />
          <SideStat label="Stage" value={s?.currentRun?.stage ?? "—"} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const filled = i <= wins;
              const isCurrent = i === wins;
              const isPop = popSlot === i;
              const isFlash = flashAll;
              return (
                <div
                  key={i}
                  style={{
                    width: isCurrent ? 46 : 38,
                    height: isCurrent ? 64 : 54,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: "4px",
                    fontSize: isCurrent ? "1.05rem" : "0.85rem",
                    fontWeight: 700,
                    color: filled ? "#1a1d23" : "rgba(255,255,255,0.45)",
                    background: filled ? RUST : "rgba(255,255,255,0.06)",
                    border: `1px solid ${
                      filled ? "rgba(204,90,58,0.9)" : "rgba(255,255,255,0.12)"
                    }`,
                    boxShadow: isCurrent ? `0 0 16px ${RUST_GLOW}` : "none",
                    transition: "width 0.2s, height 0.2s, background 0.2s",
                    animation: isFlash
                      ? "ov-flash 0.6s ease-in-out infinite"
                      : isPop
                      ? "ov-pop 0.5s ease-out"
                      : "none",
                  }}
                >
                  {i}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            {[0, 1].map((i) => {
              const filled = i < losses;
              const isShake = shakePip === i;
              return (
                <div
                  key={i}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "999px",
                    background: filled ? RED : "rgba(255,255,255,0.08)",
                    border: `1px solid ${
                      filled ? "rgba(192,57,43,0.9)" : "rgba(255,255,255,0.14)"
                    }`,
                    boxShadow: filled ? `0 0 12px ${RED_GLOW}` : "none",
                    animation: isShake ? "ov-shake 0.5s ease-in-out" : "none",
                  }}
                />
              );
            })}
          </div>

          <div
            style={{
              height: "2.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "320px",
            }}
          >
            {cleared && (
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: RUST,
                  textShadow: `0 0 18px ${RUST_GLOW}`,
                  animation: "ov-msg 3s ease-in-out forwards",
                }}
              >
                STAGE CLEARED
              </div>
            )}
            {died && !cleared && (
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: RED,
                  textShadow: `0 0 18px ${RED_GLOW}`,
                  animation: "ov-msg 3s ease-in-out forwards",
                }}
              >
                RUN DEATH
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            alignItems: "center",
            minWidth: "120px",
          }}
        >
          <SideStat label="Run Wins" value={s?.currentRun?.total_wins ?? "—"} />
          <SideStat label="Best Run" value={s?.bestRun ?? "—"} />
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              marginTop: "0.25rem",
              whiteSpace: "nowrap",
            }}
          >
            Mythics {s?.mythics ?? "—"} · Rares {s?.rares ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function SideStat({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "#fff",
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        }}
      >
        {value}
      </span>
    </div>
  );
}