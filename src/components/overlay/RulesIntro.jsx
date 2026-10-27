import React, { useEffect, useRef, useState } from "react";
import { goldText, steelText, purpleText } from "@/lib/overlayText";

// Season 1, Day 1: the rules, one slide at a time, between the shield and the wheel.
// Each slide: a heading and up to three lines. Times are in ms (paced for the voiceover).

const SLIDES = [
  { ms: 5000, kicker: "SEASON 1 · DAY 1", head: "CAN A ROTTING DECK", sub: "REACH MYTHIC?" },
  { ms: 7000, kicker: "RULE 1", head: "ONE ROUND A DAY",
    lines: ["Ranked, best-of-one.", "7 wins and the deck survives the day.", "2 losses is a DEATH RUN."] },
  { ms: 7000, kicker: "RULE 2", head: "THE CONDEMNED",
    lines: ["Every day the shuffle condemns one rare or mythic.", "It goes on the chopping block.", "Lose today, and it rots."] },
  { ms: 7000, kicker: "RULE 3", head: "THE ROT",
    lines: ["The condemned card is executed.", "A random common or uncommon", "is scavenged in its place."] },
  { ms: 8000, kicker: "RULE 4", head: "THE PARDON",
    lines: ["Survive 3 days on the block and it walks free.", "But the executioner remembers.", "Caught again: 2 days. Then 1."] },
  { ms: 8000, kicker: "RULE 5", head: "NO MERCY",
    lines: ["Nothing is ever resurrected. Nothing is shielded.", "Miss a day, and the card rots anyway.", "Only a new season brings a fresh deck."] },
  { ms: 7000, kicker: "THE SMALL PRINT", head: "FAIR PLAY",
    lines: ["Any deck is allowed: netdeck or homebrew.", "No mulligans: you keep the opening hand.", "A draw counts as nothing. A disconnect is a loss only if Arena says so."] },
  { ms: 6500, kicker: "THE GOAL", head: "MYTHIC",
    lines: ["The climb carries on, season after season,", "until this deck reaches Mythic."] },
];
const FADE_MS = 700;

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

export default function RulesIntro({ active, onDone }) {
  const [i, setI] = useState(-1); // -1: not started
  const [closing, setClosing] = useState(false);
  const scale = useStageScale();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (active && i === -1) setI(0);
  }, [active, i]);

  useEffect(() => {
    if (i < 0) return undefined;
    if (i >= SLIDES.length) {
      setClosing(true);
      const t = setTimeout(() => doneRef.current?.(), FADE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((n) => n + 1), SLIDES[i].ms);
    return () => clearTimeout(t);
  }, [i]);

  const slide = SLIDES[Math.min(Math.max(i, 0), SLIDES.length - 1)];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none", overflow: "hidden",
      background: "radial-gradient(circle at 50% 42%, #2a1450, #08060e 72%)",
      opacity: closing ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
      <style>{`
        @keyframes riIn { from { opacity: 0; transform: translateY(26px) } to { opacity: 1; transform: none } }
        @keyframes riLine { from { opacity: 0; transform: translateX(-20px) } to { opacity: 1; transform: none } }
        @keyframes riOut { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})`, fontFamily: "'Barlow Condensed', sans-serif" }}>
        {i >= 0 && i < SLIDES.length && (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 260, textAlign: "center",
            animation: `riIn 0.7s cubic-bezier(.2,.8,.3,1) both, riOut ${FADE_MS / 1000}s ease ${(slide.ms - FADE_MS) / 1000}s forwards` }}>
            <div style={{ ...purpleText(40), letterSpacing: 10 }}>{slide.kicker}</div>
            <div style={{ ...goldText(slide.sub ? 120 : 140), letterSpacing: 4, lineHeight: 1, marginTop: 14 }}>{slide.head}</div>
            {slide.sub && <div style={{ ...goldText(120), letterSpacing: 4, lineHeight: 1, marginTop: 6 }}>{slide.sub}</div>}
            <div style={{ width: 520, height: 3, margin: "34px auto 30px",
              background: "linear-gradient(90deg, transparent, #E8892F, #c7ced8, #8a5cf0, transparent)" }} />
            {(slide.lines || []).map((l, k) => (
              <div key={k} style={{ ...steelText(54), marginTop: 14,
                animation: `riLine 0.6s ease-out ${0.5 + k * 0.9}s both` }}>{l}</div>
            ))}
          </div>
        )}
        {/* progress pips */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, display: "flex", justifyContent: "center", gap: 14 }}>
          {SLIDES.map((_, k) => (
            <div key={k} style={{ width: 46, height: 10, borderRadius: 5, border: "2px solid #c9a8ff",
              background: k < i ? "#c9a8ff" : k === i ? "#FFD38A" : "transparent", transition: "background .4s" }} />
          ))}
        </div>
      </div>
    </div>
  );
}