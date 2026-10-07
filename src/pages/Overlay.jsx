import React, { useEffect, useRef, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { base44 } from "@/api/base44Client";

const RUST = "#cc5a3a";
const RUST_GLOW = "rgba(204,90,58,0.9)";
const RED = "#c0392b";
const RED_GLOW = "rgba(192,57,43,0.9)";
const PANEL_BG =
  "linear-gradient(180deg, rgba(43,47,55,0.82) 0%, rgba(20,23,29,0.82) 100%)";
const PANEL_BORDER = "rgba(204,90,58,0.4)";
const SUBPANEL_BG =
  "linear-gradient(180deg, rgba(15,18,24,0.92) 0%, rgba(8,10,14,0.92) 100%)";
const TIMELINE_COLOR = "rgba(255,255,255,0.35)";
const SMOKE =
  "0 0 2px rgba(0,0,0,0.6), 0 1px 1px rgba(0,0,0,0.7)";

const MEDALS = {
  hot: [
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/810294b31_medal-hot-0.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/123325571_medal-hot-1.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/b2c010e86_medal-hot-2.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/5061f79b1_medal-hot-3.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/2a67fd321_medal-hot-4.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/4c3e26e02_medal-hot-5.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/0ec16adc1_medal-hot-6.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/26a1425e9_medal-hot-7.png",
  ],
  current: [
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/ea7a41c3c_medal-current-0.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/62054d24d_medal-current-1.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/7c1831fc3_medal-current-2.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/e50dc10c0_medal-current-3.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/8c2e88040_medal-current-4.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/2e621e708_medal-current-5.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/495cc7154_medal-current-6.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/25d141688_medal-current-7.png",
  ],
  future: [
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/2f366aa0b_medal-future-0.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/e589aef15_medal-future-1.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/f930d25d7_medal-future-2.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/5af031f2f_medal-future-3.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/75f4f0587_medal-future-4.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/9e0fc3e74_medal-future-5.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/ddab8e513_medal-future-6.png",
    "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/12ce72a02_medal-future-7.png",
  ],
};

const LOSS_EMPTY =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/85391f904_loss-empty.png";
const LOSS_FILLED =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/2ff301ce9_loss-filled.png";

const SLOT_W = 118;
const SLOT_GAP = 6;

function activeKey(i, wins) {
  return i < wins ? "hot" : i === wins ? "current" : "future";
}

export default function Overlay() {
  const [data, setData] = useState(null);

  const [popSlots, setPopSlots] = useState([]);
  const [shakePip, setShakePip] = useState(null);
  const [died, setDied] = useState(false);

  const prevActive = useRef(null);
  const prevLosses = useRef(null);
  const popTimer = useRef(null);
  const shakeTimer = useRef(null);
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
        const [runs, climbs] = await Promise.all([
          base44.entities.Run.filter({ season_id: season.id }),
          base44.entities.Climb.list(),
        ]);
        if (!active) return;
        const sortedRuns = [...runs].sort(
          (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
        );
        const currentRun =
          runs.find((r) => r.result === "in_progress") || sortedRuns[0] || null;
        const bestRun = runs.reduce((m, r) => Math.max(m, r.total_wins || 0), 0);

        const sortedClimbs = [...climbs].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        const latestClimb = sortedClimbs[0];
        let day = null;
        if (latestClimb) {
          if (latestClimb.status === "active" && latestClimb.start_date) {
            day =
              differenceInCalendarDays(
                new Date(),
                new Date(latestClimb.start_date)
              ) + 1;
          } else if (latestClimb.status === "complete") {
            day = latestClimb.days_taken || null;
          }
        }
        const completed = climbs.filter(
          (c) => c.status === "complete" && c.days_taken != null
        );
        const record = completed.length
          ? Math.min(...completed.map((c) => c.days_taken))
          : null;

        setData({ season, currentRun, bestRun, day, record });
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
    const wins = data?.currentRun ? Number(data.currentRun.round_wins || 0) : 0;
    const losses = data?.currentRun
      ? Number(data.currentRun.round_losses || 0)
      : 0;
    const survived = data?.currentRun
      ? data.currentRun.round_status === "survived"
      : false;

    const newActive = Array.from({ length: 8 }, (_, i) =>
      survived ? "hot" : activeKey(i, wins)
    );

    if (prevActive.current === null) {
      prevActive.current = newActive;
      prevLosses.current = losses;
      return;
    }

    const changed = [];
    for (let i = 0; i < 8; i++) {
      if (newActive[i] !== prevActive.current[i]) changed.push(i);
    }
    if (changed.length) {
      setPopSlots(changed);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopSlots([]), 500);
    }
    prevActive.current = newActive;

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

    prevLosses.current = losses;
  }, [data]);

  useEffect(
    () => () => {
      if (popTimer.current) clearTimeout(popTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (diedTimer.current) clearTimeout(diedTimer.current);
    },
    []
  );

  const s = data;
  const wins = s?.currentRun ? Number(s.currentRun.round_wins || 0) : 0;
  const losses = s?.currentRun ? Number(s.currentRun.round_losses || 0) : 0;
  const survived = Boolean(s?.currentRun?.round_status === "survived");
  const seasonNumber = s?.season?.season_number ?? null;
  const day = s?.day ?? null;
  const record = s?.record ?? null;

  return (
    <div
      className="w-screen h-screen flex items-start justify-center pt-10"
      style={{ background: "transparent" }}
    >
      <style>{`
        @keyframes ov-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(4px); } }
        @keyframes ov-msg { 0% { opacity: 0; transform: translateY(6px) scale(0.92); } 15% { opacity: 1; transform: translateY(0) scale(1); } 85% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-4px) scale(0.96); } }
        @keyframes ov-crosspop { 0% { transform: scale(0.82); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <span
          style={{
            fontSize: "0.95rem",
            letterSpacing: "0.34em",
            fontWeight: 800,
            color: RUST,
            textShadow: `0 0 14px ${RUST_GLOW}`,
          }}
        >
          IRONDECK
        </span>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "stretch",
            gap: "1.3rem",
            padding: "0.7rem 1.4rem",
            color: "#fff",
            fontFamily: "sans-serif",
          }}
        >
        {/* LEFT: Season / Day / Record */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.45rem",
            minWidth: "92px",
          }}
        >
          <SideStat label="Season" value={seasonNumber ?? "—"} />
          <SideStat label="Day" value={day ?? "—"} />
          {record != null && (
            <SideStat label="Record" value={`${record} days`} />
          )}
        </div>

        <Divider />

        {/* CENTER: 8 medallions + timeline + labels + losses */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.35rem",
            justifyContent: "center",
          }}
        >
          {/* Medallions row */}
          <div
            style={{
              display: "flex",
              gap: SLOT_GAP,
              alignItems: "flex-end",
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <Medallion
                key={i}
                index={i}
                wins={wins}
                survived={survived}
                pop={popSlots.includes(i)}
              />
            ))}
          </div>

          {/* Timeline: line + ticks */}
          <div
            style={{
              position: "relative",
              width: 8 * SLOT_W + 7 * SLOT_GAP,
              borderTop: `1px solid ${TIMELINE_COLOR}`,
              height: 8,
              marginTop: 2,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  left: i * (SLOT_W + SLOT_GAP) + SLOT_W / 2,
                  width: 2,
                  height: 8,
                  background: TIMELINE_COLOR,
                  transform: "translateX(-1px)",
                }}
              />
            ))}
          </div>

          {/* Labels row */}
          <div style={{ display: "flex", gap: SLOT_GAP }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const isCurrent = i === wins;
              const isWon = i < wins;
              return (
                <div
                  key={i}
                  style={{
                    width: SLOT_W,
                    textAlign: "center",
                    fontSize: "0.6rem",
                    letterSpacing: "0.03em",
                    fontWeight: 700,
                    color: isCurrent
                      ? "#ffffff"
                      : isWon
                      ? RUST
                      : "rgba(255,255,255,0.4)",
                    textShadow: isWon ? "none" : SMOKE,
                    transition: "color 0.3s ease",
                  }}
                >
                  {i === 1 ? "1 Win" : `${i} Wins`}
                </div>
              );
            })}
          </div>

          {/* Loss diamonds + label */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.15rem",
              marginTop: "0.3rem",
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
                      width: 46,
                      height: 46,
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
                fontSize: "0.55rem",
                letterSpacing: "0.14em",
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                textShadow: SMOKE,
              }}
            >
              LOSSES
            </span>
          </div>
        </div>

        <Divider />

        {/* RIGHT: Run wins + Best */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "stretch",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.1rem",
              minWidth: "110px",
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
                fontSize: "2.6rem",
                fontWeight: 800,
                lineHeight: 1,
                color: "#fff",
                textShadow: SMOKE,
              }}
            >
              {s?.currentRun?.total_wins ?? "—"}
            </span>
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
                textShadow: SMOKE,
              }}
            >
              Best {s?.bestRun ?? "—"}
            </span>
          </div>
        </div>

        {survived && (
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
              color: RUST,
              textShadow: `0 0 16px ${RUST_GLOW}`,
              whiteSpace: "nowrap",
            }}
          >
            DAY SURVIVED
          </div>
        )}
        {died && !survived && (
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
              color: RED,
              textShadow: `0 0 16px ${RED_GLOW}`,
              animation: "ov-msg 3s ease-in-out forwards",
              whiteSpace: "nowrap",
            }}
          >
            RUN DEATH
          </div>
        )}
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
          fontSize: "0.58rem",
          letterSpacing: "0.14em",
          fontWeight: 700,
          color: "rgba(255,255,255,0.5)",
          textShadow: SMOKE,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", textShadow: SMOKE }}>
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

function Medallion({ index, wins, survived, pop }) {
  const active = survived ? "hot" : activeKey(index, wins);
  const anim = pop ? "ov-crosspop 0.5s ease-out" : "none";
  return (
    <div
      style={{
        position: "relative",
        width: SLOT_W,
        height: SLOT_W,
        animation: anim,
      }}
    >
      {["hot", "current", "future"].map((k) => (
        <img
          key={k}
          src={MEDALS[k][index]}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: SLOT_W,
            height: SLOT_W,
            objectFit: "contain",
            opacity: active === k ? 1 : 0,
            transition: "opacity 0.3s ease",
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}