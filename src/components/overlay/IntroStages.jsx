import React, { useEffect, useRef, useState } from "react";
import { goldText, steelText, purpleText } from "@/lib/overlayText";
import SeasonIntro from "@/components/overlay/SeasonIntro";

// Small full-screen stages for the Overlay Intro. Each one:
// - sits on an opaque background (so the deck never flashes between stages),
// - waits until `active`, plays, fades out, then calls onDone.

const BG = "radial-gradient(circle at 50% 42%, #2a1450, #08060e 72%)";
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

// Runs for `ms` once active, then fades and calls onDone. Returns { on, closing }.
function useTimedStage(active, ms, onDone) {
  const [closing, setClosing] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!active) return undefined;
    const a = setTimeout(() => setClosing(true), ms);
    const b = setTimeout(() => done.current?.(), ms + FADE_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [active, ms]);
  return { on: active, closing };
}

function Shell({ closing, children }) {
  const scale = useStageScale();
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", background: BG,
      opacity: closing ? 0 : 1, transition: `opacity ${FADE_MS}ms ease`, fontFamily: "'Barlow Condensed', sans-serif" }}>
      <style>{`
        @keyframes isIn { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
        @keyframes isSlam { 0% { opacity: 0; transform: scale(2) } 60% { opacity: 1; transform: scale(.95) } 100% { transform: scale(1) } }
        @keyframes isRays { from { opacity: 0; transform: scale(.5) rotate(0deg) } to { opacity: 1; transform: scale(1) rotate(20deg) } }
        @keyframes isFree { 0% { filter: grayscale(.7) brightness(.6) } 100% { filter: none } }
        @keyframes isGold { 0%,100% { box-shadow: 0 0 30px 8px rgba(255,170,60,.6) } 50% { box-shadow: 0 0 70px 22px rgba(255,190,90,1) } }
        @keyframes isChain { 0% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(120px) rotate(25deg) } }
      `}</style>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})`, textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}

// ---- Rules card: every rule on one screen (pause-and-read) ----
const RULES = [
  ["ONE ROUND A DAY", "Ranked best-of-one. 7 wins survives the day. 2 losses is a Death Run."],
  ["THE CONDEMNED", "Each day the deck is shuffled and a rare or mythic goes on the chopping block."],
  ["THE ROT", "Die, and the condemned card rots: a random common or uncommon replaces it."],
  ["THE PARDON", "Survive the sentence (3 days) and the card walks free."],
  ["THE EXECUTIONER REMEMBERS", "Caught again this season: 2 days. Then 1 day, every time after."],
  ["NO MERCY", "Nothing comes back. Nothing is shielded. Only a new season brings a fresh deck."],
  ["MISSED DAY", "Miss a day, or leave a round unfinished, and the condemned card rots anyway."],
  ["THE GOAL", "Mythic. The climb carries on, season after season, until this deck gets there."],
];

export function RulesCard({ active, seasonNumber, onDone }) {
  const { on, closing } = useTimedStage(active, 9000, onDone);
  return (
    <Shell closing={closing}>
      {on && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 90, animation: "isIn .6s ease-out both" }}>
            <div style={{ ...purpleText(34), letterSpacing: 10 }}>{seasonNumber ? `SEASON ${seasonNumber}` : "IRONDECK"}</div>
            <div style={{ ...goldText(96), letterSpacing: 6, lineHeight: 1 }}>THE RULES</div>
          </div>
          <div style={{ position: "absolute", left: 160, right: 160, top: 300, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "34px 80px", textAlign: "left" }}>
            {RULES.map(([h, t], i) => (
              <div key={h} style={{ animation: `isIn .5s ease-out ${0.3 + i * 0.12}s both` }}>
                <div style={{ ...goldText(40), letterSpacing: 2 }}>{h}</div>
                <div style={{ ...steelText(30), lineHeight: 1.15, marginTop: 4, textTransform: "none" }}>{t}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

// ---- Pardon: the condemned card walks free ----
export function PardonMoment({ active, name, image, times, onDone }) {
  const { on, closing } = useTimedStage(active, 5500, onDone);
  return (
    <Shell closing={closing}>
      {on && (
        <>
          <div style={{ position: "absolute", left: 960 - 520, top: 540 - 520, width: 1040, height: 1040, borderRadius: "50%",
            background: "repeating-conic-gradient(from 0deg, rgba(255,214,140,.22) 0deg 8deg, transparent 8deg 22deg)",
            animation: "isRays 2.5s ease-out both" }} />
          <div style={{ position: "absolute", left: 960 - 520, top: 540 - 520, width: 1040, height: 1040, borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(255,230,170,.55), rgba(255,170,60,.18) 55%, transparent 75%)" }} />
          <div style={{ position: "absolute", left: 960 - 180, top: 130, width: 360, height: 502, borderRadius: 18, overflow: "hidden",
            background: "#120a20", animation: "isIn .6s ease-out both, isFree 1.6s ease-out .4s both, isGold 2.4s ease-in-out 1.6s infinite" }}>
            {image && <img src={image} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />}
          </div>
          {/* broken shackles falling away */}
          {[-1, 1].map((d) => (
            <div key={d} style={{ position: "absolute", left: 960 + d * 210 - 40, top: 360, width: 80, height: 34, borderRadius: 17,
              border: "8px solid #8a8f99", boxShadow: "0 4px 10px #000", animation: "isChain 1.2s ease-in .6s both" }} />
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, top: 690, animation: "isSlam .7s ease-out .5s both" }}>
            <div style={{ ...goldText(110), letterSpacing: 8, lineHeight: 1 }}>PARDONED</div>
            <div style={{ ...steelText(54), marginTop: 10 }}>{(name || "").toUpperCase()} WALKS FREE</div>
            <div style={{ ...purpleText(34), marginTop: 10, opacity: 0.9 }}>
              {times > 1 ? `PARDONED ${times} TIMES THIS SEASON · ` : ""}THE EXECUTIONER WILL REMEMBER
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

// ---- Milestone: recognition only (new best run, flawless day, day milestones) ----
export function MilestoneBanner({ active, items, onDone }) {
  const { on, closing } = useTimedStage(active, 3500, onDone);
  return (
    <Shell closing={closing}>
      {on && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 330 }}>
          <div style={{ ...purpleText(40), letterSpacing: 10, animation: "isIn .5s ease-out both" }}>MILESTONE</div>
          {(items || []).map((m, i) => (
            <div key={m.title} style={{ marginTop: 24, animation: `isSlam .7s ease-out ${0.2 + i * 0.4}s both` }}>
              <div style={{ ...goldText(104), letterSpacing: 4, lineHeight: 1 }}>{m.title}</div>
              {m.sub && <div style={{ ...steelText(44), marginTop: 6 }}>{m.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ---- Season review (Season 2+, Day 1): how far last season got, then the new deck ----
export function SeasonReview({ active, season, seasonNumber, allCards, cardImages, onDone }) {
  const scale = useStageScale();
  const [total, setTotal] = useState(null);
  const [t, setT] = useState(0);
  const [closing, setClosing] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!active || total == null) return undefined;
    const start = performance.now();
    const id = setInterval(() => setT(performance.now() - start), 40);
    return () => clearInterval(id);
  }, [active, total]);
  // Finished: fade out, then hand over. (The fade timer lives in its own effect,
  // so the clock ticking every 40ms can't keep cancelling it.)
  useEffect(() => {
    if (total != null && t >= total && !closing) setClosing(true);
  }, [t, total, closing]);
  useEffect(() => {
    if (!closing) return undefined;
    const id = setTimeout(() => done.current?.(), FADE_MS);
    return () => clearTimeout(id);
  }, [closing]);
  // Safety: if last season's data never loads, move on after 8s.
  useEffect(() => {
    if (!active) return undefined;
    const id = setTimeout(() => { if (total == null) done.current?.(); }, 8000);
    return () => clearTimeout(id);
  }, [active, total]);
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", background: BG,
      opacity: closing ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})` }}>
        {season && (
          <SeasonIntro t={active ? t : 0} season={season} seasonNumber={seasonNumber} allCards={allCards}
            cardImages={cardImages} showRules={false} onReady={(ms) => setTotal(ms)} />
        )}
      </div>
    </div>
  );
}