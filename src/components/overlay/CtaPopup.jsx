import React, { useEffect, useRef, useState } from "react";

// Like / Subscribe / bell reminder: a keyed video (click, click, ding) in the sidebar.
// Random timing: first after 4-7 min, then every 8-14 min. Never during the death
// execution or the outro (waits a minute and tries again).
// Testing: add ?cta=now to the overlay URL to see it after 5s, then every 20s.
const CTA_VIDEO = "https://media.base44.com/videos/public/6ac605d777721f9149c6b225/a6e8e4cbf_irondeck-like-subscribe.webm";
const MIN = 60000;
const rand = (a, b) => a + Math.random() * (b - a);

export default function CtaPopup({ blocked = false }) {
  const [show, setShow] = useState(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const vidRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => {
    const test = new URLSearchParams(window.location.search).get("cta") === "now";
    let t;
    const schedule = (ms) => { clearTimeout(t); t = setTimeout(play, ms); };
    const play = () => {
      if (blockedRef.current) { schedule(MIN); return; }
      setShow(true);
    };
    nextRef.current = () => { setShow(false); schedule(test ? 20000 : rand(8 * MIN, 14 * MIN)); };
    schedule(test ? 5000 : rand(4 * MIN, 7 * MIN));
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!show || !vidRef.current) return;
    const v = vidRef.current;
    v.currentTime = 0;
    v.play().catch(() => nextRef.current?.());
  }, [show]);

  return (
    <div style={{ position: "absolute", left: "50%", bottom: 30, width: 440, marginLeft: -220, zIndex: 50,
      pointerEvents: "none", opacity: show ? 1 : 0, transition: "opacity .2s ease" }}>
      <video ref={vidRef} src={CTA_VIDEO} preload="auto" playsInline
        onEnded={() => nextRef.current?.()} style={{ width: "100%", display: "block" }} />
    </div>
  );
}