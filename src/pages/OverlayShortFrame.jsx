import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs } from "@/lib/roundDay";
import { blockState } from "@/lib/condemned";
import { ukDate } from "@/lib/ukDay";
import { goldText, steelText, purpleText } from "@/lib/overlayText";

// Shorts frame (1080×1920): today's hook at the top, a clip window, the stakes below.
// Open /overlay/short in an OBS browser source sized 1080×1920, then right-click the
// source → "Screenshot (Source)" to save a full-size PNG for CapCut.
// The clip window is pure green (#00FF00): in CapCut put the frame ABOVE your clip and
// use Chroma key on it. Options: ?window=clear (transparent window instead of green),
// ?hook=YOUR TEXT&sub=YOUR TEXT (override the automatic hook).

const SHIELD = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
const WIN = { x: 0, y: 390, w: 1080, h: 608 }; // the clip window (16:9)
const n = (v) => Number(v) || 0;
const toMs = (v) => {
  if (!v) return 0;
  const s = String(v);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z") || 0;
};
const scry = (id) => (id ? `https://api.scryfall.com/cards/${id}?format=image&version=normal` : "");
const up = (s) => (s || "").toUpperCase();

async function loadDay() {
  const seasons = await base44.entities.Season.filter({ status: "active" });
  const season = seasons && seasons[0];
  if (!season) return null;
  const [cards, runs, logs, evs, ranks] = await Promise.all([
    base44.entities.Card.filter({ season_id: season.id }),
    base44.entities.Run.filter({ season_id: season.id }),
    loadDayLogs(season.id),
    base44.entities.DecayEvent.filter({ season_id: season.id }, "-updated_date", 1).catch(() => []),
    base44.entities.ArenaRank ? base44.entities.ArenaRank.list("-created_date", 1).catch(() => []) : [],
  ]);
  const today = ukDate();
  const todayLog = [...logs].filter((l) => l.date === today && l.result !== "missed")
    .sort((a, b) => toMs(b.created_date) - toMs(a.created_date))[0] || null;
  const run = [...runs].sort((a, b) => n(b.attempt_number) - n(a.attempt_number))[0] || null;
  const ev = evs && evs[0] && ukDate(evs[0].updated_at || evs[0].created_date) === today ? evs[0] : null;
  const block = blockState(season);
  const byName = (name) => cards.find((c) => up(c.name) === up(name));
  const rotted = cards.reduce((s, c) => (n(c.original_copies) > 0 ? s + Math.max(0, n(c.original_copies) - n(c.copies)) : s), 0);
  const pardonedToday = season.pardoned_at && ukDate(season.pardoned_at) === today;
  const wins = todayLog ? n(todayLog.wins) : n(run?.round_wins);
  const losses = todayLog ? n(todayLog.losses) : n(run?.round_losses);
  return {
    season, block, ev, todayLog, wins, losses, rotted,
    pardonedToday, pardonedName: season.last_pardoned,
    runWins: n(run?.total_wins),
    day: n(todayLog?.day) || n(logs.length) + 1,
    rank: ranks && ranks[0],
    cardImg: (name) => scry(byName(name)?.scryfall_id),
  };
}

// The hook: the most dramatic true thing about today.
function hookFor(d) {
  const b = d.block;
  if (d.todayLog?.result === "died" || d.ev?.step === "death" || d.ev?.step === "verified") {
    const name = d.ev?.card_removed || "THE CARD";
    return { tone: "rot", hook: "IT ROTTED.", sub: `${up(name)} IS GONE FOREVER`,
      card: d.ev?.card_removed_image || d.cardImg(name), label: "ROTTED", detail: d.ev?.replacement_card ? `REPLACED BY ${up(d.ev.replacement_card)}` : "" };
  }
  if (d.pardonedToday && d.pardonedName) {
    return { tone: "gold", hook: "IT WALKS FREE.", sub: `${up(d.pardonedName)} SURVIVED THE EXECUTIONER`,
      card: d.cardImg(d.pardonedName), label: "PARDONED", detail: "THE EXECUTIONER WILL REMEMBER" };
  }
  if (!b) return { tone: "gold", hook: "THE WHEEL AWAITS.", sub: "WHICH CARD WILL BE CONDEMNED?", card: "", label: "", detail: "" };
  const lastDay = b.day >= b.sentence;
  const base = { card: d.cardImg(b.name), label: `ON THE BLOCK · DAY ${b.day} OF ${b.sentence}`, detail: b.title || "" };
  if (d.todayLog?.result === "survived") {
    if (d.wins >= 7 && d.losses === 0) return { ...base, tone: "gold", hook: "FLAWLESS.", sub: `7–0 · ${up(b.name)} LIVES ANOTHER DAY` };
    return { ...base, tone: "gold", hook: "SURVIVED.", sub: lastDay ? `${up(b.name)} IS ONE DAY FROM FREEDOM` : `${up(b.name)} LIVES ANOTHER DAY` };
  }
  if (d.losses >= 1) return { ...base, tone: "rot", hook: "ONE LOSS FROM DEATH.", sub: `LOSE AGAIN AND ${up(b.name)} ROTS` };
  return { ...base, tone: lastDay ? "gold" : "rot", hook: lastDay ? "ONE DAY FROM FREEDOM." : `${up(b.name)} IS ON THE BLOCK.`,
    sub: "LOSE TWICE TODAY AND IT ROTS" };
}

