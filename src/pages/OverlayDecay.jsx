import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import DecayWheel from "@/components/decay/DecayWheel";
import useCardArt from "@/hooks/useCardArt";

export default function OverlayDecay() {
  const [event, setEvent] = useState(null);
  const wheelRef = useRef(null);
  const spunIdRef = useRef(null);
  const [phase, setPhase] = useState("done");

  // Transparent background for stream capture
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = "";
      body.style.background = "";
    };
  }, []);

  // Poll the latest DecayEvent every second
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await base44.entities.DecayEvent.list("-updated_date", 1);
        if (!active) return;
        setEvent(list && list.length ? list[0] : null);
      } catch {
        // keep last event on error
      }
    };
    load();
    const id = setInterval(load, 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const step = event?.step || "done";
  const wheelNames = Array.isArray(event?.wheel_card_names)
    ? event.wheel_card_names
    : [];
  const wheelCards = wheelNames.map((name) => ({ name }));
  const chosenName = event?.chosen_card || event?.card_removed || null;

  const wheelArt = useCardArt(wheelNames);
  const revealNames = [event?.card_removed, event?.replacement_card].filter(
    Boolean
  );
  const revealArt = useCardArt(revealNames);

  // Spin the wheel once when a new "spinning" event arrives
  useEffect(() => {
    if (
      step === "spinning" &&
      chosenName &&
      event?.id &&
      event.id !== spunIdRef.current
    ) {
      spunIdRef.current = event.id;
      setPhase("spinning");
      const t = setTimeout(() => {
        wheelRef.current?.spinTo({ name: chosenName });
      }, 60);
      return () => clearTimeout(t);
    } else if (step === "reveal") {
      setPhase("reveal");
    } else if (step === "done") {
      setPhase("done");
    }
  }, [step, event?.id, chosenName]);

  if (phase === "done" || !event) {
    return null;
  }

  if (phase === "spinning") {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <DecayWheel ref={wheelRef} cards={wheelCards} art={wheelArt} />
      </div>
    );
  }

  // reveal
  const oldImg = event.card_removed
    ? revealArt[event.card_removed]?.normal
    : null;
  const newImg = event.replacement_card
    ? revealArt[event.replacement_card]?.normal
    : null;
  const rarityRoll = event.rarity_roll || null;

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ background: "transparent" }}
    >
      <style>{`
        @keyframes ovd-fadeout { from { opacity: 1; } to { opacity: 0; } }
        @keyframes ovd-slidein { from { transform: translateX(90px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <div
        style={{
          display: "flex",
          gap: "3rem",
          alignItems: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            animation: "ovd-fadeout 1.2s ease forwards",
          }}
        >
          {oldImg ? (
            <img
              src={oldImg}
              alt={event.card_removed}
              style={{ width: 200, borderRadius: 10, border: "1px solid #fff" }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 280,
                borderRadius: 10,
                background: "#334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                textAlign: "center",
                padding: "0 1rem",
              }}
            >
              {event.card_removed}
            </div>
          )}
          <span
            style={{
              color: "#fff",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            }}
          >
            REMOVED
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            animation: "ovd-slidein 0.8s ease forwards",
          }}
        >
          {newImg ? (
            <img
              src={newImg}
              alt={event.replacement_card}
              style={{
                width: 200,
                borderRadius: 10,
                border: "1px solid #fbbf24",
              }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 280,
                borderRadius: 10,
                background: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                textAlign: "center",
                padding: "0 1rem",
              }}
            >
              {event.replacement_card}
            </div>
          )}
          <span
            style={{
              color: "#fbbf24",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            }}
          >
            ADDED
          </span>
        </div>
        {rarityRoll && (
          <div
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "0.08em",
              textTransform: "capitalize",
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            }}
          >
            Rarity roll: {rarityRoll}
          </div>
        )}
      </div>
    </div>
  );
}