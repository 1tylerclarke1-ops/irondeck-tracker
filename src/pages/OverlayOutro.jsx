import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs } from "@/lib/roundDay";
import { goldText, steelText, purpleText } from "@/lib/overlayText";
import { captureTitle, poolFor } from "@/lib/condemned";

// The daily outro (OBS scene "Overlay Outro"): the mirror of the intro.
// 1. Result stamp   2. What happened to the condemned card   3. The climb
// 4. Tomorrow's stakes   5. Thanks + end card (shield returns to the centre,
// space for YouTube's end-screen boxes, ownership and Fan Content Policy lines).
// Plays once each time the page loads.

const SHIELD = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
// Same rank emblem sheet as the HUD: 4 columns (tiers 1-4), 6 rows (Bronze..Mythic).
const RANK_SPRITE = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/78b084191_rank-emblems.png";
const RANK_ROWS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
const T = { result: 400, block: 4500, climb: 10500, tomorrow: 14000, end: 17500, mythicEnd: 22000 };
const DAY_MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 365];
const n = (v) => Number(v) || 0;
const toMs = (v) => {
  if (!v) return 0;
  const s = String(v);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z") || 0;
};
const scry = (id) => (id ? `https://api.scryfall.com/cards/${id}?format=image&version=normal` : "");
const OWNERSHIP = "IRONDECK © TYLER DEE CLARKE & TDC GAMING. ALL RIGHTS RESERVED.";
const FAN_CONTENT =
  "IronDeck is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.";

function useStageScale() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const fit = () => setS(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return s;
}

function rankText(r) {
  if (!r) return "—";
  const cls = (r.rank_class || "").toUpperCase();
  if (cls === "MYTHIC") {
    if (r.leaderboard_place) return `MYTHIC #${r.leaderboard_place}`;
    if (r.percentile != null) return `MYTHIC ${r.percentile}%`;
    return "MYTHIC";
  }
  const lvl = r.tier ?? r.level;
  return lvl != null ? `${cls} ${lvl}` : cls || "—";
}

