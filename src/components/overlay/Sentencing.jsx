import React, { useEffect, useMemo, useRef, useState } from "react";
import DeathWheel from "@/components/overlay/DeathWheel";
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

  useEffect(() => {
    if (phase === "spinning" && wheelRef.current && locked.current)
      wheelRef.current.spinTo({ name: locked.current.condemned_card });
  }, [phase]);

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

      {active && phase === "wait" && <div style={{ ...steelText(40), letterSpacing: 6, opacity: 0.8 }}>THE WHEEL AWAITS…</div>}

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
          <div style={{ width: WHEEL_PX, height: WHEEL_PX, animation: "snIn 0.6s cubic-bezier(0.22,1,0.36,1) both" }}>
            <div style={{ width: 288, height: 288, transform: `scale(${WHEEL_PX / 288})`, transformOrigin: "top left" }}>
              <DeathWheel ref={wheelRef} cards={wheelCards} art={artMap} onLand={() => setTimeout(() => setPhase("verdict"), 1500)} />
            </div>
          </div>
          <div style={{ ...goldText(40), marginTop: 24, minHeight: 48 }}>
            {phase === "countdown" ? (count > 0 ? `SPIN IN ${count}` : "SPIN!") : ""}
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