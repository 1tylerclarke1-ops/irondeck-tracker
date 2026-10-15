import React, { useEffect, useRef, useState } from "react";

// Like / Follow / Subscribe reminder in the sidebar: grows in (6 frames), holds,
// shrinks away. Random timing: first after 4-7 min, then every 8-14 min.
// Gold normally; rotting purple when the round is on the edge (a loss already).
// Never shown during the death execution (waits a minute and tries again).
// Testing: add ?cta=now to the overlay URL to see it after 5s, then every 20s.
const SHEET = "PASTE_CTA_SHEET_URL_HERE";
const FW = 338, FH = 624, FRAMES = 6;
const GROW_MS = 110, HOLD_MS = 8000, SHRINK_MS = 90, FADE_MS = 400;
const MIN = 60000;
const rand = (a, b) => a + Math.random() * (b - a);

export default function CtaPopup({ tone = "gold", blocked = false }) {
  const [frame, setFrame] = useState(-1); // -1 = hidden
  const [fading, setFading] = useState(false);
  const [shownTone, setShownTone] = useState(tone);
  const toneRef = useRef(tone);
  const blockedRef = useRef(blocked);
  toneRef.current = tone;
  blockedRef.current = blocked;

  useEffect(() => {
    new Image().src = SHEET; // preload, so the first frame isn't blank
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const test = new URLSearchParams(window.location.search).get("cta") === "now";
    const play = () => {
      if (blockedRef.current) { later(play, MIN); return; }
      setShownTone(toneRef.current);
      setFading(false);
      for (let i = 0; i < FRAMES; i++) later(() => setFrame(i), i * GROW_MS);
      const shrinkAt = FRAMES * GROW_MS + HOLD_MS;
      for (let i = FRAMES - 2; i >= 0; i--) later(() => setFrame(i), shrinkAt + (FRAMES - 2 - i) * SHRINK_MS);
      const endAt = shrinkAt + FRAMES * SHRINK_MS;
      later(() => setFading(true), endAt);
      later(() => {
        setFrame(-1);
        setFading(false);
        later(play, test ? 20000 : rand(8 * MIN, 14 * MIN));
      }, endAt + FADE_MS);
    };
    later(play, test ? 5000 : rand(4 * MIN, 7 * MIN));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (frame < 0) return null;
  const row = shownTone === "rot" ? 1 : 0;
  const full = frame === FRAMES - 1;
  return (
    <div style={{ position: "absolute", left: "50%", bottom: 0, width: FW, height: FH, marginLeft: -FW / 2,
      zIndex: 50, pointerEvents: "none", opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
      <style>{`@keyframes ctaPulse { 0%,100% { filter: brightness(1) } 50% { filter: brightness(1.3) } }`}</style>
      <div style={{ width: "100%", height: "100%", backgroundImage: `url(${SHEET})`,
        backgroundSize: `${FW * FRAMES}px ${FH * 2}px`, backgroundPosition: `${-frame * FW}px ${-row * FH}px`,
        animation: full ? "ctaPulse 1.6s ease-in-out infinite" : "none" }} />
    </div>
  );
}