// Work out today's story from the data.
async function loadStory() {
  const seasons = await base44.entities.Season.filter({ status: "active" });
  const season = seasons && seasons[0];
  if (!season) return null;
  const [logs, cards, runs, events, ranks, climbs] = await Promise.all([
    loadDayLogs(season.id),
    base44.entities.Card.filter({ season_id: season.id }),
    base44.entities.Run.filter({ season_id: season.id }),
    base44.entities.DecayEvent.filter({ season_id: season.id }),
    base44.entities.ArenaRank ? base44.entities.ArenaRank.list() : Promise.resolve([]),
    base44.entities.Climb.list().catch(() => []),
  ]);
  // The round just played = the most recently saved log (day numbers can be wrong).
  const sorted = [...logs].sort((a, b) => toMs(b.created_date) - toMs(a.created_date));
  const log = sorted[0];
  if (!log) return null;
  const died = log.result === "died";
  const missed = log.result === "missed";
  const byName = (name) => cards.find((c) => (c.name || "").toLowerCase() === (name || "").toLowerCase());
  const ev = died
    ? [...events].filter((e) => e.run_id === log.run_id)
        .sort((a, b) => toMs(b.updated_at || b.created_date) - toMs(a.updated_at || a.created_date))[0]
    : null;

  let block;
  if (died) {
    block = {
      kind: "rotted",
      name: ev?.card_removed || "",
      image: ev?.card_removed_image || "",
      newName: ev?.replacement_card || "",
      newImage: ev?.replacement_card_image || "",
    };
  } else if (missed) {
    block = { kind: "none" };
  } else if (season.condemned_card) {
    block = {
      kind: "spared",
      title: captureTitle(n(season.block_capture)),
      name: season.condemned_card,
      image: scry(byName(season.condemned_card)?.scryfall_id),
      served: n(season.block_days),
      sentence: n(season.block_sentence) || 3,
    };
  } else if (season.last_pardoned) {
    let pardons = {};
    try { pardons = JSON.parse(season.pardon_counts || "{}") || {}; } catch { pardons = {}; }
    block = { kind: "pardoned", name: season.last_pardoned, image: scry(byName(season.last_pardoned)?.scryfall_id),
      times: n(pardons[season.last_pardoned]) };
  } else {
    block = { kind: "none" };
  }

  const rotted = cards.reduce((s, c) => {
    const o = n(c.original_copies);
    return o > 0 ? s + Math.max(0, o - n(c.copies)) : s;
  }, 0);
  // Milestones from this round (same rules as the intro), shown on the climb screen.
  const runWins = n(log.run_wins_after);
  const bestBefore = sorted.slice(1).filter((l) => l.result !== "missed").reduce((m, l) => Math.max(m, n(l.run_wins_after)), 0);
  const milestones = [];
  if (!missed) {
    if (runWins >= 7 && runWins > bestBefore) milestones.push("NEW BEST RUN");
    if (log.result === "survived" && n(log.wins) >= 7 && n(log.losses) === 0) milestones.push("FLAWLESS DAY 7–0");
    if (DAY_MILESTONES.includes(n(log.day))) milestones.push(`DAY ${n(log.day)}`);
  }
  // Mythic reached (the climb was completed on or after this round's date).
  const climb = [...(climbs || [])].sort((a, b) => n(b.number) - n(a.number))[0];
  const mythic = climb && climb.status === "complete" && (climb.mythic_date || "") >= (log.date || "")
    ? { days: n(climb.days_taken) || n(log.day) } : null;
  const lowered = poolFor(cards).pool !== "rare";
  const rank = [...(ranks || [])].sort((a, b) => toMs(b.captured_at || b.created_date) - toMs(a.captured_at || a.created_date))[0];
  return {
    season: season.season_number,
    day: n(log.day),
    total: n(log.day) + n(logs.priorDays), // challenge day
    died,
    missed,
    milestones,
    mythic,
    lowered,
    wins: n(log.wins),
    losses: n(log.losses),
    runWins: n(log.run_wins_after),
    best: runs.reduce((m, r) => Math.max(m, n(r.total_wins)), 0),
    rotted,
    rank: rankText(rank),
    rankRaw: rank || null,
    block,
  };
}

