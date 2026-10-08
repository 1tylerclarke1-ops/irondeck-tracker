import React, { useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import DeathWheel from "@/components/overlay/DeathWheel";
import DeathCardFrame from "@/components/overlay/DeathCardFrame";
import { goldText, steelText, irondeckText } from "@/lib/overlayText";

const DEATH_RUN =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/102bb0e38_death-run.png";

const INTRO_MS = 500;
const COUNTDOWN_FROM = 5;
const WHEEL_HOLD_MS = 2000;
const CARDS_IN_MS = 600;
const ROLL_MS = 5000;
const DRAIN_MS = 1500;
const KNOCK_MS = 700;
const CENTERED_MS = 500;
const VERIFIED_MS = 4000;
const OUTRO_MS = 600;

const PANEL_W = 800;
const PANEL_H = 900;

const VIGNETTE =
  "radial-gradient(ellipse at center, rgba(20,8,32,0.2) 0%, rgba(8,4,16,0.85) 70%, rgba(4,2,8,0.95) 100%)";

const collectUrls = (ev) => {
  const urls = [];
  (ev?.wheel_card_art || []).forEach((u) => u && urls.push(u));
  if (ev?.card_removed_image) urls.push(ev.card_removed_image);
  if (ev?.replacement_card_image) urls.push(ev.replacement_card_image);
  (ev?.roll_cards || []).forEach((c) => c?.image_url && urls.push(c.image_url));
  urls.push(DEATH_RUN);
  return [...new Set(urls)];
};

const preloadImages = (urls) =>
  Promise.all(
    urls.map(
      (u) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res();
          img.onerror = () => res();
          img.src = u;
        })
    )
  );

const pad = (n) => String(n).padStart(2, "0");

