import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs } from "@/lib/roundDay";
import { blockState } from "@/lib/condemned";
import { ukDate } from "@/lib/ukDay";
import { goldText, steelText, purpleText } from "@/lib/overlayText";
import { liveReload } from "@/lib/liveReload";
import Sentencing from "@/components/overlay/Sentencing";
import { SurviveCelebration } from "@/pages/Overlay";

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
const FRAME_BG = "radial-gradient(circle at 50% 30%, #2a1450, #0d0816 70%)";
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

// Arena rank emblems: the same sheet as the HUD (4 columns: Tier 4 → 1 · 6 rows: Bronze → Mythic)
const RANK_SPRITE = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/78b084191_rank-emblems.png";
const RANK_ROWS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];

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
  // The current run, as on the HUD: the one in progress, else the latest attempt.
  const run = runs.find((r) => r.result === "in_progress") ||
    [...runs].sort((a, b) => n(b.attempt_number) - n(a.attempt_number))[0] || null;
  const ev = evs && evs[0] && ukDate(evs[0].updated_at || evs[0].created_date) === today ? evs[0] : null;
  const block = blockState(season);
  const byName = (name) => cards.find((c) => up(c.name) === up(name));
  const rotted = cards.reduce((s, c) => (n(c.original_copies) > 0 ? s + Math.max(0, n(c.original_copies) - n(c.copies)) : s), 0);
  const pardonedToday = season.pardoned_at && ukDate(season.pardoned_at) === today;
  // Always the current round's results (they reset to 0-0 when Start Round is pressed),
  // not an earlier finished round from today's day log.
  const wins = n(run?.round_wins);
  const losses = n(run?.round_losses);
  return {
    season, cards, block, ev, todayLog, wins, losses, rotted,
    roundKey: `${run?.id || ""}|${run?.round_started_at || ""}`, // changes when a new round starts
    pardonedToday, pardonedName: season.last_pardoned,
    runWins: n(run?.total_wins),
      runStatus: run?.round_status || "", runUpdated: run?.updated_date || "",
      day: n(todayLog?.day) || n(logs.length) + 1,
      total: (n(todayLog?.day) || n(logs.length) + 1) + n(logs.priorDays), // challenge day
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
  if (!b) return { tone: "gold", hooks: [{ hook: "THE DECK AWAITS.", sub: "WHICH CARD IS NEXT?" }, always], label: "", detail: "", show: false };
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
  if (b.day >= 2) hooks.push({ hook: `${up(b.name)}.`, sub: "STILL ON THE CHOPPING BLOCK" });
  else hooks.push({ hook: "THE SHUFFLE HAS CHOSEN.", sub: `${up(b.name)} IS ON THE BLOCK` });
  hooks.push(always);
  return { tone, hooks, label, detail, show, image: show ? d.cardImg(b.name) : "" };
}

