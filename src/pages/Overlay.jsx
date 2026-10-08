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

const FONT_CINZEL = '"Cinzel", serif';
const FONT_CINZEL_DEC = '"Cinzel Decorative", serif';

const goldText = (fontSize) => ({
  fontFamily: FONT_CINZEL,
  fontWeight: 900,
  fontSize,
  lineHeight: 1,
  background: "linear-gradient(180deg, #FFF0CD 0%, #D68C3C 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1.5px #1A120C",
  filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.8))",
});

const steelText = (fontSize, dark = false) => ({
  fontFamily: FONT_CINZEL,
  fontWeight: 700,
  fontSize,
  lineHeight: 1,
  textTransform: "uppercase",
  letterSpacing: "1px",
  background: dark
    ? "linear-gradient(180deg, #787E88 0%, #5A606A 100%)"
    : "linear-gradient(180deg, #ECF0F6 0%, #8C94A0 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1.5px #1A120C",
  filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.8))",
});

const irondeckText = (fontSize) => ({
  fontFamily: FONT_CINZEL_DEC,
  fontWeight: 900,
  fontSize,
  lineHeight: 1,
  background: "linear-gradient(180deg, #FFC896 0%, #C85A28 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1.5px #1A120C",
  filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.8))",
});

const DPRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const DIAMONDS = {
  won: ["38be64a04", "5337373cc", "6eb5fce6b", "05a34bf8d", "e3efd766f", "5c948e2e9", "71a2393e5", "cea71edb4"]
    .map((h, i) => `${DPRE}${h}_win-won-${i}.png`),
  current: ["8e325f0fa", "3b901dc1d", "373755d90", "f4940b9e8", "90d0d6415", "c8b225792", "b772464d0", "420488ff8"]
    .map((h, i) => `${DPRE}${h}_win-current-${i}.png`),
  future: ["0a12206eb", "d564baeb6", "a4e768272", "27a7e507c", "7341bda7b", "c686130ca", "abcfe0b90", "89a41878d"]
    .map((h, i) => `${DPRE}${h}_win-future-${i}.png`),
};

const LOSS_EMPTY =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/15b7f88e7_loss-empty.png";
const LOSS_1 =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/c31956642_loss-1.png";
const LOSS_2 =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/e635c9962_loss-2.png";
const SURVIVED =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/632b9478b_survived.png";
const DEATH_RUN =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/102bb0e38_death-run.png";

const SLOT_W = 110;
const SLOT_GAP = 6;

function activeKey(i, wins) {
  return i < wins ? "won" : i === wins ? "current" : "future";
}

