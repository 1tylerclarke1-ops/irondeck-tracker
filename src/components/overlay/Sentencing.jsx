import React, { useEffect, useMemo, useRef, useState } from "react";
import { goldText, steelText, purpleText } from "@/lib/overlayText";
import { base44 } from "@/api/base44Client";
import { captureTitle, poolFor } from "@/lib/condemned";

// The Sentencing: plays after the "previously on" recap in the Overlay Intro.
// - A newly condemned card (not yet shown): wheel spins to it, then the verdict.
// - A card still serving its sentence: "STILL ON THE BLOCK · DAY x/y"
//   (or "ONE DAY FROM FREEDOM" on its last day).
// Add ?sentence=replay to the intro URL to force the wheel again (testing).

const PLAYED_KEY = "irondeck-sentence-played";
const WHEEL_PX = 540; // DeathWheel draws at 288px
const scry = (id, v) => (id ? `https://api.scryfall.com/cards/${id}?format=image&version=${v}` : "");
const n = (v) => Number(v) || 0;

const getPlayed = () => { try { return localStorage.getItem(PLAYED_KEY); } catch { return null; } };
const setPlayed = (v) => { try { localStorage.setItem(PLAYED_KEY, v); } catch {} };

export default function Sentencing({ season, cards, active, fadeIn = false, onDone }) {
  const [phase, setPhase] = useState("wait"); // wait, banner, wheel, countdown, spinning, verdict, block, out
  const [count, setCount] = useState(3);
  const locked = useRef(null); // the season snapshot we play from
  const wheelRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone; // the intro re-renders every 5s; keep timers stable
  const replay = useMemo(() => new URLSearchParams(window.location.search).get("sentence") === "replay", []);

  // Wheel slices: the pool still in the deck (rares/mythics, or uncommons, then
  // commons, if none are left), always including the condemned card.
  const condemnedName = season?.condemned_card || "";
  const wheelCards = useMemo(() => {
    const { names } = poolFor(cards);
    const seen = new Map();
    for (const c of cards || []) {
      if (n(c.copies) > 0 && (names.includes(c.name) || c.name === condemnedName) && !seen.has(c.name))
        seen.set(c.name, { name: c.name, scryfall_id: c.scryfall_id || "" });
    }
    return [...seen.values()];
  }, [cards, condemnedName]);
  const artMap = useMemo(() => {
    const m = {};
    wheelCards.forEach((c) => { if (c.scryfall_id) m[c.scryfall_id] = { artCrop: scry(c.scryfall_id, "art_crop") }; });
    return m;
  }, [wheelCards]);

  // No card condemned yet (round started before the wheel)? Ask the server to
  // pick one now, so the wheel spins instead of waiting.
  const [picked, setPicked] = useState(null);
  const asked = useRef(false);
  const s0 = picked && season && !season.condemned_card ? { ...season, ...picked } : season;
  useEffect(() => {
    if (!active || phase !== "wait" || asked.current || !season || season.condemned_card || wheelCards.length === 0) return;
    asked.current = true;
    base44.functions
      .invoke("ensureCondemned", {})
      .then((r) => {
        const d = r?.data || r;
        if (d?.condemned_card) setPicked(d);
      })
      .catch(() => { asked.current = false; });
  }, [active, phase, season, wheelCards.length]);

  // Wait until a card is condemned, then decide: spin or "still on the block".
  useEffect(() => {
    if (!active || phase !== "wait" || !s0?.condemned_card || wheelCards.length === 0) return;
    locked.current = s0;
    const key = `${s0.condemned_card}|${s0.condemned_since || ""}`;
    // First day of a sentence (new season, or after a rot or a pardon): always spin,
    // so the wheel can be recorded whenever the intro is shown. Day 2+ shows "still on the block".
    const fresh = replay || n(s0.block_days) === 0;
    if (fresh) setPlayed(key);
    const lowered = s0.block_pool && s0.block_pool !== "rare";
    setPhase(fresh ? (n(s0.block_capture) > 1 || lowered ? "banner" : "wheel") : "block");
  }, [active, phase, s0, wheelCards.length, replay]);

  // Timed steps.
  useEffect(() => {
    const go = (p, ms) => setTimeout(() => setPhase(p), ms);
    let t;
    if (phase === "banner") t = go("wheel", 2800);
    if (phase === "wheel") t = go("countdown", 1200);
    if (phase === "verdict") t = go("out", 6000);
    if (phase === "block") t = go("out", 7000);
    if (phase === "out") t = setTimeout(() => doneRef.current?.(), 700);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) { setPhase("spinning"); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  const s = locked.current || season;
  const name = s?.condemned_card || "";
  const card = wheelCards.find((c) => c.name === name);
  const sentence = n(s?.block_sentence) || 3;
  const dayOn = Math.min(n(s?.block_days) + 1, sentence);
  const lastDay = dayOn === sentence;
  const showWheel = ["wheel", "countdown", "spinning"].includes(phase);
  // While fading out, keep the wording of what was on screen (CONDEMNED vs STILL ON THE BLOCK).
  const shownRef = useRef("verdict");
  if (phase === "verdict" || phase === "block") shownRef.current = phase;
  const view = phase === "out" ? shownRef.current : phase;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 59, pointerEvents: "none", overflow: "hidden",
      background: "radial-gradient(circle at 50% 45%, #3c1d6e, #08060e 70%)",
      opacity: phase === "out" ? 0 : 1, transition: "opacity 0.7s ease",
      animation: fadeIn ? "snFade 0.8s ease backwards" : "none",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Barlow Condensed', sans-serif" }}>
      <style>{`
        @keyframes snFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes snIn { from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes snSlam { 0% { transform: scale(2.2); opacity: 0 } 60% { transform: scale(0.95); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes snGlow { 0%,100% { box-shadow: 0 0 40px 8px rgba(150,80,255,.55) } 50% { box-shadow: 0 0 70px 18px rgba(150,80,255,.9) } }
      `}</style>

      {active && phase === "wait" && <div style={{ ...steelText(40), letterSpacing: 6, opacity: 0.8 }}>THE DECK AWAITS…</div>}

      {phase === "banner" && (
        <div style={{ textAlign: "center", animation: "snSlam 0.7s ease-out both" }}>
          <div style={{ ...purpleText(96), letterSpacing: 6 }}>
            {captureTitle(n(s?.block_capture)) || "THE EXECUTIONER LOWERS HIS SIGHTS"}
          </div>
          {n(s?.block_capture) > 1 && (
            <div style={{ ...goldText(44), marginTop: 12 }}>CAPTURE {n(s?.block_capture)} · SENTENCE {sentence} {sentence === 1 ? "DAY" : "DAYS"}</div>
          )}
          {s?.block_pool && s.block_pool !== "rare" && (
            <div style={{ ...steelText(40), marginTop: 12 }}>
              {n(s?.block_capture) > 1 ? "THE EXECUTIONER LOWERS HIS SIGHTS · " : "NO RARES LEFT · "}THE {String(s.block_pool).toUpperCase()}S STAND TRIAL
            </div>
          )}
        </div>
      )}

      {showWheel && (
        <>
          <div style={{ ...goldText(54), letterSpacing: 4, marginBottom: 24 }}>TODAY'S CONDEMNED CARD</div>
          <div style={{ animation: "snIn 0.6s cubic-bezier(0.22,1,0.36,1) both" }}>
            <ShuffleDeck cards={wheelCards} pick={locked.current?.condemned_card || name}
              play={phase === "spinning"} onLand={() => setPhase("verdict")} />
          </div>
          <div style={{ ...goldText(40), marginTop: 24, minHeight: 48 }}>
            {phase === "countdown" ? (count > 0 ? `SHUFFLE IN ${count}` : "SHUFFLE!") : ""}
          </div>
        </>
      )}

      {(phase === "verdict" || phase === "block" || (phase === "out" && name)) && (
        <div style={{ display: "flex", alignItems: "center", gap: 70, animation: "snIn 0.6s ease-out both" }}>
          {card?.scryfall_id && (
            <img src={scry(card.scryfall_id, "normal")} alt={name}
              style={{ width: 420, maxWidth: "none", borderRadius: 20, animation: "snGlow 2.4s ease-in-out infinite" }} />
          )}
          <div style={{ maxWidth: 820 }}>
            <div style={{ ...purpleText(52), letterSpacing: 6 }}>
              {view === "verdict" ? "CONDEMNED" : lastDay ? "ONE DAY FROM FREEDOM" : "STILL ON THE BLOCK"}
            </div>
            <div style={{ ...goldText(92), lineHeight: 1, margin: "10px 0 18px" }}>{name.toUpperCase()}</div>
            <div style={{ ...steelText(46) }}>
              {view === "verdict" ? `LOSE TODAY, AND IT ROTS.` : `DAY ${dayOn} OF ${sentence}. LOSE TODAY, AND IT ROTS.`}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
              {Array.from({ length: sentence }).map((_, i) => (
                <div key={i} style={{ width: 54, height: 18, borderRadius: 9, border: "3px solid #c9a8ff",
                  background: view !== "verdict" && i < dayOn - 1 ? "#c9a8ff" : view !== "verdict" && i === dayOn - 1 ? "rgba(201,168,255,.45)" : "transparent" }} />
              ))}
            </div>
            <div style={{ ...steelText(30), marginTop: 10, opacity: 0.85 }}>
              SURVIVE {sentence} {sentence === 1 ? "DAY" : "DAYS"} TO WALK FREE
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------- The shuffle (replaces the wheel) ----------
// A face-down deck riffles three times, then the top card flips and the pool's cards
// flick through it (slowing down, like the death scavenge) until it lands on the condemned card.
const SH_W = 250;
const SH_H = 349;
const SH_BACKS = 8;
const SH_RIFFLE_MS = 2600; // three riffles
const SH_GAPS = [70, 70, 70, 75, 80, 90, 100, 115, 135, 160, 190, 230, 280, 340];

function CardBack({ style }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: SH_W, height: SH_H, borderRadius: 14, border: "3px solid #b98a3c",
      background: "radial-gradient(circle at 50% 45%, #4a2380, #160a2a 72%)", boxShadow: "0 6px 18px rgba(0,0,0,.65)", ...style }}>
      <div style={{ position: "absolute", inset: 14, borderRadius: 9, border: "2px solid rgba(201,168,255,.5)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...goldText(46), letterSpacing: 4 }}>ID</div>
      </div>
    </div>
  );
}

export function ShuffleDeck({ cards, pick, play, onLand }) {
  const [step, setStep] = useState("stack"); // stack, shuffle, flick, landed
  const [face, setFace] = useState("");
  const landRef = useRef(onLand);
  landRef.current = onLand;
  const faces = useMemo(() => (cards || []).map((c) => scry(c.scryfall_id, "normal")).filter(Boolean), [cards]);
  const pickImg = scry((cards || []).find((c) => c.name === pick)?.scryfall_id, "normal");

  // Load every face up front, so nothing flashes blank during the flick.
  useEffect(() => { faces.forEach((u) => { const i = new Image(); i.src = u; }); }, [faces]);

  useEffect(() => {
    if (!play) return undefined;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const pool = faces.filter((u) => u !== pickImg).sort(() => Math.random() - 0.5);
    setStep("shuffle");
    let t = SH_RIFFLE_MS;
    at(t, () => setStep("flick"));
    SH_GAPS.forEach((gap, i) => {
      const u = pool.length ? pool[i % pool.length] : pickImg;
      at(t, () => setFace(u));
      t += gap;
    });
    at(t, () => { setFace(pickImg); setStep("landed"); });
    at(t + 1500, () => landRef.current?.());
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const showFace = step === "flick" || step === "landed";
  return (
    <div style={{ position: "relative", width: 640, height: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes shRiffleL { 0%, 100% { transform: translate(0, 0) rotate(0deg) } 30%, 55% { transform: translate(-160px, 14px) rotate(-11deg) } }
        @keyframes shRiffleR { 0%, 100% { transform: translate(0, 0) rotate(0deg) } 30%, 55% { transform: translate(160px, 14px) rotate(11deg) } }
        @keyframes shFlip { from { transform: rotateY(90deg) scale(.9) } to { transform: rotateY(0deg) scale(1) } }
        @keyframes shLand { 0% { transform: scale(1) } 35% { transform: scale(1.12) } 100% { transform: scale(1) } }
        @keyframes shBurst { 0% { opacity: 0; transform: scale(.6) } 15% { opacity: 1 } 100% { opacity: 0; transform: scale(1.9) } }
        @keyframes shGlow { 0%, 100% { box-shadow: 0 0 30px 6px rgba(150,80,255,.55) } 50% { box-shadow: 0 0 60px 16px rgba(170,100,255,.95) } }
      `}</style>
      <div style={{ position: "relative", width: SH_W, height: SH_H, opacity: showFace ? 0.25 : 1, transition: "opacity .4s ease" }}>
        {Array.from({ length: SH_BACKS }, (_, i) => (
          <CardBack key={i} style={{ marginLeft: -i * 1.5, marginTop: -i * 2,
            animation: step === "shuffle" ? `${i % 2 ? "shRiffleR" : "shRiffleL"} ${SH_RIFFLE_MS / 3}ms ease-in-out ${i * 30}ms 3` : "none" }} />
        ))}
      </div>
      {showFace && face && (
        <div style={{ position: "absolute", left: "50%", top: "50%", width: SH_W, height: SH_H, marginLeft: -SH_W / 2, marginTop: -SH_H / 2 - 12,
          perspective: 900 }}>
          {step === "landed" && (
            <div style={{ position: "absolute", inset: -60, borderRadius: "50%", pointerEvents: "none", mixBlendMode: "screen",
              background: "radial-gradient(closest-side, rgba(235,215,255,.95), rgba(150,80,255,.5) 45%, transparent 75%)",
              animation: "shBurst .9s ease-out both" }} />
          )}
          <div style={{ width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: "#120a20",
            animation: step === "landed" ? "shLand .5s ease-out both, shGlow 2.4s ease-in-out .5s infinite" : "shFlip .25s ease-out both" }}>
            <img src={face} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />
          </div>
        </div>
      )}
    </div>
  );
}