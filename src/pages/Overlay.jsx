import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { liveReload } from "@/lib/liveReload";
import { loadDayLogs, roundDay } from "@/lib/roundDay";
import { goldText, steelText, irondeckText } from "@/lib/overlayText";

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

const DPRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const DIAMONDS = {
  won: ["d00d35fc6", "4a1fe34b6", "894562e97", "8e4c0cdf4", "f6c98f779", "c22df9ff5", "6b3cea327", "2aa7c4fa9"]
    .map((h, i) => `${DPRE}${h}_win-won-${i}.png`),
  current: ["abbc514ab", "248774feb", "13521630d", "d393fb7e4", "cbb512916", "3c510e6c7", "249c5eccb", "f64736e5a"]
    .map((h, i) => `${DPRE}${h}_win-current-${i}.png`),
  future: ["ae065396e", "72347b8a9", "866337c2f", "0c3e97da6", "32d047d90", "881388982", "be6471094", "d034996f4"]
    .map((h, i) => `${DPRE}${h}_win-future-${i}.png`),
};

const LOSS_EMPTY = `${DPRE}43bd79795_loss-empty.png`;
const LOSS_1 = `${DPRE}04f5808d9_loss-1.png`;
const LOSS_2 = `${DPRE}0901a13ba_loss-2.png`;
const SURVIVED = `${DPRE}158b6c909_survived.png`;
const DEATH_RUN = `${DPRE}a1e57edaa_death-run.png`;

// Arena constructed rank emblems: one image sheet, 4 columns (Tier 1 → 4, left
// to right) × 6 rows (Bronze, Silver, Gold, Platinum, Diamond, Mythic).
// Paste the uploaded rank-emblems.png link between the quotes. Leave "" for text only.
const RANK_SPRITE = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/78b084191_rank-emblems.png";
const RANK_ROWS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
const RANK_ANIM_MS = 2600;

// One number per rank position, so we can tell up from down.
const rankScore = (r) =>
  r
    ? RANK_ROWS.indexOf(r.rank_class) * 100 +
      (r.rank_class === "Mythic" ? 0 : (4 - (Number(r.tier) || 4)) * 10) +
      (Number(r.step) || 0)
    : null;
const rankPos = (r) =>
  r ? RANK_ROWS.indexOf(r.rank_class) * 10 + (r.rank_class === "Mythic" ? 0 : 4 - (Number(r.tier) || 4)) : null;

const SLOT_W = 110;
const SLOT_GAP = 6;

// Win slots are 1-7: a slot fills once that many wins are reached.
const WIN_SLOTS = [1, 2, 3, 4, 5, 6, 7];

function activeKey(slot, wins) {
  return slot <= wins ? "won" : "future";
}

