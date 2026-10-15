import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs } from "@/lib/roundDay";
import { blockState } from "@/lib/condemned";
import { ukDate } from "@/lib/ukDay";
import { goldText, steelText, purpleText } from "@/lib/overlayText";
import { liveReload } from "@/lib/liveReload";

// Shorts frame (1080×1920): a spoiler-free hook at the top, the game window, the stakes below.
// Built for a vertical recording canvas (Aitum Vertical): put the Arena capture in the window.
// The hook is fixed when the page loads (round start) and never reveals the result or the card;
// only the win/loss pips update live.
// Open /overlay/short in an OBS browser source sized 1080×1920, then right-click the
// source → "Screenshot (Source)" to save a full-size PNG for CapCut.
// The clip window is pure green (#00FF00): in CapCut put the frame ABOVE your clip and
// use Chroma key on it. Options: ?window=clear (transparent window instead of green),
// ?hook=YOUR TEXT&sub=YOUR TEXT (override the automatic hook).

const SHIELD = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
const WIN = { x: 0, y: 390, w: 1080, h: 608 }; // the clip window (16:9)
// The HUD's own win medallions (numbered 1-7) and loss icons.
const DPRE = "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const WON = ["d00d35fc6", "4a1fe34b6", "894562e97", "8e4c0cdf4", "f6c98f779", "c22df9ff5", "6b3cea327", "2aa7c4fa9"].map((h, i) => `${DPRE}${h}_win-won-${i}.png`);
const FUTURE = ["ae065396e", "72347b8a9", "866337c2f", "0c3e97da6", "32d047d90", "881388982", "be6471094", "d034996f4"].map((h, i) => `${DPRE}${h}_win-future-${i}.png`);
const LOSS_EMPTY = `${DPRE}43bd79795_loss-empty.png`;
const LOSS_1 = `${DPRE}04f5808d9_loss-1.png`;
const LOSS_2 = `${DPRE}0901a13ba_loss-2.png`;
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

// The hooks: the stakes, never the outcome. They take turns at the top (4s each).
// Day 1 of a sentence the card stays hidden (the wheel reveals it in that episode);
// day 2+ it was revealed in an earlier episode, so it spins: real art <-> card back.
function hookFor(d) {
  const b = d.block;
  const always = { hook: "EVERY LOSS COSTS A CARD.", sub: "CAN THIS DECK STILL REACH MYTHIC?" };
  if (!b) return { tone: "gold", hooks: [{ hook: "THE WHEEL AWAITS.", sub: "WHICH CARD IS NEXT?" }, always], label: "", detail: "", show: false };
  const label = `CONDEMNED · DAY ${b.day} OF ${b.sentence}`;
  const lowered = b.pool && b.pool !== "rare";
  const detail = lowered ? "NO RARES LEFT · THE UNCOMMONS STAND TRIAL" : "LOSE TWICE TODAY AND IT ROTS";
  const show = b.day >= 2;
  const hooks = [];
  let tone = "rot";
  if (b.capture >= 3) hooks.push({ hook: "THE EXECUTIONER'S VENDETTA.", sub: "ONE DAY · NO MISTAKES" });
  else if (b.capture === 2 && b.day === 1) hooks.push({ hook: "THE EXECUTIONER REMEMBERS.", sub: `CAUGHT AGAIN · ${b.sentence} DAYS TO SURVIVE` });
  if (b.day >= b.sentence) { tone = "gold"; hooks.push({ hook: "ONE DAY FROM FREEDOM.", sub: "SURVIVE TODAY AND IT WALKS FREE" }); }
  else hooks.push({ hook: "LOSE TWICE AND IT ROTS.", sub: `DAY ${b.day} OF ${b.sentence} ON THE CHOPPING BLOCK` });
  if (show) hooks.push({ hook: `${up(b.name)}.`, sub: "STILL ON THE CHOPPING BLOCK" });
  else hooks.push({ hook: "THE WHEEL HAS CHOSEN.", sub: "BUT WHICH CARD?" });
  hooks.push(always);
  return { tone, hooks, label, detail, show, image: show ? d.cardImg(b.name) : "" };
}

