import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import DecayWheel from "@/components/decay/DecayWheel";
import OverlayDeck from "@/pages/OverlayDeck";

const RUST_TEXTURE =
  "https://media.base44.com/images/public/6ac605d777721f9149c6b225/3c387b3a0_image.png";

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

const CARD_W = 200;
const CARD_H = 280;

function CardImage({ src, alt, borderColor }) {
  if (!src) {
    return (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 10,
          background: "#334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          textAlign: "center",
          padding: "0 1rem",
          border: `1px solid ${borderColor || "#fff"}`,
        }}
      >
        {alt}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={{
        width: CARD_W,
        height: CARD_H,
        objectFit: "cover",
        borderRadius: 10,
        border: `1px solid ${borderColor || "#fff"}`,
        display: "block",
      }}
    />
  );
}

export default function OverlayDecay() {
  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState("done");
  const [landed, setLanded] = useState(false);
  const [wheelShown, setWheelShown] = useState(true);
  const [rarityText, setRarityText] = useState("");
  const [rollIndex, setRollIndex] = useState(0);
  const [rollGlow, setRollGlow] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [revealStage, setRevealStage] = useState(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [showDeck, setShowDeck] = useState(false);

  const wheelRef = useRef(null);
  const rarityTimer = useRef(null);
  const rollTimer = useRef(null);
  const rollActive = useRef(false);

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

  const wheelNames = Array.isArray(event?.wheel_card_names)
    ? event.wheel_card_names
    : [];
  const wheelIds = Array.isArray(event?.wheel_card_ids)
    ? event.wheel_card_ids
    : [];
  const wheelCards = wheelNames.map((name, i) => ({
    name,
    scryfall_id: wheelIds[i],
  }));
  const chosenName = event?.chosen_card || event?.card_removed || null;
  const removedImg = event?.card_removed_image || null;
  const replacementImg = event?.replacement_card_image || null;

  const wheelArt = useMemo(() => {
    const arts = Array.isArray(event?.wheel_card_art)
      ? event.wheel_card_art
      : [];
    const map = {};
    wheelNames.forEach((name, i) => {
      const id = wheelIds[i];
      if (id) map[id] = { artCrop: arts[i] || null };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.wheel_card_art, wheelNames.join("|"), wheelIds.join("|")]);

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

  // Drive each step
  useEffect(() => {
    if (!event) {
      setPhase("done");
      return;
    }
    const st = event.step || "done";
    setPhase(st);

    if (rarityTimer.current) {
      clearTimeout(rarityTimer.current);
      rarityTimer.current = null;
    }
    if (rollTimer.current) {
      clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
    rollActive.current = false;

    if (st === "spinning") {
      setLanded(false);
      setWheelShown(true);
      setRevealStage(null);
      setFadingOut(false);
      setShowDeck(false);
      return;
    }
    // Past spinning -> the chosen card is visible
    setLanded(true);
    if (st === "rarity") {
      startRarityFlip();
      return;
    }
    if (st === "rolling") {
      startRolling();
      return;
    }
    // reveal / done handled by their own effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.step]);

  // Spin the wheel shortly after it fades in
  useEffect(() => {
    if (phase !== "spinning" || !chosenName) return;
    const t = setTimeout(() => {
      wheelRef.current?.spinTo({ name: chosenName });
    }, 600);
    return () => clearTimeout(t);
  }, [phase, chosenName]);

  // Fade the wheel out once the chosen card is up
  useEffect(() => {
    if (!landed) return;
    const t = setTimeout(() => setWheelShown(false), 500);
    return () => clearTimeout(t);
  }, [landed]);

  // Reveal sequence: rust -> knock -> hold -> fade to deck
  useEffect(() => {
    if (phase !== "reveal") return;
    setRevealStage("rust");
    const t1 = setTimeout(() => setRevealStage("knock"), 1500);
    const t2 = setTimeout(() => setRevealStage("hold"), 2200);
    const t3 = setTimeout(() => setFadingOut(true), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase]);

  useEffect(() => {
    if (!fadingOut) return;
    const t = setTimeout(() => setShowDeck(true), 600);
    return () => clearTimeout(t);
  }, [fadingOut]);

  useEffect(
    () => () => {
      rollActive.current = false;
      if (rarityTimer.current) clearTimeout(rarityTimer.current);
      if (rollTimer.current) clearTimeout(rollTimer.current);
    },
    []
  );

  const handleLand = () => setLanded(true);

  if (showDeck) {
    return (
      <div style={{ animation: "od-deckin 0.6s ease forwards" }}>
        <OverlayDeck outro />
      </div>
    );
  }

  if (phase === "done" || !event) return null;

  const chosenAnim =
    phase === "reveal" && (revealStage === "knock" || revealStage === "hold")
      ? "od-knockoff 0.7s ease forwards"
      : "od-chosenin 0.5s ease";

  const rc = (event.roll_cards || [])[rollIndex];

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{
        background: "transparent",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 0.6s ease",
      }}
    >
      <style>{`
        @keyframes od-wheelin { from { opacity: 0; } to { opacity: 1; } }
        @keyframes od-chosenin { from { opacity: 0; transform: translate(-50%,-50%) scale(0.96); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
        @keyframes od-rustspread { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes od-drain { from { filter: none; } to { filter: grayscale(1) sepia(0.45) brightness(0.7); } }
        @keyframes od-knockoff { from { transform: translate(-50%,-50%) translateX(0) rotate(0); opacity: 1; } to { transform: translate(-50%,-50%) translateX(-460px) rotate(-35deg); opacity: 0; } }
        @keyframes od-flyin { 0% { transform: translate(-50%,-50%) translateX(560px); opacity: 0; } 70% { transform: translate(-50%,-50%) translateX(-14px); opacity: 1; } 100% { transform: translate(-50%,-50%) translateX(0); opacity: 1; } }
        @keyframes od-salvagedin { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes od-deckin { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ov-glow { 0%,100% { box-shadow: 0 0 18px 6px rgba(251,191,36,0.75); } 50% { box-shadow: 0 0 34px 12px rgba(251,191,36,1); } }
      `}</style>
      <div style={{ position: "relative", width: 760, height: 480 }}>
        {/* Spinning wheel */}
        {wheelShown && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              opacity: landed ? 0 : 1,
              transition: "opacity 0.5s ease",
              animation: "od-wheelin 0.6s ease",
            }}
          >
            <DecayWheel
              ref={wheelRef}
              cards={wheelCards}
              art={wheelArt}
              onLand={handleLand}
            />
          </div>
        )}

        {/* Chosen / removed card (stays through rarity/rolling/reveal) */}
        {landed && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: CARD_W,
              height: CARD_H,
              animation: chosenAnim,
            }}
          >
            <img
              src={removedImg}
              alt={event.card_removed || ""}
              draggable={false}
              style={{
                width: CARD_W,
                height: CARD_H,
                objectFit: "cover",
                borderRadius: 10,
                border: "1px solid #fff",
                display: "block",
                animation:
                  phase === "reveal" ? "od-drain 1.5s ease forwards" : "none",
              }}
            />
            {phase === "reveal" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 10,
                  backgroundImage: `url(${RUST_TEXTURE})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transformOrigin: "left center",
                  animation: "od-rustspread 1.5s ease forwards",
                  opacity: 0.9,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        )}

        {/* Rarity / rolling action, beside the chosen card */}
        {(phase === "rarity" || phase === "rolling") && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%) translateX(240px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {phase === "rarity" && (
              <span
                style={{
                  fontSize: "2.4rem",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  color: "#fbbf24",
                  textShadow: "0 2px 6px rgba(0,0,0,0.9)",
                  fontFamily: "sans-serif",
                }}
              >
                {rarityText}
              </span>
            )}
            {phase === "rolling" &&
              (preloading ? (
                <div className="w-6 h-6 border-4 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
              ) : rc ? (
                <div
                  style={{
                    borderRadius: 12,
                    lineHeight: 0,
                    animation: rollGlow
                      ? "ov-glow 1s ease-in-out infinite"
                      : "none",
                  }}
                >
                  <CardImage
                    src={rc.image_url}
                    alt={rc.name}
                    borderColor={rollGlow ? "#fbbf24" : "#fff"}
                  />
                </div>
              ) : null)}
          </div>
        )}

        {/* Replacement card flies in and settles */}
        {phase === "reveal" &&
          (revealStage === "knock" || revealStage === "hold") && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: CARD_W,
                height: CARD_H,
                animation: "od-flyin 0.7s cubic-bezier(0.2,0.8,0.3,1.05) forwards",
              }}
            >
              <CardImage
                src={replacementImg}
                alt={event.replacement_card || ""}
                borderColor="#fbbf24"
              />
              <div
                style={{
                  position: "absolute",
                  top: -1,
                  right: 6,
                  padding: "2px 6px",
                  borderRadius: 8,
                  background: "#2d8a4e",
                  color: "#fff",
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  animation: "od-salvagedin 0.3s ease 0.5s both",
                }}
              >
                SALVAGED
              </div>
            </div>
          )}
      </div>
    </div>
  );
}