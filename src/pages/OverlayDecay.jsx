import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import DecayWheel from "@/components/decay/DecayWheel";
import useCardArt from "@/hooks/useCardArt";

const preloadImages = (urls) =>
  Promise.all(
    urls.map(
      (u) =>
        new Promise((res) => {
          if (!u) return res();
          const img = new Image();
          img.onload = () => res();
          img.onerror = () => res();
          img.src = u;
        })
    )
  );

export default function OverlayDecay() {
  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState("done");
  const [rarityText, setRarityText] = useState("");
  const [rollIndex, setRollIndex] = useState(0);
  const [rollGlow, setRollGlow] = useState(false);
  const [preloading, setPreloading] = useState(false);

  const wheelRef = useRef(null);
  const playedRef = useRef(null);
  const rarityTimer = useRef(null);
  const rollTimer = useRef(null);
  const rollActive = useRef(false);

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

  const startRarityFlip = () => {
    const target = (event?.rarity_roll || "uncommon").toUpperCase();
    let toggle = 0;
    let d = 70;
    const tick = () => {
      setRarityText(toggle % 2 === 0 ? "UNCOMMON" : "COMMON");
      toggle++;
      if (d < 200) {
        d += 14;
        rarityTimer.current = setTimeout(tick, d);
      } else {
        setRarityText(target);
      }
    };
    tick();
  };

  const startRolling = async () => {
    const rollCards = Array.isArray(event?.roll_cards) ? event.roll_cards : [];
    if (rollCards.length === 0) return;
    rollActive.current = true;
    setRollIndex(0);
    setRollGlow(false);
    setPreloading(true);
    await preloadImages(rollCards.map((c) => c.image_url).filter(Boolean));
    if (!rollActive.current) return;
    setPreloading(false);

    const n = rollCards.length;
    const ticks = 26;
    const gaps = ticks - 1;
    const firstDelay = 40;
    const lastDelay = 280;
    let i = 0;
    const showTick = () => {
      if (!rollActive.current) return;
      setRollIndex(i % n);
      setRollGlow(i === ticks - 1);
      if (i < gaps) {
        const d = firstDelay + ((lastDelay - firstDelay) * i) / (gaps - 1);
        i++;
        rollTimer.current = setTimeout(showTick, d);
      }
    };
    showTick();
  };

  // Drive each step once per (event id, step)
  useEffect(() => {
    if (!event) {
      setPhase("done");
      return;
    }
    const key = event.id + ":" + step;
    if (playedRef.current === key) return;
    playedRef.current = key;

    if (rarityTimer.current) {
      clearTimeout(rarityTimer.current);
      rarityTimer.current = null;
    }
    if (rollTimer.current) {
      clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
    rollActive.current = false;

    if (step === "spinning" && chosenName) {
      setPhase("spinning");
      const t = setTimeout(() => {
        wheelRef.current?.spinTo({ name: chosenName });
      }, 60);
      return () => clearTimeout(t);
    }
    if (step === "rarity") {
      setPhase("rarity");
      startRarityFlip();
      return;
    }
    if (step === "rolling") {
      setPhase("rolling");
      startRolling();
      return;
    }
    if (step === "reveal") {
      setPhase("reveal");
      return;
    }
    setPhase("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, step, chosenName]);

  // Clean up timers on unmount
  useEffect(
    () => () => {
      rollActive.current = false;
      if (rarityTimer.current) clearTimeout(rarityTimer.current);
      if (rollTimer.current) clearTimeout(rollTimer.current);
    },
    []
  );

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

  if (phase === "rarity") {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <span
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#fbbf24",
            textShadow: "0 2px 6px rgba(0,0,0,0.9)",
            fontFamily: "sans-serif",
          }}
        >
          {rarityText}
        </span>
      </div>
    );
  }

  if (phase === "rolling") {
    const rc = (event.roll_cards || [])[rollIndex];
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <style>{`
          @keyframes ovd-glow { 0%,100% { box-shadow: 0 0 18px 6px rgba(251,191,36,0.75); } 50% { box-shadow: 0 0 34px 12px rgba(251,191,36,1); } }
        `}</style>
        {preloading ? (
          <div className="w-6 h-6 border-4 border-slate-300 border-t-amber-500 rounded-full animate-spin"></div>
        ) : rc ? (
          <div
            style={{
              borderRadius: 12,
              animation: rollGlow ? "ovd-glow 1s ease-in-out infinite" : "none",
              lineHeight: 0,
            }}
          >
            {rc.image_url ? (
              <img
                src={rc.image_url}
                alt={rc.name}
                style={{
                  width: 240,
                  borderRadius: 12,
                  border: rollGlow ? "2px solid #fbbf24" : "1px solid #fff",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: 240,
                  height: 336,
                  borderRadius: 12,
                  background: "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  textAlign: "center",
                  padding: "0 1rem",
                }}
              >
                {rc.name}
              </div>
            )}
          </div>
        ) : null}
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