export default function OverlayShortFrame() {
  const [d, setD] = useState(null);
  const q = new URLSearchParams(window.location.search);
  const clear = q.get("window") === "clear";

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    loadDay().then(setD).catch(() => setD(null));
  }, []);

  const h = d ? hookFor(d) : { tone: "gold", hook: "IRONDECK", sub: "CAN A ROTTING DECK REACH MYTHIC?", card: "", label: "", detail: "" };
  const hook = q.get("hook") || h.hook;
  const sub = q.get("sub") || h.sub;
  const rot = h.tone === "rot";
  const glow = rot ? "rgba(150,80,255,.85)" : "rgba(255,180,70,.85)";
  const hookSize = hook.length > 22 ? 82 : hook.length > 11 ? 100 : 128;

  return (
    <div style={{ position: "relative", width: 1080, height: 1920, overflow: "hidden",
      background: "radial-gradient(circle at 50% 30%, #2a1450, #0d0816 70%)", fontFamily: "'Barlow Condensed', sans-serif", textAlign: "center" }}>
      <style>{`
        @keyframes sfSlam { 0% { opacity: 0; transform: scale(1.6) } 60% { opacity: 1; transform: scale(.96) } 100% { transform: scale(1) } }
        @keyframes sfGlow { 0%,100% { box-shadow: 0 0 30px 6px ${glow} } 50% { box-shadow: 0 0 60px 16px ${glow} } }
      `}</style>

      {/* Hook */}
      <div style={{ position: "absolute", left: 40, right: 40, top: 30, height: WIN.y - 50, display: "flex", flexDirection: "column",
        justifyContent: "center", animation: "sfSlam .7s ease-out both" }}>
        <div style={{ ...(rot ? purpleText(hookSize) : goldText(hookSize)), lineHeight: 1, letterSpacing: 2 }}>{hook}</div>
        <div style={{ ...steelText(42), marginTop: 14, lineHeight: 1.1 }}>{sub}</div>
      </div>

      {/* Clip window: green for CapCut chroma key (or transparent with ?window=clear) */}
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y - 6, width: WIN.w, height: 6, background: rot ? "#9b5cff" : "#FFCF7A" }} />
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y + WIN.h, width: WIN.w, height: 6, background: rot ? "#9b5cff" : "#FFCF7A" }} />
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, background: clear ? "transparent" : "#00FF00" }} />

      {/* The stakes: the card, what's happening to it, today's score */}
      {/* The pull to the full video, right under the clip (YouTube's buttons can't cover it here) */}
      <div style={{ position: "absolute", left: 0, right: 0, top: WIN.y + WIN.h + 22, ...goldText(46), letterSpacing: 3, whiteSpace: "nowrap" }}>
        FULL EPISODE ON THE CHANNEL ▸
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, top: WIN.y + WIN.h + 100, display: "flex", gap: 44, alignItems: "center" }}>
        <div style={{ width: 300, height: 418, borderRadius: 16, overflow: "hidden", flex: "none", background: "#120a20",
          animation: "sfGlow 2.4s ease-in-out infinite", filter: rot && h.label === "ROTTED" ? "grayscale(.5) brightness(.75) hue-rotate(220deg)" : "none" }}>
          {h.card && <img src={h.card} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />}
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          {h.label && <div style={{ ...(rot ? purpleText(46) : goldText(46)), lineHeight: 1.05 }}>{h.label}</div>}
          {h.detail && <div style={{ ...steelText(34), marginTop: 10, lineHeight: 1.1 }}>{h.detail}</div>}
          {d?.block && h.label.startsWith("ON THE BLOCK") && (
            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              {Array.from({ length: d.block.sentence }).map((_, i) => (
                <div key={i} style={{ width: 70, height: 20, borderRadius: 10, border: "3px solid #c9a8ff", background: i < d.block.day - 1 ? "#c9a8ff" : "transparent" }} />
              ))}
            </div>
          )}
          {/* Today's round: 7 win pips, 2 loss pips */}
          <div style={{ ...steelText(30), marginTop: 30 }}>TODAY</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={"w" + i} style={{ width: 38, height: 38, borderRadius: 19, border: "3px solid #FFCF7A",
                background: i < (d?.wins || 0) ? "#FFCF7A" : "transparent" }} />
            ))}
            <div style={{ width: 14 }} />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={"l" + i} style={{ width: 38, height: 38, borderRadius: 8, border: "3px solid #9b5cff",
                background: i < (d?.losses || 0) ? "#9b5cff" : "transparent" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Season line + the pull to the full video */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1545, ...steelText(32), letterSpacing: 2, whiteSpace: "nowrap" }}>
        {d ? `SEASON ${d.season.season_number} · DAY ${d.day} · ${d.runWins} RUN WINS · ${d.rotted} ROTTED` : ""}
      </div>

      {/* Bottom 330px is covered by YouTube's title and buttons: keep it to the logo only */}
      <img src={SHIELD} alt="" style={{ position: "absolute", left: 540 - 60, top: 1640, height: 140, width: "auto", maxWidth: "none", opacity: 0.35 }} />
    </div>
  );
}