export default function OverlayShortFrame() {
  const [d, setD] = useState(null);
  const [locked, setLocked] = useState(null); // the hook, fixed at the first load
  const q = new URLSearchParams(window.location.search);
  const clear = q.get("window") === "clear";

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    let active = true;
    const load = async () => {
      const day = await loadDay();
      if (!active || !day) return;
      setD(day);
      setLocked((h) => h || hookFor(day));
    };
    const stop = liveReload(["Run", "DayLog"], load);
    return () => { active = false; stop(); };
  }, []);

  const h = locked || { tone: "gold", hooks: [{ hook: "IRONDECK", sub: "CAN A ROTTING DECK REACH MYTHIC?" }], label: "", detail: "", show: false };
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTurn((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);
  const cur = h.hooks[turn % h.hooks.length];
  const hook = q.get("hook") || cur.hook;
  const sub = q.get("sub") || cur.sub;
  const rot = h.tone === "rot";
  const glow = rot ? "rgba(150,80,255,.85)" : "rgba(255,180,70,.85)";
  const hookSize = hook.length > 22 ? 82 : hook.length > 11 ? 100 : 128;

  return (
    <div style={{ position: "relative", width: 1080, height: 1920, overflow: "hidden",
      background: "radial-gradient(circle at 50% 30%, #2a1450, #0d0816 70%)", fontFamily: "'Barlow Condensed', sans-serif", textAlign: "center" }}>
      <style>{`
        @keyframes sfSlam { 0% { opacity: 0; transform: scale(1.6) } 60% { opacity: 1; transform: scale(.96) } 100% { transform: scale(1) } }
        @keyframes sfSpin { from { transform: rotateY(0deg) } to { transform: rotateY(360deg) } }
        @keyframes sfGlow { 0%,100% { box-shadow: 0 0 30px 6px ${glow} } 50% { box-shadow: 0 0 60px 16px ${glow} } }
      `}</style>

      {/* Hook */}
      <div key={hook} style={{ position: "absolute", left: 40, right: 40, top: 30, height: WIN.y - 50, display: "flex", flexDirection: "column",
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
        {/* The condemned card spins: day 1 a card back both sides ("?"), day 2+ the real art on the front */}
        <div style={{ width: 300, height: 418, flex: "none", perspective: 1200 }}>
          <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", animation: "sfSpin 6s linear infinite" }}>
            {[0, 180].map((deg) => {
              const front = deg === 0 && h.show && h.image;
              return (
                <div key={deg} style={{ position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", backfaceVisibility: "hidden",
                  transform: "rotateY(" + deg + "deg)", animation: "sfGlow 2.4s ease-in-out infinite",
                  background: front ? "#120a20" : "repeating-linear-gradient(45deg, #1a0d2e 0 14px, #140a24 14px 28px)",
                  border: front ? "none" : "4px solid " + (rot ? "#9b5cff" : "#FFCF7A"), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {front
                    ? <img src={h.image} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />
                    : <div style={{ ...(rot ? purpleText(220) : goldText(220)), lineHeight: 1 }}>?</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          {h.label && <div style={{ ...(rot ? purpleText(46) : goldText(46)), lineHeight: 1.05 }}>{h.label}</div>}
          {h.detail && <div style={{ ...steelText(34), marginTop: 10, lineHeight: 1.1 }}>{h.detail}</div>}
          {d?.block && h.label && (
            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              {Array.from({ length: d.block.sentence }).map((_, i) => (
                <div key={i} style={{ width: 70, height: 20, borderRadius: 10, border: "3px solid #c9a8ff", background: i < d.block.day - 1 ? "#c9a8ff" : "transparent" }} />
              ))}
            </div>
          )}
          {/* Today's round: 7 win pips, 2 loss pips */}
          <div style={{ ...steelText(30), marginTop: 30 }}>TODAY</div>
          <div style={{ display: "flex", gap: 2, marginTop: 8, alignItems: "center" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((slot) => (
              <img key={"w" + slot} src={(slot <= (d?.wins || 0) ? WON : FUTURE)[slot]} alt=""
                style={{ width: 62, height: 62, maxWidth: "none", display: "block" }} />
            ))}
            <div style={{ width: 12 }} />
            {[1, 2].map((n) => (
              <img key={"l" + n} src={(d?.losses || 0) >= n ? (n === 1 ? LOSS_1 : LOSS_2) : LOSS_EMPTY} alt=""
                style={{ width: 54, height: 54, maxWidth: "none", display: "block" }} />
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