export default function OverlayOutro() {
  const [story, setStory] = useState(null);
  const [t, setT] = useState(-1);
  const scale = useStageScale();
  const start = useRef(0);

  useEffect(() => {
    const html = document.documentElement;
    html.style.background = "#08060e";
    document.body.style.background = "#08060e";
    // No finished round to report (or a load error)? Go straight to the thank-you end card.
    loadStory().then((s) => setStory(s || { empty: true })).catch(() => setStory({ empty: true }));
  }, []);

  // One clock for the whole sequence, started once the data is in.
  useEffect(() => {
    if (!story) return undefined;
    start.current = performance.now();
    const id = setInterval(() => setT(performance.now() - start.current), 50);
    return () => clearInterval(id);
  }, [story]);

  const at = (ms) => t >= ms;
  const scene = !story ? null
    : story.empty ? "end"
    : at(story.mythic ? T.mythicEnd : T.end) ? "end" : at(T.tomorrow) ? (story.mythic ? "mythic" : "tomorrow") : at(T.climb) ? "climb" : at(T.block) ? "block" : at(T.result) ? "result" : null;
  const b = story?.block;
  const blockDone = b && (b.kind === "rotted" || b.kind === "pardoned" || b.kind === "none");
  const lastDay = b?.kind === "spared" && b.served === b.sentence - 1;

  const tomorrow = useMemo(() => {
    if (!b) return ["", ""];
    if (blockDone && story?.lowered) return ["NO RARES LEFT", "THE UNCOMMONS STAND TRIAL TOMORROW"];
    if (blockDone) return ["TOMORROW", "THE WHEEL SPINS AGAIN"];
    if (lastDay) return ["TOMORROW", `${b.name.toUpperCase()} IS ONE DAY FROM FREEDOM`];
    return ["TOMORROW", `${b.name.toUpperCase()} IS STILL ON THE BLOCK`];
  }, [b, blockDone, lastDay, story]);

  const end = scene === "end";
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden",
      background: "radial-gradient(circle at 50% 42%, #2a1450, #08060e 72%)" }}>
      <style>{`
        @keyframes ooSlam { 0% { opacity: 0; transform: scale(2.2) } 60% { opacity: 1; transform: scale(.94) } 100% { transform: scale(1) } }
        @keyframes ooIn { from { opacity: 0; transform: translateY(26px) } to { opacity: 1; transform: none } }
        @keyframes ooPip { 0% { background: transparent } 60% { background: #FFD38A; box-shadow: 0 0 22px 6px rgba(255,190,90,.9) } 100% { background: #c9a8ff } }
        @keyframes ooFree { 0% { filter: grayscale(.6) brightness(.7) } 100% { filter: none } }
        @keyframes ooRays { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: scale(1) } }
        @keyframes ooDrain { from { filter: none } to { filter: grayscale(1) brightness(.5) sepia(.4) hue-rotate(220deg) } }
        @keyframes ooGlow { 0%,100% { box-shadow: 0 0 26px 6px rgba(150,80,255,.55) } 50% { box-shadow: 0 0 50px 14px rgba(150,80,255,.9) } }
        @keyframes ooGold { 0%,100% { box-shadow: 0 0 26px 6px rgba(255,170,60,.55) } 50% { box-shadow: 0 0 50px 16px rgba(255,190,90,.95) } }
      `}</style>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})`, fontFamily: "'Barlow Condensed', sans-serif", textAlign: "center" }}>

        {/* The shield: docked top-left (as in the game) until the end card, then back to the centre */}
        <img src={SHIELD} alt="" style={{ position: "absolute", maxWidth: "none", width: "auto",
          left: end ? 960 - 110 : 17, top: end ? 60 : 40, height: end ? 282 : 190,
          filter: "drop-shadow(0 0 18px rgba(255,110,20,0.55)) drop-shadow(0 6px 10px #000)",
          transition: "left 1s cubic-bezier(.22,1,.36,1), top 1s cubic-bezier(.22,1,.36,1), height 1s cubic-bezier(.22,1,.36,1)" }} />

        {/* 1. Result stamp */}
        {scene === "result" && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 340 }}>
            <div style={{ animation: "ooSlam .7s ease-out both", ...(story.died || story.missed ? purpleText(190) : goldText(190)), letterSpacing: 8, lineHeight: 1 }}>
              {story.died ? "DEATH RUN" : story.missed ? "MISSED DAY" : "SURVIVED"}
            </div>
            <div style={{ ...steelText(64), marginTop: 26, animation: "ooIn .6s ease-out .5s both" }}>
              {story.wins}–{story.losses} · SEASON {story.season} · DAY {story.day} · CHALLENGE DAY {story.total}
            </div>
          </div>
        )}

        {/* 2. The block */}
        {scene === "block" && (
          <div key="block" style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", justifyContent: "center",
            alignItems: "center", gap: 70, animation: "ooIn .6s ease-out both" }}>
            {b.kind === "rotted" && (
              <>
                <CardImg src={b.image} anim={`ooDrain 2s ease-in .6s forwards`} />
                <div style={{ ...goldText(110) }}>→</div>
                <CardImg src={b.newImage} anim="ooGold 2.4s ease-in-out infinite" />
              </>
            )}
            {(b.kind === "spared" || b.kind === "pardoned") && (
              <div style={{ position: "relative" }}>
                {b.kind === "pardoned" && (
                  <div style={{ position: "absolute", inset: -140, borderRadius: "50%", animation: "ooRays 1.2s ease-out both",
                    background: "radial-gradient(closest-side, rgba(255,230,170,.75), rgba(255,170,60,.35) 50%, transparent 75%)" }} />
                )}
                <CardImg src={b.image} anim={b.kind === "pardoned" ? "ooFree 1.5s ease-out both, ooGold 2.4s ease-in-out 1.5s infinite" : "ooGlow 2.4s ease-in-out infinite"} />
              </div>
            )}
          </div>
        )}
        {scene === "block" && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 760, animation: "ooIn .6s ease-out .3s both" }}>
            {b.kind === "rotted" && <>
              <div style={{ ...purpleText(66), letterSpacing: 3 }}>{b.name.toUpperCase()} ROTTED</div>
              <div style={{ ...goldText(54), marginTop: 10 }}>{b.newName.toUpperCase()} SCAVENGED</div>
            </>}
            {b.kind === "spared" && <>
              {b.title && <div style={{ ...purpleText(40), letterSpacing: 6, marginBottom: 8 }}>{b.title}</div>}
              <div style={{ ...goldText(66), letterSpacing: 3 }}>SPARED · DAY {b.served} OF {b.sentence}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
                {Array.from({ length: b.sentence }).map((_, i) => (
                  <div key={i} style={{ width: 70, height: 22, borderRadius: 11, border: "3px solid #c9a8ff",
                    background: i < b.served - 1 ? "#c9a8ff" : "transparent",
                    animation: i === b.served - 1 ? "ooPip 1.2s ease-out 1s forwards" : "none" }} />
                ))}
              </div>
            </>}
            {b.kind === "pardoned" && <>
              <div style={{ ...goldText(76), letterSpacing: 4 }}>PARDONED</div>
              <div style={{ ...steelText(50), marginTop: 10 }}>{b.name.toUpperCase()} WALKS FREE… FOR NOW</div>
              {b.times > 1 && <div style={{ ...purpleText(34), marginTop: 10 }}>PARDONED {b.times} TIMES THIS SEASON</div>}
            </>}
            {b.kind === "none" && <div style={{ ...goldText(76) }}>THE DECK LIVES ON</div>}
          </div>
        )}

        {/* 3. The climb */}
        {scene === "climb" && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", gap: 70 }}>
            {[["RUN WINS", story.runWins], ["BEST RUN", story.best], ["ROTTED", story.rotted], ["RANK", story.rank]].map(([k, v], i) => (
              <div key={k} style={{ minWidth: 300, animation: `ooIn .6s ease-out ${i * 0.25}s both` }}>
                {k === "RANK" && story.rankRaw
                  ? <RankEmblem rank={story.rankRaw} label={v} />
                  : <div style={{ ...goldText(110), lineHeight: 1 }}>{v}</div>}
                <div style={{ ...steelText(38), marginTop: 14, letterSpacing: 4 }}>{k}</div>
              </div>
            ))}
          </div>
        )}

        {scene === "climb" && story.milestones.length > 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", gap: 30 }}>
            {story.milestones.map((m, i) => (
              <div key={m} style={{ ...goldText(48), letterSpacing: 3, padding: "10px 30px", borderRadius: 14,
                border: "3px solid #FFD38A", background: "rgba(40,20,0,.55)", animation: `ooSlam .7s ease-out ${1.2 + i * 0.4}s both, ooGold 2.4s ease-in-out ${2 + i * 0.4}s infinite` }}>
                ★ {m}
              </div>
            ))}
          </div>
        )}

        {/* Mythic reached: replaces "tomorrow" on the day the climb is completed */}
        {scene === "mythic" && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 250 }}>
            <div style={{ position: "absolute", left: 960 - 520, top: -230, width: 1040, height: 1040, borderRadius: "50%",
              animation: "ooRays 1.5s ease-out both",
              background: "radial-gradient(closest-side, rgba(255,230,170,.6), rgba(255,170,60,.25) 50%, transparent 75%)" }} />
            {story.rankRaw && <div style={{ position: "relative", display: "flex", justifyContent: "center", animation: "ooSlam .8s ease-out both" }}>
              <RankEmblem rank={{ ...story.rankRaw, rank_class: "Mythic" }} label="" />
            </div>}
            <div style={{ position: "relative", ...goldText(140), letterSpacing: 6, lineHeight: 1, marginTop: 10, animation: "ooSlam .8s ease-out .4s both" }}>
              MYTHIC REACHED
            </div>
            <div style={{ position: "relative", ...steelText(60), marginTop: 20, animation: "ooIn .7s ease-out 1.2s both" }}>
              IN {story.mythic.days} DAYS · {story.rotted} CARDS ROTTED · THE DECK MADE IT
            </div>
          </div>
        )}

        {/* 4. Tomorrow */}
        {scene === "tomorrow" && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 380, animation: "ooIn .7s ease-out both" }}>
            <div style={{ ...purpleText(56), letterSpacing: 10 }}>{tomorrow[0]}</div>
            <div style={{ ...goldText(100), marginTop: 16, padding: "0 120px", lineHeight: 1.05 }}>{tomorrow[1]}</div>
          </div>
        )}

        {/* 5. Thanks + end card */}
        {end && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: 360, animation: "ooIn .7s ease-out .4s both" }}>
              <div style={{ ...goldText(84), letterSpacing: 6 }}>THANKS FOR WATCHING</div>
              <div style={{ ...steelText(38), marginTop: 8 }}>SUBSCRIBE TO SEE IF THIS DECK REACHES MYTHIC · SEE YOU TOMORROW</div>
            </div>
            {/* Space for YouTube's end-screen video boxes */}
            {[350, 1010].map((x) => (
              <div key={x} style={{ position: "absolute", left: x, top: 530, width: 560, height: 315, borderRadius: 14,
                border: "2px solid rgba(201,168,255,.35)", background: "rgba(0,0,0,.25)", animation: "ooIn .7s ease-out .8s both" }} />
            ))}
            <div style={{ position: "absolute", left: 0, right: 0, top: 880, ...purpleText(36), letterSpacing: 2,
              animation: "ooIn .7s ease-out 1.1s both" }}>
              WHO WILL THE WHEEL PICK TOMORROW? TELL ME IN THE COMMENTS
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 985, animation: "ooIn .7s ease-out 1.4s both" }}>
              <div style={{ ...goldText(24), letterSpacing: 2 }}>{OWNERSHIP}</div>
              <div style={{ fontSize: 17, color: "#b9b3c9", marginTop: 8, padding: "0 200px", lineHeight: 1.3,
                textShadow: "0 1px 3px #000" }}>{FAN_CONTENT}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// The rank emblem (as on the HUD) with the rank and tier under it.
function RankEmblem({ rank, label }) {
  const row = RANK_ROWS.indexOf(rank.rank_class || "");
  const tier = Math.min(4, Math.max(1, Number(rank.tier) || 4));
  const col = rank.rank_class === "Mythic" ? 0 : 4 - tier; // sheet columns left → right: Tier 4, 3, 2, 1
  const size = 150;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {row >= 0 && (
        <div style={{ width: size, height: size, backgroundImage: `url(${RANK_SPRITE})`,
          backgroundSize: `${size * 4}px ${size * 6}px`, backgroundPosition: `${-col * size}px ${-row * size}px`,
          filter: "drop-shadow(0 0 18px rgba(255,190,90,.6)) drop-shadow(0 6px 10px #000)" }} />
      )}
      <div style={{ ...goldText(44), lineHeight: 1, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function CardImg({ src, anim }) {
  return (
    <div style={{ width: 360, height: 502, borderRadius: 18, overflow: "hidden", animation: anim, background: "#120a20" }}>
      {src && <img src={src} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />}
    </div>
  );
}