export default function OverlayDeath() {
  const [event, setEvent] = useState(null);
  const [seq, setSeq] = useState(null);
  const [season, setSeason] = useState(null);
  const [climb, setClimb] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [preloaded, setPreloaded] = useState(false);
  const [rollIndex, setRollIndex] = useState(0);
  const [rollGlow, setRollGlow] = useState(false);
  const [rarityText, setRarityText] = useState("");
  const [stampTime, setStampTime] = useState(null);

  const wheelRef = useRef(null);
  const playedFor = useRef(null);
  const eventIdRef = useRef(null);

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

  // Poll latest DecayEvent every second
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await base44.entities.DecayEvent.list("-updated_date", 1);
        if (active) setEvent(list && list.length ? list[0] : null);
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

  // Load season + climb for the verified stamp
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const seasons = await base44.entities.Season.filter({ status: "active" });
        const climbs = await base44.entities.Climb.list();
        if (!active) return;
        setSeason(seasons && seasons[0] ? seasons[0] : null);
        const sorted = [...climbs].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        setClimb(sorted[0] || null);
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  const day = useMemo(() => {
    if (!climb) return null;
    if (climb.status === "active" && climb.start_date)
      return differenceInCalendarDays(new Date(), new Date(climb.start_date)) + 1;
    if (climb.status === "complete") return climb.days_taken || null;
    return null;
  }, [climb]);

  // Start the sequence when a "death" event arrives
  useEffect(() => {
    if (event && event.step === "death" && playedFor.current !== event.id) {
      playedFor.current = event.id;
      eventIdRef.current = event.id;
      setSeq(event);
      setPreloaded(false);
      setRollIndex(0);
      setRollGlow(false);
      setRarityText("");
      setPhase("intro");
      preloadImages(collectUrls(event)).then(() => setPreloaded(true));
    }
  }, [event]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdown(COUNTDOWN_FROM);
    let c = COUNTDOWN_FROM;
    const id = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(id);
        setPhase(preloaded ? "spinning" : "preloadHold");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Wait for preload if countdown finished early
  useEffect(() => {
    if (phase === "preloadHold" && preloaded) setPhase("spinning");
  }, [phase, preloaded]);

  // Spin the wheel
  useEffect(() => {
    if (phase === "spinning" && wheelRef.current && seq) {
      const chosen = seq.chosen_card || seq.card_removed || null;
      if (chosen) wheelRef.current.spinTo({ name: chosen });
    }
  }, [phase, seq]);

  const handleLand = () => setPhase("wheelHold");

  // Phase timers
  useEffect(() => {
    if (phase === "intro") {
      const t = setTimeout(() => setPhase("countdown"), INTRO_MS);
      return () => clearTimeout(t);
    }
    if (phase === "wheelHold") {
      const t = setTimeout(() => setPhase("cardsIn"), WHEEL_HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === "cardsIn") {
      const t = setTimeout(() => setPhase("rolling"), CARDS_IN_MS);
      return () => clearTimeout(t);
    }
    if (phase === "drain") {
      const t = setTimeout(() => setPhase("knock"), DRAIN_MS);
      return () => clearTimeout(t);
    }
    if (phase === "knock") {
      const t = setTimeout(() => setPhase("centered"), KNOCK_MS);
      return () => clearTimeout(t);
    }
    if (phase === "centered") {
      const t = setTimeout(() => setPhase("holding"), CENTERED_MS);
      return () => clearTimeout(t);
    }
    if (phase === "verified") {
      setStampTime(new Date());
      const t = setTimeout(() => setPhase("outro"), VERIFIED_MS);
      return () => clearTimeout(t);
    }
    if (phase === "outro") {
      if (eventIdRef.current) {
        base44.functions
          .invoke("markDecayEventDone", { id: eventIdRef.current })
          .catch(() => {});
      }
      const t = setTimeout(() => setPhase("done"), OUTRO_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Rolling: rarity flip + decoy flicker
  useEffect(() => {
    if (phase !== "rolling") return;
    const cards = seq?.roll_cards || [];
    const n = cards.length;
    const timers = [];
    if (n === 0) {
      const t = setTimeout(() => setPhase("drain"), 100);
      timers.push(t);
      return () => timers.forEach(clearTimeout);
    }
    const target = (seq?.rarity_roll || "uncommon").toUpperCase();
    let toggle = 0;
    let d = 70;
    const rarityTick = () => {
      setRarityText(toggle % 2 === 0 ? "UNCOMMON" : "COMMON");
      toggle++;
      if (d < 200) {
        d += 14;
        timers.push(setTimeout(rarityTick, d));
      } else {
        setRarityText(target);
        startFlicker();
      }
    };
    const startFlicker = () => {
      setRollIndex(0);
      setRollGlow(false);
      const ticks = 22;
      const gaps = ticks - 1;
      const firstDelay = 40;
      const lastDelay = 300;
      let ti = 0;
      const showTick = () => {
        setRollIndex(ti % n);
        setRollGlow(ti === ticks - 1);
        if (ti < gaps) {
          const dd = firstDelay + ((lastDelay - firstDelay) * ti) / (gaps - 1);
          ti++;
          timers.push(setTimeout(showTick, dd));
        }
      };
      showTick();
    };
    rarityTick();
    const to = setTimeout(() => setPhase("drain"), ROLL_MS);
    timers.push(to);
    return () => timers.forEach(clearTimeout);
  }, [phase, seq]);

  // Hold until the step becomes "verified"
  useEffect(() => {
    if (phase === "holding" && event?.step === "verified") setPhase("verified");
  }, [phase, event]);

  // Derived data from the captured sequence
  const wheelCards = useMemo(() => {
    const names = seq?.wheel_card_names || [];
    const ids = seq?.wheel_card_ids || [];
    return names.map((name, i) => ({ name, scryfall_id: ids[i] }));
  }, [seq]);
  const artMap = useMemo(() => {
    const ids = seq?.wheel_card_ids || [];
    const arts = seq?.wheel_card_art || [];
    const map = {};
    ids.forEach((id, i) => {
      if (id) map[id] = { artCrop: arts[i] || null };
    });
    return map;
  }, [seq]);

  const removedName = seq?.card_removed || seq?.chosen_card || null;
  const removedImg = seq?.card_removed_image || null;
  const replacementName =
    seq?.replacement_card ||
    (seq?.roll_cards && seq.roll_cards.length
      ? seq.roll_cards[seq.roll_cards.length - 1].name
      : null);
  const replacementImg = seq?.replacement_card_image || null;
  const rollCards = seq?.roll_cards || [];

  const showWheel = [
    "intro",
    "countdown",
    "spinning",
    "wheelHold",
    "cardsIn",
  ].includes(phase);
  const showCards = [
    "cardsIn",
    "rolling",
    "drain",
    "knock",
    "centered",
    "holding",
    "verified",
  ].includes(phase);

  const rightCentered = ["knock", "centered", "holding", "verified"].includes(
    phase
  );
  const leftHidden = ["centered", "holding", "verified", "outro"].includes(
    phase
  );
  const leftKnock = phase === "knock";
  const draining = ["drain", "knock", "centered", "holding", "verified"].includes(
    phase
  );

  const rightImage =
    phase === "rolling"
      ? rollCards[rollIndex]?.image_url || replacementImg
      : replacementImg;
  const rightLabel =
    phase === "rolling" ? (rollGlow ? "SCAVENGED" : null) : "SCAVENGED";

  const showBottom = ["centered", "holding", "verified"].includes(phase);
  const fadingOut = phase === "outro";

  const stampLabel = stampTime
    ? `SEASON ${season?.season_number ?? "—"} · DAY ${day ?? "—"} · ${pad(
        stampTime.getHours()
      )}:${pad(stampTime.getMinutes())}`
    : "";

  if (phase === "idle" || phase === "done") return null;

  return (
    <div className="w-screen h-screen" style={{ background: "transparent" }}>
      <style>{`
        @keyframes odVignetteIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes odPanelRise { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes odWheelShrink { from { transform: scale(1); opacity: 1; } to { transform: scale(0.55); opacity: 0; } }
        @keyframes odCardInLeft { from { transform: translateX(-120px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes odCardInRight { from { transform: translateX(120px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes odKnockoff { from { transform: translateX(0) rotate(0); opacity: 1; } to { transform: translateX(-380px) rotate(-28deg); opacity: 0; } }
        @keyframes odStampIn { 0% { transform: translate(-50%,-50%) scale(2.4) rotate(-12deg); opacity: 0; } 100% { transform: translate(-50%,-50%) scale(1) rotate(-5deg); opacity: 1; } }
        @keyframes odFadeOut { from { opacity: 1; } to { opacity: 0; } }
      `}</style>

      {/* Vignette */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: VIGNETTE,
          opacity: fadingOut ? 0 : 1,
          animation: fadingOut
            ? "odFadeOut 0.6s ease forwards"
            : "odVignetteIn 0.5s ease",
          transition: fadingOut ? "opacity 0.6s ease" : "none",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: PANEL_W,
          height: PANEL_H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "rgba(8,6,14,0.92)",
          border: "3px solid #6b4a9a",
          borderRadius: 16,
          boxShadow: "0 0 44px 10px rgba(107,74,154,0.5)",
          opacity: fadingOut ? 0 : 1,
          animation: fadingOut
            ? "odFadeOut 0.6s ease forwards"
            : "odPanelRise 0.5s ease",
          transition: fadingOut ? "opacity 0.6s ease" : "none",
          overflow: "hidden",
        }}
      >
        {/* DEATH RUN title */}
        <img
          src={DEATH_RUN}
          alt="DEATH RUN"
          draggable={false}
          style={{ width: 300, height: "auto", marginTop: 34, pointerEvents: "none" }}
        />

        {/* Wheel area */}
        {showWheel && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              animation:
                phase === "cardsIn" ? "odWheelShrink 0.6s ease forwards" : "none",
            }}
          >
            <DeathWheel
              ref={wheelRef}
              cards={wheelCards}
              art={artMap}
              onLand={handleLand}
            />
            {phase === "countdown" && (
              <div style={goldText(30)}>
                {countdown > 0 ? `AUTO-SPIN IN ${countdown}` : "SPINNING..."}
              </div>
            )}
            {phase === "spinning" && (
              <div style={steelText(26)}>SPINNING...</div>
            )}
          </div>
        )}

        {/* Cards area */}
        {showCards && (
          <div
            style={{
              position: "relative",
              width: PANEL_W,
              height: 420,
              marginTop: 18,
            }}
          >
            {/* Rarity flip text */}
            {phase === "rolling" && rarityText && (
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  ...goldText(26),
                }}
              >
                {rarityText}
              </div>
            )}

            {/* Left (rotted) frame */}
            <DeathCardFrame
              image={removedImg}
              name={removedName}
              label="ROTTED"
              tone="rot"
              drained={draining}
              style={{
                position: "absolute",
                left: 130,
                top: 30,
                opacity: leftHidden ? 0 : 1,
                animation: leftKnock
                  ? "odKnockoff 0.7s ease forwards"
                  : phase === "cardsIn"
                  ? "odCardInLeft 0.6s ease"
                  : "none",
              }}
            />

            {/* Right (replacement) frame */}
            <DeathCardFrame
              image={rightImage}
              name={rightImage ? replacementName : rollCards[rollIndex]?.name || replacementName}
              label={rightLabel}
              tone="gold"
              style={{
                position: "absolute",
                left: rightCentered ? 280 : 430,
                top: 30,
                transition: "left 0.7s cubic-bezier(0.2,0.8,0.3,1)",
                animation:
                  phase === "cardsIn" ? "odCardInRight 0.6s ease" : "none",
              }}
            />

            {/* Bottom text */}
            {showBottom && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={goldText(26)}>
                  REMOVE 1 {removedName} · ADD 1 {replacementName}
                </div>
                <div style={steelText(20)}>Update your deck in Arena</div>
              </div>
            )}
          </div>
        )}

        {/* Verified stamp */}
        {phase === "verified" && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              textAlign: "center",
              animation: "odStampIn 0.35s cubic-bezier(0.15,0.9,0.3,1) both",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                padding: "20px 56px",
                borderRadius: 16,
                background: "rgba(8,6,14,0.85)",
                border: "3px solid #d68c3c",
                boxShadow: "0 0 30px 8px rgba(214,140,60,0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={goldText(48)}>DECK VERIFIED ✓</div>
              <div style={steelText(22)}>{stampLabel}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}