export default function OverlayShortFrame() {
  const [d, setD] = useState(null);
  const [locked, setLocked] = useState(null); // the hook, fixed at the first load
  const q = new URLSearchParams(window.location.search);
  const clear = q.get("window") === "clear";
  const [shuffle, setShuffle] = useState(q.get("shuffle") === "now" ? Date.now() : 0); // when the shuffle started
  const [survive, setSurvive] = useState(q.get("survive") === "now"); // the vertical SURVIVED screen

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    let active = true;
    const load = async () => {
      const day = await loadDay();
      if (!active || !day) return;
      setD(day);
      // Hooks stay fixed for the whole round (so they never give away the result), and are
      // picked fresh when a new round starts.
      setLocked((h) => (h && h.key === day.roundKey ? h : { ...hookFor(day), key: day.roundKey }));
    };
    const stop = liveReload(["Run", "DayLog", "Season", "DecayEvent", "ArenaRank"], load);
    return () => { active = false; stop(); };
  }, []);

  
  // The 7th win: SURVIVED plays if the win has only just happened (not when OBS reloads later),
  // and holds until the next round starts.
  const celebrated = useRef("");
  useEffect(() => {
    if (!d) return;
    if (d.runStatus !== "survived") { if (q.get("survive") !== "now") setSurvive(false); return; }
    if (celebrated.current === d.roundKey) return;
    celebrated.current = d.roundKey;
    if (Date.now() - toMs(d.runUpdated) < 60000) setSurvive(true);
  }, [d]);

  // The landscape intro tells us when its shuffle starts, so it plays here at the same time.
  useEffect(() => {
    const play = (m) => { if (m && m.type === "sentencing" && Date.now() - m.at < 15000) setShuffle(m.at); };
    let ch = null;
    try { ch = new BroadcastChannel("irondeck"); ch.onmessage = (e) => play(e.data); } catch { /* not supported */ }
    const onStore = (e) => { if (e.key === "irondeck-sentencing" && e.newValue) { try { play(JSON.parse(e.newValue)); } catch { /* bad value */ } } };
    window.addEventListener("storage", onStore);
    return () => { try { ch?.close(); } catch { /* closed */ } window.removeEventListener("storage", onStore); };
  }, []);

  const h = locked || { tone: "gold", hooks: [{ hook: "IRONDECK", sub: "CAN A ROTTING DECK REACH MYTHIC?" }], label: "", detail: "", show: false };
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTurn((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);
  // On the 7th win the frame shows the result: the hook, and the card facing front with its fate.
  const free = survive && d?.pardonedToday && !d?.block;
  const cardName = d?.block?.name || (free ? d.pardonedName : "");
  const cur = survive
    ? { hook: "DAY SURVIVED.", sub: `${d?.wins || 0}–${d?.losses || 0} · THE DECK LIVES ANOTHER DAY` }
    : h.hooks[turn % h.hooks.length];
  const label = survive ? (cardName ? (free ? "WALKS FREE" : "SURVIVES ANOTHER DAY") : "") : h.label;
  const detail = survive ? up(cardName) : h.detail;
  const hook = q.get("hook") || cur.hook;
  const sub = q.get("sub") || cur.sub;
  const rot = !survive && h.tone === "rot";
  const glow = rot ? "rgba(150,80,255,.85)" : "rgba(255,180,70,.85)";
  const hookSize = hook.length > 22 ? 82 : hook.length > 11 ? 100 : 128;

  return (
    <div style={{ position: "relative", width: 1080, height: 1920, overflow: "hidden",
      background: clear ? "transparent" : FRAME_BG, fontFamily: "'Barlow Condensed', sans-serif", textAlign: "center" }}>
      <style>{`
        @keyframes sfSlam { 0% { opacity: 0; transform: scale(1.6) } 60% { opacity: 1; transform: scale(.96) } 100% { transform: scale(1) } }
        @keyframes sfSpin { from { transform: rotateY(0deg) } to { transform: rotateY(360deg) } }
        @keyframes sfGlow { 0%,100% { box-shadow: 0 0 30px 6px ${glow} } 50% { box-shadow: 0 0 60px 16px ${glow} } }
      `}</style>

      {/* ?window=clear: the background is drawn above and below the window only, so the game shows through */}
      {clear && [[0, WIN.y], [WIN.y + WIN.h, 1920 - WIN.y - WIN.h]].map(([top, h]) => (
        <div key={top} style={{ position: "absolute", left: 0, top, width: 1080, height: h,
          background: FRAME_BG, backgroundSize: "1080px 1920px", backgroundPosition: `0 ${-top}px` }} />
      ))}

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
          <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", animation: survive ? "none" : "sfSpin 6s linear infinite" }}>
            {[0, 180].map((deg) => {
              const img = cardName ? d.cardImg(cardName) : "";
              const front = deg === 0 && img;
              return (
                <div key={deg} style={{ position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", backfaceVisibility: "hidden",
                  transform: "rotateY(" + deg + "deg)", animation: "sfGlow 2.4s ease-in-out infinite",
                  background: front ? "#120a20" : "repeating-linear-gradient(45deg, #1a0d2e 0 14px, #140a24 14px 28px)",
                  border: front ? "none" : "4px solid " + (rot ? "#9b5cff" : "#FFCF7A"), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {front
                    ? <img src={img} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block",
                        filter: slotRot ? "grayscale(.9) brightness(.5) sepia(.4) hue-rotate(215deg) saturate(2.2)" : "none", transition: "filter 4s ease" }} />
                    : <div style={{ ...(rot ? purpleText(220) : goldText(220)), lineHeight: 1 }}>?</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          {label && <div style={{ ...(rot ? purpleText(46) : goldText(46)), lineHeight: 1.05 }}>{label}</div>}
          {detail && <div style={{ ...steelText(34), marginTop: 10, lineHeight: 1.1 }}>{detail}</div>}
          {d?.block && label && (
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
        {d?.rank && <RankRow rank={d.rank} />}
        </div>
      </div>

      {/* Season line + the pull to the full video */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1545, ...steelText(32), letterSpacing: 2, whiteSpace: "nowrap" }}>
          {d ? `S${d.season.season_number} · DAY ${d.day} · CHALLENGE DAY ${d.total} · ${d.rotted} ROTTED` : ""}
      </div>

      {/* Bottom 330px is covered by YouTube's title and buttons: keep it to the logo only */}
      <img src={SHIELD} alt="" style={{ position: "absolute", left: 540 - 60, top: 1640, height: 140, width: "auto", maxWidth: "none", opacity: 0.35 }} />
    
      {/* The shuffle, in time with the landscape intro (or ?shuffle=now to test) */}
      {shuffle > 0 && d && (
        <Sentencing key={shuffle} season={d.season} cards={d.cards} active vertical onDone={() => setShuffle(0)} />
      )}
      
      {/* The 7th win: SURVIVED plays inside the game window; the frame around it updates (or ?survive=now to test) */}
      {survive && d && (
        <SurviveCelebration box={{ left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h }} emblemW="55%" />
      )}

      {/* The second loss: the execution plays inside the game window (or ?demo=death to test) */}
      {death && d && <VerticalExecution ev={ev} tA={tA} />}
    </div>
  );
}


// The current Arena rank, compact: emblem, rank + tier, and the 6 step pips
function RankRow({ rank }) {
  const cls = rank.rank_class || "";
  const row = RANK_ROWS.indexOf(cls);
  const mythic = cls === "Mythic";
  const tier = Math.min(4, Math.max(1, n(rank.tier) || 4));
  const steps = Math.max(0, Math.min(6, n(rank.step)));
  const S = 84;
  const sub = mythic
    ? (rank.leaderboard_place ? `#${rank.leaderboard_place}` : rank.percentile ? `${Math.round(n(rank.percentile))}%` : "")
    : `TIER ${tier}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
      {row >= 0 && (
        <div style={{ width: S, height: S, flex: "none", backgroundImage: `url(${RANK_SPRITE})`, backgroundSize: `${S * 4}px ${S * 6}px`,
          backgroundPosition: `${-(mythic ? 0 : 4 - tier) * S}px ${-row * S}px`, backgroundRepeat: "no-repeat",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,.8))" }} />
      )}
      <div>
        <div style={{ ...goldText(40), lineHeight: 1 }}>{up(cls) || "—"}{sub ? ` · ${sub}` : ""}</div>
        {!mythic && (
          <div style={{ display: "flex", gap: 9, marginTop: 12, paddingLeft: 4 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ width: 16, height: 16, transform: "rotate(45deg)", borderRadius: 3, border: "2px solid #120d08",
                background: i < steps ? "linear-gradient(135deg,#FFF0CD,#D68C3C)" : "rgba(60,64,72,0.9)",
                boxShadow: i < steps ? "0 0 8px rgba(255,170,60,.8)" : "none" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

// ---------- The vertical execution (plays inside the game window) ----------
// Timed from the moment the axe lifts, exactly like the sidebar's chopping block, so the
// card is cut, rots, and the scavenged card lands at the same moment as in the landscape.
const DEATH_RUN_IMG = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/aed9fb1b2_irondeck-deathrun-emblem.webp";
const ROT_BG = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/bddf3495c_irondeck-corrupted-background.webp";
const ROT_LEAD_MS = 6500; // must match OverlayDeck / OverlayDeath: the axe lifts 6.5s after the second loss
const T_IMPACT = 3650; // the axe hits
const T_STAMP = 6200; // ROTTED stamps in
const T_SCAV = 11000; // the rotted card is gone; something crawls out
const T_RAR = 11600; // rarity roll
const T_RND = 14200; // randomiser
const VX_RAR_GAPS = [90, 90, 90, 100, 110, 130, 160, 200, 250, 320, 420];
const VX_RND_GAPS = [70, 70, 70, 75, 80, 90, 100, 115, 135, 160, 190, 230, 280, 340];
const vxTimes = (start, gaps) => { let t = start; return [start, ...gaps.map((g) => (t += g))]; };
const RAR_T = vxTimes(T_RAR, VX_RAR_GAPS);
const RND_T = vxTimes(T_RND, VX_RND_GAPS);
const T_LAND = RND_T[RND_T.length - 1]; // the scavenged card lands
const VX_W = 316;
const VX_H = 440;
const CUT_TOP = "polygon(0 0, 100% 0, 100% 36%, 0 64%)";
const CUT_BOTTOM = "polygon(0 64%, 100% 36%, 100% 100%, 0 100%)";
const RARITY = { common: { label: "COMMON", color: "#d9dde3" }, uncommon: { label: "UNCOMMON", color: "#9fd3ee" } };
if (typeof Image !== "undefined") { new Image().src = DEATH_RUN_IMG; new Image().src = ROT_BG; }

function VerticalExecution({ ev, tA }) {
  const waiting = !ev || tA < 0; // DEATH RUN while the axe hasn't lifted yet
  const struck = tA >= T_IMPACT;
  const stage = !waiting && tA < T_SCAV; // the condemned card
  const crawl = !waiting && tA >= T_SCAV;
  const landed = tA >= T_LAND;
  const count = (ts) => ts.filter((t) => tA >= t).length;
  const rarIdx = count(RAR_T);
  const finalRar = RARITY[ev?.rarity_roll] || RARITY.common;
  const rar = rarIdx >= RAR_T.length ? finalRar : rarIdx % 2 ? RARITY.uncommon : RARITY.common;
  const rolls = (ev?.roll_cards || []).map((c) => c.image_url).filter(Boolean);
  const rndIdx = count(RND_T);
  const face = landed ? ev?.replacement_card_image : rndIdx > 0 && rolls.length ? rolls[(rndIdx - 1) % rolls.length] : "";
  const img = ev?.card_removed_image || "";
  const half = (clip, out) => (
    <div style={{ position: "absolute", inset: 0, clipPath: clip, borderRadius: 16, overflow: "hidden",
      transform: struck ? out : "none", transition: "transform .5s cubic-bezier(.2,.8,.3,1)" }}>
      {img && <img src={img} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block",
        filter: struck ? "grayscale(.9) brightness(.5) sepia(.4) hue-rotate(215deg) saturate(2.2)" : "none", transition: "filter 4s ease" }} />}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, rgba(120,40,220,.75), rgba(40,10,70,.6) 70%)",
        clipPath: struck ? "circle(80% at 50% 50%)" : "circle(0% at 50% 50%)", transition: "clip-path 5s ease-out", mixBlendMode: "multiply" }} />
    </div>
  );
  return (
    <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, zIndex: 50, overflow: "hidden", pointerEvents: "none",
      background: `#08040f url(${ROT_BG}) center / cover`, animation: "vxIn .6s ease both" }}>
      <style>{`
        @keyframes vxIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes vxGrow { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.2) } 70% { opacity: 1; transform: translate(-50%,-50%) scale(1.05) } 100% { opacity: 1; transform: translate(-50%,-50%) scale(1) } }
        @keyframes vxRise { from { opacity: 0; transform: translateY(60px) scale(.9) } to { opacity: 1; transform: none } }
        @keyframes vxGlow { 0%,100% { box-shadow: 0 0 30px 6px rgba(150,80,255,.6) } 50% { box-shadow: 0 0 60px 16px rgba(170,100,255,.95) } }
        @keyframes vxSlash { 0% { opacity: 0; transform: translate(-50%,-50%) rotate(-28deg) scaleX(.1) } 30% { opacity: 1; transform: translate(-50%,-50%) rotate(-28deg) scaleX(1) } 100% { opacity: 0; transform: translate(-50%,-50%) rotate(-28deg) scaleX(1.1) } }
        @keyframes vxShake { 0%,100% { transform: translate(0,0) } 15% { transform: translate(-14px,8px) } 35% { transform: translate(12px,-8px) } 55% { transform: translate(-7px,4px) } 75% { transform: translate(4px,-2px) } }
        @keyframes vxStamp { 0% { opacity: 0; transform: translate(-50%,-50%) scale(2.4) rotate(-8deg) } 65% { opacity: 1; transform: translate(-50%,-50%) scale(.95) rotate(-8deg) } 100% { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(-8deg) } }
        @keyframes vxBurst { 0% { opacity: 0; transform: scale(.6) } 15% { opacity: 1 } 100% { opacity: 0; transform: scale(1.9) } }
        @keyframes vxLand { 0% { transform: scale(1) } 35% { transform: scale(1.12) } 100% { transform: scale(1) } }
        @keyframes vxGold { 0%,100% { box-shadow: 0 0 30px 6px rgba(255,180,70,.6) } 50% { box-shadow: 0 0 60px 16px rgba(255,190,90,.95) } }
      `}</style>

      {/* DEATH RUN grows in while the axe waits */}
      <div style={{ position: "absolute", inset: 0, opacity: waiting ? 1 : 0, transition: "opacity .6s ease" }}>
        <img src={DEATH_RUN_IMG} alt="" style={{ position: "absolute", left: "50%", top: "50%", width: "62%", maxWidth: "none",
          animation: "vxGrow 1s cubic-bezier(.2,.8,.3,1) .3s both", filter: "drop-shadow(0 0 30px rgba(150,80,255,.9))" }} />
      </div>

      {/* The condemned card: the axe cuts it in two, then the rot takes it */}
      {stage && (
        <div style={{ position: "absolute", left: (WIN.w - VX_W) / 2, top: (WIN.h - VX_H) / 2, width: VX_W, height: VX_H,
          opacity: tA > T_SCAV - 700 ? 0 : 1, transition: "opacity .7s ease", animation: "vxRise .7s cubic-bezier(.2,.8,.3,1) both" }}>
          <div key={struck ? "hit" : "wait"} style={{ position: "absolute", inset: 0, borderRadius: 16,
            animation: struck ? "vxShake .5s linear both" : "vxGlow 2.4s ease-in-out infinite" }}>
            {half(CUT_TOP, "translate(18px, -16px) rotate(3deg)")}
            {half(CUT_BOTTOM, "translate(-10px, 10px) rotate(-2deg)")}
          </div>
        </div>
      )}
      {stage && struck && tA < T_IMPACT + 700 && (
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 900, height: 18, borderRadius: 9,
          background: "linear-gradient(90deg, transparent, #fff 30%, #e4d2ff 60%, transparent)", boxShadow: "0 0 30px 10px rgba(190,140,255,.9)",
          animation: "vxSlash .5s ease-out both" }} />
      )}
      {stage && tA >= T_STAMP && (
        <div style={{ position: "absolute", left: "50%", top: "50%", whiteSpace: "nowrap", ...purpleText(150), letterSpacing: 8,
          animation: "vxStamp .45s cubic-bezier(.55,0,.9,.4) both", filter: "drop-shadow(0 6px 0 #000)" }}>ROTTED</div>
      )}

      {/* Something crawls out: the rarity roll, then the randomiser lands on the scavenged card */}
      {crawl && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 22, whiteSpace: "nowrap", animation: "vxIn .6s ease both",
            ...(landed ? goldText(52) : purpleText(52)), letterSpacing: 4 }}>
            {landed ? "SCAVENGED · JOINS THE DECK" : "SOMETHING CRAWLS OUT…"}
          </div>
          <div style={{ position: "absolute", left: (WIN.w - VX_W * 0.86) / 2, top: 92, width: VX_W * 0.86, height: VX_H * 0.86 }}>
            {landed && (
              <div style={{ position: "absolute", inset: -80, borderRadius: "50%", mixBlendMode: "screen", pointerEvents: "none",
                background: "radial-gradient(closest-side, rgba(255,235,190,.95), rgba(255,170,60,.5) 45%, transparent 75%)", animation: "vxBurst .9s ease-out both" }} />
            )}
            <div style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden", border: face ? "none" : "4px solid #9b5cff",
              background: "radial-gradient(circle at 50% 45%, #4a2380, #160a2a 72%)", display: "flex", alignItems: "center", justifyContent: "center",
              animation: landed ? "vxLand .5s ease-out both, vxGold 2.4s ease-in-out .5s infinite" : "vxGlow 2.4s ease-in-out infinite" }}>
              {face
                ? <img src={face} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />
                : <div style={{ ...purpleText(170), lineHeight: 1 }}>?</div>}
            </div>
          </div>
          {!landed && rarIdx > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, fontSize: 50, fontWeight: 800, letterSpacing: 8,
              color: rar.color, textShadow: "0 3px 0 #000, 0 0 18px rgba(0,0,0,.9)" }}>{rar.label}</div>
          )}
          {landed && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, whiteSpace: "nowrap", ...goldText(50), animation: "vxIn .5s ease both" }}>
              {up(ev?.replacement_card || "")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
}