export default function Overlay() {
  const [data, setData] = useState(null);

  const [igniteSlot, setIgniteSlot] = useState(null);
  const [pulseSlot, setPulseSlot] = useState(null);
  const [flashPip, setFlashPip] = useState(null);

  const prevActive = useRef(null);
  const prevWins = useRef(null);
  const prevLosses = useRef(null);
  const igniteTimer = useRef(null);
  const flashTimer = useRef(null);

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
      survived ? "won" : activeKey(i, wins)
    );

    if (prevActive.current === null) {
      prevActive.current = newActive;
      prevWins.current = wins;
      prevLosses.current = losses;
      return;
    }

    prevActive.current = newActive;

    if (wins > prevWins.current) {
      setIgniteSlot(wins - 1);
      setPulseSlot(wins);
      if (igniteTimer.current) clearTimeout(igniteTimer.current);
      igniteTimer.current = setTimeout(() => setIgniteSlot(null), 400);
    }
    prevWins.current = wins;

    if (losses > prevLosses.current) {
      setFlashPip(losses - 1);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashPip(null), 400);
    }

    prevLosses.current = losses;
  }, [data]);

  useEffect(
    () => () => {
      if (igniteTimer.current) clearTimeout(igniteTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const s = data;
  const wins = s?.currentRun ? Number(s.currentRun.round_wins || 0) : 0;
  const losses = s?.currentRun ? Number(s.currentRun.round_losses || 0) : 0;
  const survived = Boolean(s?.currentRun?.round_status === "survived");
  const died = losses >= 2;
  const seasonNumber = s?.season?.season_number ?? null;
  const day = s?.day ?? null;
  const record = s?.record ?? null;

  return (
    <div
      className="w-screen h-screen flex items-start justify-center pt-10"
      style={{ background: "transparent" }}
    >
      <style>{`
        @keyframes ov-ignite { 0% { transform: scale(1); filter: brightness(1); } 30% { transform: scale(1.25); filter: brightness(1.8) drop-shadow(0 0 10px rgba(255,140,40,0.9)); } 100% { transform: scale(1); filter: brightness(1); } }
        @keyframes ov-breathe { 0%,100% { transform: scale(1.0); } 50% { transform: scale(1.05); } }
        @keyframes ov-currentpop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes ov-pipflash { 0% { transform: scale(1); filter: drop-shadow(0 0 8px ${RED_GLOW}) brightness(1); } 30% { transform: scale(1.3); filter: drop-shadow(0 0 14px ${RED_GLOW}) brightness(2.4); } 100% { transform: scale(1); filter: drop-shadow(0 0 8px ${RED_GLOW}) brightness(1); } }
        @keyframes ov-titlestamp { 0% { transform: translate(-50%,-50%) scale(2.5) rotate(-12deg); opacity: 0; } 100% { transform: translate(-50%,-50%) scale(1) rotate(-4deg); opacity: 1; } }
        @keyframes ov-screenshake-sm { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-3px, 1px); } 40% { transform: translate(3px, -2px); } 60% { transform: translate(-2px, 1px); } 80% { transform: translate(1px, 0); } }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <span style={irondeckText(24)}>IRONDECK</span>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "stretch",
            gap: "1.3rem",
            padding: "0.7rem 1.4rem",
            color: "#fff",
            fontFamily: "sans-serif",
            animation:
              survived || died
                ? "ov-screenshake-sm 0.4s ease-in-out 0.35s"
                : "none",
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
          <SideStat label="SEASON" value={seasonNumber ?? "—"} labelStyle={steelText(26)} valueStyle={steelText(40)} />
          <SideStat label="DAY" value={day ?? "—"} labelStyle={steelText(26)} valueStyle={goldText(54)} />
          {record != null && (
            <SideStat label="RECORD" value={`${record} DAYS`} labelStyle={steelText(26)} valueStyle={steelText(26)} />
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
              alignItems: "center",
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <Medallion
                key={i}
                index={i}
                wins={wins}
                survived={survived}
                ignite={igniteSlot === i}
                pulse={pulseSlot === i}
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
              const isReached = i <= wins;
              return (
                <div
                  key={i}
                  style={{
                    width: SLOT_W,
                    textAlign: "center",
                    ...(isReached ? goldText(17) : steelText(17, true)),
                    transition: "background 0.3s ease",
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
                const filled = i === 0 ? losses >= 1 : losses >= 2;
                const src =
                  i === 0
                    ? losses >= 1
                      ? LOSS_1
                      : LOSS_EMPTY
                    : losses >= 2
                    ? LOSS_2
                    : LOSS_EMPTY;
                const isFlash = flashPip === i;
                return (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                      width: 46,
                      height: 46,
                      objectFit: "contain",
                      filter: filled
                        ? `drop-shadow(0 0 8px ${RED_GLOW})`
                        : "none",
                      animation: isFlash
                        ? "ov-pipflash 0.4s ease-out"
                        : "none",
                      pointerEvents: "none",
                    }}
                  />
                );
              })}
            </div>
            <span style={steelText(18)}>LOSSES</span>
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
            <span style={steelText(26)}>RUN</span>
            <span style={goldText(76)}>{s?.currentRun?.total_wins ?? "—"}</span>
            <span style={steelText(26)}>BEST {s?.bestRun ?? "—"}</span>
          </div>
        </div>

        </div>
      </div>
      {survived && (
        <img
          src={SURVIVED}
          alt="DAY SURVIVED"
          draggable={false}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            width: 520,
            transform: "translate(-50%,-50%)",
            animation:
              "ov-titlestamp 0.35s cubic-bezier(0.15, 0.9, 0.3, 1) both",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
      {died && !survived && (
        <img
          src={DEATH_RUN}
          alt="RUN DEATH"
          draggable={false}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            width: 520,
            transform: "translate(-50%,-50%)",
            animation:
              "ov-titlestamp 0.35s cubic-bezier(0.15, 0.9, 0.3, 1) both",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

function SideStat({ label, value, labelStyle, valueStyle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
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

function Medallion({ index, wins, survived, ignite, pulse }) {
  const active = survived ? "won" : activeKey(index, wins);
  let anim = "none";
  if (ignite) {
    anim = "ov-ignite 0.4s ease-out";
  } else if (active === "current") {
    anim = pulse
      ? "ov-currentpop 0.3s ease, ov-breathe 1.6s ease-in-out infinite 0.3s"
      : "ov-breathe 1.6s ease-in-out infinite";
  }
  return (
    <div
      style={{
        position: "relative",
        width: SLOT_W,
        height: SLOT_W,
        animation: anim,
      }}
    >
      {["won", "current", "future"].map((k) => (
        <img
          key={k}
          src={DIAMONDS[k][index]}
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