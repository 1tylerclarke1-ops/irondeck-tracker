import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { liveReload } from "@/lib/liveReload";

// Like / Subscribe reminder: a keyed video over the game, bottom-right between the hand
// and Arena's turn button (clear of cards).
// Plays at the end of every game: the Arena helper (the batch file) reports each finished
// match, and once Arena's VICTORY / DEFEAT screen has shown, the reminder plays.
// Never after the game that ends the day (the execution or SURVIVED plays instead), or in the outro.
// Testing: add ?cta=now to the overlay URL to see it after 5s.
const CTA_VIDEO = "https://media.base44.com/videos/public/6ac605d777721f9149c6b225/a6e8e4cbf_irondeck-like-subscribe.webm";
const AFTER_RESULT_MS = 4000; // after the helper reports the result
// In the 1920×1080 Layout (game window: x 480, y 270, 1440×810). "fixed" lets it leave the sidebar.
const CTA_POS = { left: 1365, top: 905, width: 340 };

export default function CtaPopup({ blocked = false, wins = 0, losses = 0, pos = CTA_POS }) {
  const [show, setShow] = useState(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const scoreRef = useRef({ wins, losses });
  scoreRef.current = { wins, losses };
  const vidRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => {
    const test = new URLSearchParams(window.location.search).get("cta") === "now";
    let t;
    let lastId; // the newest match already seen (undefined until the first load)
    const play = () => { if (!blockedRef.current) setShow(true); };
    nextRef.current = () => setShow(false);
    const load = async () => {
      const list = await base44.entities.ArenaMatch.list("-created_date", 1).catch(() => []);
      const m = (list && list[0]) || null;
      if (lastId === undefined) { lastId = m ? m.id : ""; return; } // first load: never replay an old game
      if (!m || m.id === lastId) return;
      lastId = m.id;
      // The game that ends the day: the execution or SURVIVED plays instead
      const { wins: w, losses: l } = scoreRef.current;
      const ends = m.applied ? false : m.result === "loss" ? l + 1 >= 2 : w + 1 >= 7;
      if (ends) return;
      clearTimeout(t);
      t = setTimeout(play, AFTER_RESULT_MS);
    };
    const stop = liveReload(["ArenaMatch"], load);
    if (test) t = setTimeout(play, 5000);
    return () => { clearTimeout(t); stop(); };
  }, []);

  useEffect(() => {
    if (!show || !vidRef.current) return;
    const v = vidRef.current;
    v.muted = true;  // silent: no clicks, no bell (the "muted" attribute alone isn't reliable in OBS)
    v.volume = 0;
    v.currentTime = 0;
    v.play().catch(() => nextRef.current?.());
  }, [show]);

  return (
    <div style={{ position: "fixed", ...pos, zIndex: 60, pointerEvents: "none",
      opacity: show ? 1 : 0, transition: "opacity .2s ease",
      filter: "drop-shadow(0 4px 12px rgba(0,0,0,.7))" }}>
      <video ref={vidRef} src={CTA_VIDEO} preload="auto" playsInline muted
        onEnded={() => nextRef.current?.()} style={{ width: "100%", display: "block" }} />
    </div>
  );
}