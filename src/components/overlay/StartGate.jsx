import React, { useEffect, useRef, useState } from "react";
import { goldText, steelText } from "@/lib/overlayText";

// Holds the Overlay Intro until you're recording, then counts 3-2-1 and starts it.
// - In OBS: shows "READY" (not recorded) until you press Start Recording, then the countdown.
//   If OBS is already recording when the scene opens, the countdown starts straight away.
//   (Browser source → Properties → Page permissions: "Read access to OBS status information".)
// - In a normal browser: a START button instead (for testing).
// - ?gate=off on the address skips all of this (the old behaviour).
const BG = "radial-gradient(circle at 50% 42%, #2a1450, #08060e 72%)";

export default function StartGate({ onGo }) {
  const [count, setCount] = useState(null); // null = waiting; 3, 2, 1 = counting down
  const started = useRef(false);
  const go = useRef(onGo);
  go.current = onGo;
  const obs = typeof window !== "undefined" ? window.obsstudio : null;
  const off = new URLSearchParams(window.location.search).get("gate") === "off";

  const begin = () => {
    if (started.current) return;
    started.current = true;
    setCount(3);
  };

  useEffect(() => {
    if (off) { go.current?.(); return undefined; }
    const onRec = () => begin();
    window.addEventListener("obsRecordingStarted", onRec);
    try { obs?.getStatus?.((st) => { if (st && st.recording) begin(); }); } catch { /* no permission: wait for the event */ }
    return () => window.removeEventListener("obsRecordingStarted", onRec);
  }, []);

  useEffect(() => {
    if (count == null) return undefined;
    if (count === 0) { go.current?.(); return undefined; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  if (off) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: BG, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", textAlign: "center" }}>
      <style>{"@keyframes sgPop { 0% { opacity: 0; transform: scale(1.6) } 30% { opacity: 1; transform: scale(1) } 85% { opacity: 1 } 100% { opacity: 0; transform: scale(.9) } }"}</style>
      {count == null ? (
        <>
          <div style={{ ...goldText(120), letterSpacing: 8 }}>READY</div>
          <div style={{ ...steelText(44), marginTop: 16 }}>{obs ? "PRESS START RECORDING TO BEGIN" : "OPEN IN OBS, OR CLICK START TO TEST"}</div>
          {!obs && (
            <button onClick={begin} style={{ marginTop: 40, padding: "18px 60px", fontSize: 36, fontWeight: 800, borderRadius: 14,
              border: "3px solid #FFCF7A", background: "#1a0d2e", color: "#FFCF7A", cursor: "pointer" }}>START</button>
          )}
        </>
      ) : count > 0 ? (
        <div key={count} style={{ ...goldText(320), lineHeight: 1, animation: "sgPop 1s ease-out both" }}>{count}</div>
      ) : null}
    </div>
  );
}