export default function Overlay({ embedded = false } = {}) {
  const [data, setData] = useState(null);

  const [igniteSlot, setIgniteSlot] = useState(null);
  const [pulseSlot, setPulseSlot] = useState(null);
  const [flashPip, setFlashPip] = useState(null);
  const [rankAnim, setRankAnim] = useState(null); // { kind: "up" | "down" | "step", key }
  const prevRank = useRef(null);
  const rankTimer = useRef(null);

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
        const [runs, climbs, logs, ranks] = await Promise.all([
          base44.entities.Run.filter({ season_id: season.id }),
          base44.entities.Climb.list(),
          loadDayLogs(season.id),
          base44.entities.ArenaRank
            ? base44.entities.ArenaRank.list("-created_date", 1).catch(() => [])
            : Promise.resolve([]),
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
        const day = roundDay({
          logs,
          climb: latestClimb,
          playing: currentRun?.round_status === "playing",
        });
        const completed = climbs.filter(
          (c) => c.status === "complete" && c.days_taken != null
        );
        const record = completed.length
          ? Math.min(...completed.map((c) => c.days_taken))
          : null;

        setData({ season, currentRun, bestRun, day, record, rank: ranks[0] || null });
      } catch (e) {
        // keep last data on error
      }
    };
    const stopLive = liveReload(["Season", "Run", "Climb", "DayLog", "ArenaRank"], load);
    return () => {
      active = false;
      stopLive();
    };
  }, []);

  // Rank changes: rank up / rank down / step gained (not on first load)
  useEffect(() => {
    const r = data?.rank;
    if (!r) return;
    const before = prevRank.current;
    prevRank.current = r;
    if (!before) return;
    const pos0 = rankPos(before);
    const pos1 = rankPos(r);
    let kind = null;
    if (pos1 > pos0) kind = "up";
    else if (pos1 < pos0) kind = "down";
    else if (rankScore(r) > rankScore(before)) kind = "step";
    if (!kind) return;
    setRankAnim({ kind, key: Date.now(), fromStep: Number(before.step) || 0 });
    if (rankTimer.current) clearTimeout(rankTimer.current);
    rankTimer.current = setTimeout(() => setRankAnim(null), RANK_ANIM_MS);
  }, [data?.rank]);

  // Animate only on value changes, not on every refresh.
  useEffect(() => {
    const wins = data?.currentRun ? Number(data.currentRun.round_wins || 0) : 0;
    const losses = data?.currentRun
      ? Number(data.currentRun.round_losses || 0)
      : 0;
    const survived = data?.currentRun
      ? data.currentRun.round_status === "survived"
      : false;

    const newActive = WIN_SLOTS.map((slot) =>
      survived ? "won" : activeKey(slot, wins)
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
  // The 7th win: the survived screen plays only if the win has just happened
  // (not when OBS refreshes later). It holds solid until the next round starts.
  const [celebrate, setCelebrate] = useState(false);
  const celebrated = useRef("");
  const runId = s?.currentRun?.id || "";
  const runUpdated = s?.currentRun?.updated_date || "";
  useEffect(() => {
    if (!survived || !runId || celebrated.current === runId) return;
    celebrated.current = runId;
    const v = String(runUpdated);
    const at = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v + "Z") || 0;
    if (Date.now() - at < 60000) setCelebrate(true);
  }, [survived, runId, runUpdated]);
  useEffect(() => {
    if (!survived) setCelebrate(false);
  }, [survived]);
  const died = losses >= 2;
  const seasonNumber = s?.season?.season_number ?? null;
  const day = s?.day ?? null;
  const record = s?.record ?? null;

  return (
    <div
      className={embedded ? undefined : "w-screen h-screen flex items-start justify-center pt-0"}
      style={
        embedded
          ? { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }
          : { background: "transparent", paddingLeft: 480, boxSizing: "border-box" }
      }
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

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "stretch",
            gap: "1.3rem",
            padding: "0.7rem 1.4rem",
            color: "#fff",
            fontFamily: "sans-serif",
            // light see-through panel: helps the text without hiding the board
            background: embedded ? "none" : "linear-gradient(180deg, rgba(8,9,14,0.5) 0%, rgba(8,9,14,0.3) 100%)",
            borderRadius: 16,
            boxShadow: embedded ? "none" : "0 0 0 1px rgba(255,255,255,0.07), 0 8px 24px rgba(0,0,0,0.25)",
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
            {WIN_SLOTS.map((slot, i) => (
              <Medallion
                key={slot}
                index={slot}
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
              width: 7 * SLOT_W + 6 * SLOT_GAP,
              borderTop: `1px solid ${TIMELINE_COLOR}`,
              height: 8,
              marginTop: 2,
            }}
          >
            {WIN_SLOTS.map((slot, i) => (
              <div
                key={slot}
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
            {WIN_SLOTS.map((slot) => {
              const isReached = slot <= wins;
              // key includes the state so the label is redrawn cleanly when it
              // changes (a background fade here broke the text clipping)
              return (
                <div
                  key={`${slot}-${isReached ? "won" : "open"}`}
                  style={{
                    width: SLOT_W,
                    textAlign: "center",
                    ...(isReached ? goldText(17) : steelText(17, true)),
                  }}
                >
                  {slot === 1 ? "1 Win" : `${slot} Wins`}
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
                      width: 72,
                      height: 72,
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

        {s?.rank && (
          <>
            <Divider />
            <RankBlock key={rankAnim?.key || "rank"} rank={s.rank} anim={rankAnim} />
          </>
        )}

        </div>
      </div>
      {celebrate && <SurviveCelebration embedded={embedded} />}
    </div>
  );
}

// Current Arena rank: emblem, rank + tier, and step pips (6 per tier).
// Animates on rank up (burst + "RANK UP"), rank down (shake), and steps gained.
function RankBlock({ rank, anim }) {
  const cls = rank.rank_class || "";
  const row = RANK_ROWS.indexOf(cls);
  const isMythic = cls === "Mythic";
  const tier = Math.min(4, Math.max(1, Number(rank.tier) || 4));
  const col = isMythic ? 0 : tier - 1;
  const size = 96;
  const steps = Math.max(0, Math.min(6, Number(rank.step) || 0));
  const label = isMythic
    ? rank.leaderboard_place
      ? `#${rank.leaderboard_place}`
      : rank.percentile
      ? `${Math.round(Number(rank.percentile))}%`
      : ""
    : `TIER ${tier}`;
  const up = anim?.kind === "up";
  const down = anim?.kind === "down";
  const stepUp = anim?.kind === "step";
  const emblemAnim = up
    ? "ov-rankup 1.3s cubic-bezier(0.2, 0.8, 0.3, 1)"
    : down
    ? "ov-rankdown 0.6s ease-in-out"
    : "none";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.3rem",
        minWidth: "130px",
      }}
    >
      <style>{`
        @keyframes ov-rankup {
          0% { transform: scale(1); filter: brightness(1) drop-shadow(0 4px 8px rgba(0,0,0,0.8)); }
          25% { transform: scale(1.45); filter: brightness(2) drop-shadow(0 0 26px rgba(255,190,90,1)); }
          60% { transform: scale(0.94); filter: brightness(1.3) drop-shadow(0 0 14px rgba(255,170,60,0.8)); }
          100% { transform: scale(1); filter: brightness(1) drop-shadow(0 4px 8px rgba(0,0,0,0.8)); }
        }
        @keyframes ov-rankring { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.95; } 100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; } }
        @keyframes ov-rankdown {
          0%,100% { transform: translateX(0); filter: none; }
          20% { transform: translateX(-5px); filter: grayscale(0.6) brightness(0.7); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); filter: none; }
        }
        @keyframes ov-rankword { 0% { transform: translate(-50%, 10px) scale(0.6); opacity: 0; } 15% { transform: translate(-50%, 0) scale(1.1); opacity: 1; } 25% { transform: translate(-50%, 0) scale(1); } 80% { opacity: 1; } 100% { transform: translate(-50%, -8px); opacity: 0; } }
        @keyframes ov-stepin { 0% { transform: rotate(45deg) scale(1); } 40% { transform: rotate(45deg) scale(1.9); filter: brightness(2.2); } 100% { transform: rotate(45deg) scale(1); } }
      `}</style>

      {up && (
        <>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: size / 2,
              width: size * 1.2,
              height: size * 1.2,
              borderRadius: "50%",
              border: "3px solid rgba(255,200,110,0.95)",
              boxShadow: "0 0 24px 6px rgba(255,170,60,0.7)",
              animation: "ov-rankring 1.1s ease-out forwards",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -30,
              whiteSpace: "nowrap",
              ...goldText(24),
              letterSpacing: "3px",
              animation: `ov-rankword ${RANK_ANIM_MS}ms ease forwards`,
              pointerEvents: "none",
            }}
          >
            RANK UP!
          </div>
        </>
      )}

      {RANK_SPRITE && row >= 0 ? (
        <div
          style={{
            width: size,
            height: size,
            backgroundImage: `url(${RANK_SPRITE})`,
            backgroundSize: `${size * 4}px ${size * 6}px`,
            backgroundPosition: `${-col * size}px ${-row * size}px`,
            backgroundRepeat: "no-repeat",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.8))",
            animation: emblemAnim,
          }}
        />
      ) : null}
      <span style={{ ...goldText(30), animation: RANK_SPRITE ? "none" : emblemAnim }}>
        {cls.toUpperCase() || "—"}
      </span>
      {label && <span style={steelText(20)}>{label}</span>}
      {!isMythic && (
        <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = i < steps;
            const fresh = stepUp && filled && i >= (anim?.fromStep || 0);
            return (
              <div
                key={i}
                style={{
                  width: 11,
                  height: 11,
                  transform: "rotate(45deg)",
                  borderRadius: 2,
                  border: "1.5px solid #120d08",
                  background: filled
                    ? "linear-gradient(135deg,#FFF0CD,#D68C3C)"
                    : "rgba(60,64,72,0.9)",
                  boxShadow: filled ? "0 0 6px rgba(255,170,60,0.8)" : "none",
                  animation: fresh ? `ov-stepin 0.6s ease-out ${(i - (anim?.fromStep || 0)) * 0.15}s both` : "none",
                }}
              />
            );
          })}
        </div>
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


// The 7th win: the ember frame rises out of the dark over the game window (or the
// whole page when the HUD is used on its own), its gems ignite, SURVIVED stamps into
// the centre, and it holds solid, ready for OBS to fade into the outro.
const SURVIVE_FRAME = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/3ef98d1bd_irondeck-survived-background.webp";
const SV_EMBLEM = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/724202f99_irondeck-survived-emblem-sheet.webp";
const SV_EMBLEM_FRAMES = 15;
// Load the emblem early so it's ready the moment the 7th win lands
if (typeof Image !== "undefined") new Image().src = SV_EMBLEM;
const SV_GEMS = [
  { x: 50, y: 15, d: 0.9, s: 8 },
  { x: 3.5, y: 50, d: 1.15, s: 8 },
  { x: 96.4, y: 49.5, d: 1.15, s: 8 },
  { x: 50, y: 82, d: 1.4, s: 8 },
];
const SV_ORBS = [ { x: 35, y: 8 }, { x: 64, y: 6 }, { x: 7, y: 62 }, { x: 93, y: 62 } ];
function SurviveCelebration({ embedded }) {
  const box = embedded
    ? { left: 480, top: 270, width: 1440, height: 810 }
    : { left: 0, top: 0, width: "100vw", height: "100vh" };
  const embers = Array.from({ length: 34 }, (_, i) => ({
    x: (i * 37) % 100, y: 60 + ((i * 53) % 40), d: 1 + (i % 9) * 0.5, s: 3 + (i % 4) * 2, t: 3.5 + (i % 5) * 0.6,
  }));
  return (
    <div style={{ position: "fixed", ...box, zIndex: 50, pointerEvents: "none", overflow: "hidden", background: "#050302",
      animation: "sv-black .5s ease both" }}>
      <style>{`
        @keyframes sv-black { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sv-framein { 0% { opacity: 0; filter: brightness(0); transform: translateY(-50%) scale(1.08) }
          60% { opacity: 1 } 100% { opacity: 1; filter: brightness(1); transform: translateY(-50%) scale(1) } }
        @keyframes sv-ignite { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.2) } 40% { opacity: 1; transform: translate(-50%, -50%) scale(1.8) }
          100% { opacity: .75; transform: translate(-50%, -50%) scale(1) } }
        @keyframes sv-pulse { 0%, 100% { opacity: .75 } 50% { opacity: .35 } }
        @keyframes sv-orb { 0%, 100% { opacity: .25 } 50% { opacity: .7 } }
        @keyframes sv-flicker { 0% { opacity: .55 } 17% { opacity: .8 } 31% { opacity: .5 } 48% { opacity: .9 } 66% { opacity: .6 } 83% { opacity: .85 } 100% { opacity: .55 } }
        @keyframes sv-ember { 0% { opacity: 0; transform: translate(0, 0) } 15% { opacity: 1 } 100% { opacity: 0; transform: translate(30px, -320px) } }
        @keyframes sv-stamp { 0% { transform: translate(-50%, -50%) scale(2.6); opacity: 0 } 70% { transform: translate(-50%, -50%) scale(.96); opacity: 1 }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
        @keyframes sv-shock { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3) } 8% { opacity: .9 } 100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2) } }
        @keyframes sv-breathe { 0%, 100% { filter: drop-shadow(0 0 24px rgba(255,170,60,.7)) } 50% { filter: drop-shadow(0 0 48px rgba(255,190,90,1)) } }
      `}</style>
      <div style={{ position: "absolute", left: 0, top: "50%", width: "100%", aspectRatio: "1732 / 908",
        animation: "sv-framein 1.4s cubic-bezier(.2,.8,.3,1) .2s both" }}>
        <img src={SURVIVE_FRAME} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        {/* Flames licking along the top edge */}
        <div style={{ position: "absolute", left: "28%", top: "-4%", width: "44%", height: "34%", mixBlendMode: "screen",
          background: "radial-gradient(ellipse at 50% 60%, rgba(255,120,30,.55), rgba(200,60,10,.2) 45%, transparent 70%)",
          animation: "sv-flicker 1.6s linear 1s infinite both" }} />
        {SV_ORBS.map((o, i) => (
          <div key={"o" + i} style={{ position: "absolute", left: o.x + "%", top: o.y + "%", width: "7%", aspectRatio: "1", transform: "translate(-50%, -50%)",
            borderRadius: "50%", mixBlendMode: "screen", background: "radial-gradient(circle, rgba(255,190,90,.8), transparent 65%)",
            animation: `sv-orb 3s ease-in-out ${1.6 + i * 0.3}s infinite both` }} />
        ))}
        {SV_GEMS.map((g, i) => (
          <div key={"g" + i} style={{ position: "absolute", left: g.x + "%", top: g.y + "%", width: g.s + "%", aspectRatio: "1", borderRadius: "50%",
            mixBlendMode: "screen", background: "radial-gradient(circle, rgba(255,220,140,1), rgba(255,130,40,.7) 30%, transparent 68%)",
            animation: `sv-ignite .7s ease-out ${g.d}s both, sv-pulse 2.4s ease-in-out ${g.d + 0.7}s infinite` }} />
        ))}
      </div>
      {embers.map((m, i) => (
        <div key={i} style={{ position: "absolute", left: m.x + "%", top: m.y + "%", width: m.s, height: m.s, borderRadius: "50%",
          background: "#FFC27A", boxShadow: "0 0 10px 3px rgba(255,120,30,.8)", animation: `sv-ember ${m.t}s ease-out ${m.d}s infinite both` }} />
      ))}
      {/* Shockwave as SURVIVED burns in */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: "40%", aspectRatio: "1", borderRadius: "50%",
        border: "6px solid rgba(255,200,110,.9)", boxShadow: "0 0 40px rgba(255,170,60,.9)", animation: "sv-shock .8s ease-out 3.3s both" }} />
      {/* Animated SURVIVED emblem: forms, the banner unfurls, the word burns in, then holds on the last frame */}
      <style>{`@keyframes sv-emblem { from { background-position: 0% 0 } to { background-position: 100% 0 } }`}</style>
      <div role="img" aria-label="DAY SURVIVED" style={{ position: "absolute", left: "50%", top: "50%", width: "36%", aspectRatio: "552 / 392",
        transform: "translate(-50%, -50%)", backgroundImage: `url(${SV_EMBLEM})`, backgroundRepeat: "no-repeat",
        backgroundSize: `${SV_EMBLEM_FRAMES * 100}% 100%`,
        animation: `sv-black .3s ease 1.5s both, sv-emblem ${((SV_EMBLEM_FRAMES - 1) / 6).toFixed(2)}s steps(${SV_EMBLEM_FRAMES - 1}) 1.5s forwards, sv-breathe 3s ease-in-out 4s infinite` }} />
    </div>
  );
}