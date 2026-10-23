import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { liveReload } from "@/lib/liveReload";
import { demoDeathEvent, isDemoDeath } from "@/lib/demoDeath";
import DeathWheel from "@/components/overlay/DeathWheel";
import DeathCardFrame from "@/components/overlay/DeathCardFrame";
import { goldText, steelText, purpleText } from "@/lib/overlayText";

const PRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const DEATH_RUN = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/aed9fb1b2_irondeck-deathrun-emblem.webp";
const DEATH_VIGNETTE = `${PRE}be70dc153_death-vignette.png`;
const DEATH_PANEL = `${PRE}43f34a533_death-panel.png`;

// Death screen: the gold frame appears, then rot spreads across it from the sidebar side
const DF_GOLD = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/130900cf6_irondeck-survived-aligned-for-rot.webp";
const DF_ROT = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/bddf3495c_irondeck-corrupted-background.webp";
const DF_ROT_AT = 3.4; // seconds: rot starts spreading from the centre (with DEATH RUN)
const DF_ROT_S = 2.4; // seconds: how long the rot takes to reach the corners
const DF_GEMS = [ { x: 50, y: 16 }, { x: 2.4, y: 43 }, { x: 97.2, y: 43 }, { x: 50, y: 72 } ];
// when the spreading rot reaches a gem (its distance from the centre of the 1440×810 window)
const dfGemRotAt = (g) => DF_ROT_AT + DF_ROT_S * Math.hypot((g.x - 50) * 14.4, (g.y - 50) * 8.1) / 876;
if (typeof Image !== "undefined") { new Image().src = DF_GOLD; new Image().src = DF_ROT; }

// ---- Timeline ---------------------------------------------------------------
// waiting    DEATH RUN banner slams in at the centre
// intro      banner docks as the panel title while the panel rises
// countdown  wheel shows, "AUTO-SPIN IN 5"
// spinning   wheel spins and lands on the rotted card
// wheelHold  pause on the result
// hostage    rotted card slides in on the left; the right slot is a mystery "?"
// rarity     COMMON / UNCOMMON flips, slows down and locks
// randomise  mystery fades into the randomiser (blurred while fast), lands on
//            the scavenged card
// drain      rotted card drains of colour
// knock      rotted card is knocked off; scavenged card moves to the centre
// sideRot    (only if the sideboard rotted)
// centered / holding  result stays on screen for RESULT_HOLD_MS
// outro      panel drops away
// away       nothing on screen; waits for the deck to be verified
// verifiedNote  small "DECK VERIFIED · next round ready" notice, then done
const FRESH_MS = 30 * 60 * 1000; // only play a death from the last 30 minutes
const RUN_FRESH_MS = 2 * 60 * 1000; // a run that died in the last 2 minutes shows the banner straight away
const POLL_MS = 1500;
const PENDING_GIVE_UP_MS = 45000; // banner gives up if the rot never arrives
const DEATH_DELAY_MS = 1100; // banner slam + short hold; wheel is ready ~2s after the death
const SIDEBAR_MS = 18500; // the sidebar's execution and scavenge (ChoppingBlock); the result shows after it
// New flow: purple blanket + DEATH RUN while the sidebar executes the card, then the
// scavenged card flies out of the sidebar and expands into the middle of the game.
const FLY_AT_MS = 18800; // sidebar lead-in (OverlayDeck ROT_LEAD_MS 2000) + its scavenged card landing (ChoppingBlock T_LAND + 600)
const SCAV_HOLD_MS = 6000; // the scavenged card stays big in the middle
const INTRO_MS = 1200; // panel rises, then the wheel grows in
const COUNTDOWN_FROM = 3;
const WHEEL_HOLD_MS = 2000;
const HOSTAGE_MS = 1500;
const RARITY_LOCK_MS = 1000; // pause after the rarity locks
const RESULT_PAUSE_MS = 1500; // pause after the scavenged card lands
const DRAIN_MS = 1500;
const KNOCK_MS = 700;
const SIDE_ROT_MS = 2000;
const CENTERED_MS = 500;
const RESULT_HOLD_MS = 3500; // how long the final result stays up
const OUTRO_MS = 800;
const NOTE_MS = 5000; // how long the "deck verified" notice stays up

const DOCK_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // same glide as the intro badge
const TITLE_W = 700;
const STAMP_W = 520;
const PANEL_W = 920;
const PANEL_H = 1020;
const CARD_W = 240;
const CARD_H = 336;
const WHEEL_PX = 540; // on-screen wheel size (DeathWheel draws at 288px)
const WHEEL_BASE = 288;
const PLAYED_KEY = "irondeck-death-played";

// Base44 timestamps can lack a time zone ("2026-10-11T20:35:12"); they are UTC.
const toMs = (v) => {
  if (!v) return 0;
  const s = String(v);
  return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`).getTime();
};

// Remember which deaths have played, so an OBS refresh doesn't replay one.
const readPlayed = () => {
  try {
    return localStorage.getItem(PLAYED_KEY) || null;
  } catch {
    return null;
  }
};
const writePlayed = (id) => {
  try {
    localStorage.setItem(PLAYED_KEY, id);
  } catch {
    // ignore
  }
};

const collectUrls = (ev) => {
  const urls = [];
  (ev?.wheel_card_art || []).forEach((u) => u && urls.push(u));
  if (ev?.card_removed_image) urls.push(ev.card_removed_image);
  if (ev?.replacement_card_image) urls.push(ev.replacement_card_image);
  (ev?.roll_cards || []).forEach((c) => c?.image_url && urls.push(c.image_url));
  urls.push(DEATH_RUN, DEATH_VIGNETTE, DEATH_PANEL);
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

const CARDS_PHASES = [
  "hostage", "rarity", "randomise", "drain", "knock", "sideRot", "centered", "holding", "outro",
];
const WHEEL_PHASES = ["intro", "countdown", "preloadHold", "spinning", "wheelHold"];
const MYSTERY_PHASES = ["hostage", "rarity"];
const RIGHT_CENTRED = ["knock", "sideRot", "centered", "holding", "outro"];
const LEFT_HIDDEN = ["sideRot", "centered", "holding", "outro"];
const DRAINING = ["drain", "knock", "centered", "holding", "outro"];
const BOTTOM_PHASES = ["centered", "holding", "outro"];

export default function OverlayDeath() {
  const [event, setEvent] = useState(null);
  const [deadRun, setDeadRun] = useState(null);
  const [seq, setSeq] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [preloaded, setPreloaded] = useState(false);
  const [rarityText, setRarityText] = useState("");
  const [rarityLocked, setRarityLocked] = useState(false);
  const [rollImage, setRollImage] = useState(null);
  const [rollBlur, setRollBlur] = useState(false);
  const [rollLanded, setRollLanded] = useState(false);
  const [nextRound, setNextRound] = useState(false);

  const wheelRef = useRef(null);
  const playedFor = useRef(readPlayed());
  const eventIdRef = useRef(null);
  const bannerFor = useRef(null); // run id the banner was shown for
  const bannerStart = useRef(0);

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

  // Poll the latest DecayEvent for the ACTIVE season only
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const seasons = await base44.entities.Season.filter({ status: "active" });
        const s = seasons && seasons[0];
        if (!s) {
          if (active) setEvent(null);
          return;
        }
        const [list, runs] = await Promise.all([
          base44.entities.DecayEvent.filter({ season_id: s.id }, "-updated_date", 1),
          base44.entities.Run.filter({ season_id: s.id }),
        ]);
        if (!active) return;
        const demoCards = isDemoDeath ? await base44.entities.Card.filter({ season_id: s.id }) : null;
        if (!active) return;
        setEvent(demoDeathEvent(s, demoCards) || (list && list.length ? list[0] : null));
        setNextRound(!isDemoDeath && (runs || []).some((r) => r.round_status === "playing"));
        // A run that has just died: show the banner while the rot is worked out
        const died = (runs || [])
          .filter((r) => r.round_status === "died")
          .sort((a, b) => toMs(b.updated_date) - toMs(a.updated_date))[0];
        setDeadRun(
          died && Date.now() - toMs(died.updated_date) < RUN_FRESH_MS ? died : null
        );
      } catch {
        // keep last event on error
      }
    };
    const stopLive = liveReload(["Season", "DecayEvent", "Run"], load);
    return () => {
      active = false;
      stopLive();
    };
  }, []);

  // Second loss saved: slam the banner in straight away
  useEffect(() => {
    if (!deadRun || bannerFor.current === deadRun.id) return;
    if (phase !== "idle" && phase !== "done" && phase !== "away") return;
    // its rot already played (e.g. after an OBS refresh)
    if (event && event.run_id === deadRun.id && playedFor.current === event.id) {
      bannerFor.current = deadRun.id;
      return;
    }
    bannerFor.current = deadRun.id;
    bannerStart.current = Date.now();
    eventIdRef.current = null;
    setSeq(null);
    setPreloaded(false);
    setPhase("waiting");
  }, [deadRun, event, phase]);

  // The death screen holds (solid) on the scavenged card until the next round starts
  useEffect(() => {
    if (phase === "scavenge" && nextRound) setPhase("outro");
  }, [phase, nextRound]);

  // Loss undone while the banner waits: take it away again
  useEffect(() => {
    if (phase === "waiting" && !seq && !deadRun) setPhase("idle");
  }, [phase, seq, deadRun]);

  // Start the sequence when a fresh "death" event arrives
  useEffect(() => {
    const born = toMs(event?.updated_at) || toMs(event?.created_date);
    const fresh = event && Date.now() - born < FRESH_MS;
    if (event && event.step === "death" && fresh && playedFor.current !== event.id) {
      playedFor.current = event.id;
      writePlayed(event.id);
      eventIdRef.current = event.id;
      if (event.run_id) bannerFor.current = event.run_id;
      const bannerUp = phase === "waiting" && !seq;
      if (!bannerUp) bannerStart.current = Date.now();
      setSeq(event);
      setPreloaded(false);
      setRarityText("");
      setRarityLocked(false);
      setRollImage(null);
      setRollBlur(false);
      setRollLanded(false);
      if (!bannerUp) setPhase("waiting");
      preloadImages(collectUrls(event)).then(() => setPreloaded(true));
    }
  }, [event, phase, seq]);

  // After the result has gone: show the verified notice once the deck is verified
  useEffect(() => {
    if (phase !== "away" || !event) return;
    if (event.id !== eventIdRef.current) return setPhase("done");
    if (event.step === "verified") setPhase("verifiedNote");
    else if (event.step !== "death") setPhase("done");
  }, [phase, event]);

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

  useEffect(() => {
    if (phase === "preloadHold" && preloaded) setPhase("spinning");
  }, [phase, preloaded]);

  // Spin the wheel
  useEffect(() => {
    if (phase === "spinning" && wheelRef.current && seq) {
      const chosen = seq.chosen_card || seq.card_removed || null;
      if (chosen) wheelRef.current.spinTo({ name: chosen });
      else setPhase("wheelHold");
    }
  }, [phase, seq]);

  const handleLand = () => setPhase("wheelHold");

  // Banner: dock once the rot has arrived and the banner has had its moment
  useEffect(() => {
    if (phase !== "waiting") return;
    // The banner holds while the sidebar plays the execution, then goes
    // straight to the result (no wheel, rarity flip or randomiser here).
    const born = seq ? Date.parse(seq.updated_at || "") : NaN;
    const wait = seq
      ? Math.max(300, (Number.isFinite(born) ? born : bannerStart.current) + FLY_AT_MS - Date.now())
      : PENDING_GIVE_UP_MS;
    const t = setTimeout(() => setPhase(seq ? "scavenge" : "idle"), wait);
    return () => clearTimeout(t);
  }, [phase, seq]);

  // Fixed-length phases
  useEffect(() => {
    const next = {
      intro: ["countdown", INTRO_MS],
      wheelHold: ["hostage", WHEEL_HOLD_MS],
      hostage: ["rarity", HOSTAGE_MS],
      drain: ["knock", DRAIN_MS],
      knock: [seq?.sideboard_rotted ? "sideRot" : "centered", KNOCK_MS],
      sideRot: ["centered", SIDE_ROT_MS],
      centered: ["holding", CENTERED_MS],
      holding: ["outro", RESULT_HOLD_MS],
      outro: ["away", OUTRO_MS],
      verifiedNote: ["done", NOTE_MS],
    }[phase];
    if (!next) return;
    const t = setTimeout(() => setPhase(next[0]), next[1]);
    return () => clearTimeout(t);
  }, [phase, seq]);

  // The verified notice marks the event done (so it never shows again)
  useEffect(() => {
    if (phase === "verifiedNote" && eventIdRef.current) {
      base44.functions
        .invoke("markDecayEventDone", { id: eventIdRef.current })
        .catch(() => {});
    }
  }, [phase]);

  // Rarity: COMMON / UNCOMMON flips, slows down and locks on the result
  useEffect(() => {
    if (phase !== "rarity") return;
    const target = String(seq?.rarity_roll || "").toUpperCase();
    if (!target) {
      setPhase("randomise");
      return;
    }
    const other = target === "COMMON" ? "UNCOMMON" : "COMMON";
    const timers = [];
    let d = 60;
    let flips = 0;
    const tick = () => {
      flips += 1;
      setRarityText(flips % 2 ? other : target);
      if (d < 380 || flips % 2 === 0) {
        d = Math.round(d * 1.2);
        timers.push(setTimeout(tick, d));
      } else {
        timers.push(
          setTimeout(() => {
            setRarityText(target);
            setRarityLocked(true);
            timers.push(setTimeout(() => setPhase("randomise"), RARITY_LOCK_MS));
          }, d)
        );
      }
    };
    tick();
    return () => timers.forEach(clearTimeout);
  }, [phase, seq]);

  // Randomiser: cycles cards of that rarity (blurred while fast), then lands
  // on the scavenged card
  useEffect(() => {
    if (phase !== "randomise") return;
    const timers = [];
    const finalImg = seq?.replacement_card_image || null;
    const finalName = seq?.replacement_card || null;
    const decoys = (seq?.roll_cards || []).filter(
      (c) => c?.image_url && c.name !== finalName
    );
    const land = () => {
      setRollImage(finalImg);
      setRollBlur(false);
      setRollLanded(true);
      timers.push(setTimeout(() => setPhase("drain"), RESULT_PAUSE_MS));
    };
    if (decoys.length === 0) {
      timers.push(setTimeout(land, 600));
      return () => timers.forEach(clearTimeout);
    }
    const TICKS = 22;
    const FIRST = 45;
    const LAST = 320;
    let i = 0;
    const tick = () => {
      if (i >= TICKS) return land();
      const delay = FIRST + ((LAST - FIRST) * i) / (TICKS - 1);
      setRollImage(decoys[i % decoys.length].image_url);
      setRollBlur(delay < 120);
      i += 1;
      timers.push(setTimeout(tick, delay));
    };
    // let the mystery card fade out before the first decoy shows
    timers.push(setTimeout(tick, 350));
    return () => timers.forEach(clearTimeout);
  }, [phase, seq]);

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

  if (phase === "idle" || phase === "done" || phase === "away") return null;

  const removedName = seq?.card_removed || seq?.chosen_card || "";
  const removedImg = seq?.card_removed_image || null;
  const replacementName = seq?.replacement_card || "";
  const replacementImg = seq?.replacement_card_image || null;

  if (phase === "verifiedNote") {
    return (
      <VerifiedNote removedName={removedName} replacementName={replacementName} />
    );
  }

  const docked = !["waiting", "scavenge", "outro"].includes(phase); // the old result panel is no longer used
  const raised = phase === "scavenge" || phase === "outro";
  const leaving = phase === "outro";
  const showWheel = WHEEL_PHASES.includes(phase);
  const showCards = CARDS_PHASES.includes(phase);
  const mystery = MYSTERY_PHASES.includes(phase);
  const rightCentred = RIGHT_CENTRED.includes(phase);
  const resultShown = rollLanded || rightCentred;
  const rightImg = resultShown ? replacementImg : rollImage;
  const rightName = resultShown ? replacementName : "";

  return (
    <div className="w-screen h-screen" style={{ background: "transparent" }}>
      <style>{`
        @keyframes odVignetteIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes odFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes odPanelRise { 0% { transform: translate(-50%, 70vh); opacity: 0; } 25% { opacity: 1; } 70% { transform: translate(-50%, -54%); } 100% { transform: translate(-50%, -50%); opacity: 1; } }
        @keyframes odPanelDrop { 0% { transform: translate(-50%, -50%); opacity: 1; } 25% { transform: translate(-50%, -53%); } 100% { transform: translate(-50%, 70vh); opacity: 0; } }
        @keyframes odBannerSlam { 0% { transform: scale(2.5) rotate(-8deg); opacity: 0; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes odWheelShrink { from { transform: scale(1); opacity: 1; } to { transform: scale(0.55); opacity: 0; } }
        @keyframes odCardInLeft { from { transform: translateX(-120px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes odCardInRight { from { transform: translateX(120px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes odKnockoff { from { transform: translateX(0) rotate(0); opacity: 1; } to { transform: translateX(-380px) rotate(-28deg); opacity: 0; } }
        @keyframes odPulse { 0%, 100% { transform: scale(1); opacity: 0.75; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes odRarityPop { 0% { transform: scale(1.5); } 60% { transform: scale(0.94); } 100% { transform: scale(1); } }
        @keyframes odWheelIn { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes odTextIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes odSeep { 0% { clip-path: inset(0 100% 0 0); opacity: .4 } 100% { clip-path: inset(0 0 0 0); opacity: 1 } }
        @keyframes odVeins { from { transform: scale(1) } to { transform: scale(1.15) translate(-2%, 1%) } }
        @keyframes odSpore { 0% { opacity: 0; transform: translateY(0) } 20% { opacity: 1 } 100% { opacity: 0; transform: translateY(-240px) } }
        @keyframes odFly { 0% { transform: translate(-960px, 22px) scale(.625); opacity: .9 } 100% { transform: none; opacity: 1 } }
        @keyframes odGold { 0%,100% { box-shadow: 0 0 30px 8px rgba(255,170,60,.6) } 50% { box-shadow: 0 0 70px 22px rgba(255,190,90,1) } }
        @keyframes odLost { 0% { transform: translate(-720px, 60px) scale(.4); opacity: 0 } 12% { transform: none; opacity: 1 }
          16% { transform: scale(1.05) } 20%,84% { transform: none; opacity: 1 } 100% { transform: translate(-720px, 60px) scale(.45); opacity: 0 } }
        @keyframes odLostGlow { 0%,100% { box-shadow: 0 0 40px 10px rgba(150,80,255,.6) } 50% { box-shadow: 0 0 80px 26px rgba(150,80,255,1) } }
        @keyframes odLostShake { 0%,100% { margin-left: 0 } 25% { margin-left: -4px } 75% { margin-left: 4px } }
        @keyframes odLostText { 0%,10% { opacity: 0 } 18%,84% { opacity: 1 } 92%,100% { opacity: 0 } }
        @keyframes odLandPop { 0% { transform: scale(1); } 40% { transform: scale(1.07); } 100% { transform: scale(1); } }
      `}</style>

           {/* Solid death screen over the game window: black seeps in from the sidebar side, the gold
          frame rises, then rot spreads across it from the left and the gems turn from amber to purple.
          Holds until the next round starts. (Game window: x 480, y 270, 1440×810 of 1920×1080.) */}
      <style>{`
        @keyframes dfFrameIn { 0% { opacity: 0; filter: brightness(0); transform: scale(1.06) } 100% { opacity: 1; filter: brightness(1); transform: scale(1) } }
        @keyframes dfRot { from { clip-path: circle(0% at 50% 50%) } to { clip-path: circle(75% at 50% 50%) } }
        @keyframes dfEdge { 0% { width: 0%; opacity: 1 } 85% { opacity: 1 } 100% { width: 122%; opacity: 0 } }
        @keyframes dfIgnite { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.2) } 40% { opacity: 1; transform: translate(-50%, -50%) scale(1.8) } 100% { opacity: .8; transform: translate(-50%, -50%) scale(1) } }
        @keyframes dfOut { from { opacity: .8 } to { opacity: 0 } }
        @keyframes dfPulse { 0%, 100% { opacity: .8 } 50% { opacity: .35 } }
        @keyframes dfDrift { from { transform: translateX(-3%) scale(1.05) } to { transform: translateX(3%) scale(1.12) } }
        @keyframes dfFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dfGrow { 0% { transform: scale(0); opacity: 0; filter: brightness(2.5) blur(10px) }
          55% { transform: scale(1.06); opacity: 1; filter: brightness(1.3) blur(0) drop-shadow(0 0 30px rgba(150,80,255,1)) }
          100% { transform: scale(1); opacity: 1; filter: brightness(1) drop-shadow(0 0 22px rgba(150,80,255,.75)) } }
        @keyframes dfDeathGlow { 0%, 100% { filter: drop-shadow(0 0 22px rgba(150,80,255,.75)) } 50% { filter: drop-shadow(0 0 44px rgba(170,100,255,1)) } }
      `}</style>
      <div style={{ position: "fixed", left: "25vw", top: "25vh", width: "75vw", height: "75vh", pointerEvents: "none", overflow: "hidden", background: "#050208",
        animation: leaving ? "odFadeOut 0.8s ease forwards" : "odSeep 1s cubic-bezier(.3,.6,.3,1) both" }}>
        <div style={{ position: "absolute", inset: 0, animation: "dfFrameIn 1.2s cubic-bezier(.2,.8,.3,1) .3s both" }}>
          {/* Gold frame (the deck as it was) */}
          <img src={DF_GOLD} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }} />
          {DF_GEMS.map((g, i) => (
            <div key={"ga" + i} style={{ position: "absolute", left: g.x + "%", top: g.y + "%", width: "8%", aspectRatio: "1", borderRadius: "50%",
              mixBlendMode: "screen", background: "radial-gradient(circle, rgba(255,220,140,1), rgba(255,130,40,.7) 30%, transparent 68%)",
              animation: `dfIgnite .6s ease-out ${0.6 + i * 0.12}s both, dfOut .4s ease ${dfGemRotAt(g)}s forwards` }} />
          ))}
          {/* Rot spreading across from the sidebar side */}
          <div style={{ position: "absolute", inset: 0,
            animation: `dfRot ${DF_ROT_S}s linear ${DF_ROT_AT}s both` }}>
            <img src={DF_ROT} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none" }} />
            <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.45, animation: "dfDrift 9s ease-in-out infinite alternate",
              background: "radial-gradient(ellipse at 20% 70%, rgba(150,80,255,.35), transparent 35%), radial-gradient(ellipse at 80% 30%, rgba(170,90,255,.3), transparent 35%)" }} />
          </div>
          {/* The glowing edge of the rot */}
          <div style={{ position: "absolute", left: "50%", top: "50%", aspectRatio: "1", transform: "translate(-50%, -50%)", borderRadius: "50%",
            mixBlendMode: "screen", pointerEvents: "none",
            background: "radial-gradient(circle, transparent 58%, rgba(150,70,255,.5) 65%, rgba(220,170,255,.75) 69%, rgba(150,70,255,.5) 72%, transparent 76%)",
            animation: `dfEdge ${DF_ROT_S}s linear ${DF_ROT_AT}s both` }} />
          {DF_GEMS.map((g, i) => (
            <div key={"gp" + i} style={{ position: "absolute", left: g.x + "%", top: g.y + "%", width: "8%", aspectRatio: "1", borderRadius: "50%",
              mixBlendMode: "screen", background: "radial-gradient(circle, rgba(235,215,255,1), rgba(160,90,255,.75) 30%, transparent 68%)",
            animation: `dfIgnite .7s ease-out ${dfGemRotAt(g)}s both, dfPulse 2.4s ease-in-out ${dfGemRotAt(g) + 0.7}s infinite` }} />    
          ))}
        </div>
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: `${(i * 37) % 100}%`, top: `${40 + ((i * 53) % 60)}%`,
            width: 3 + (i % 3) * 3, height: 3 + (i % 3) * 3, borderRadius: "50%", background: "#d4baff",
            boxShadow: "0 0 10px 3px rgba(150,90,255,.9)", opacity: 0,
            animation: `odSpore ${4 + (i % 4)}s ease-out ${DF_ROT_AT + DF_ROT_S + ((i * 0.37) % 4)}s infinite` }} />
        ))}
      </div>

      {/* Panel (rises in as the banner docks, drops away at the end) */}
      {docked && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "62.5%", // centre of the game window (480 + 1440 / 2 = 1200px)
            transform: "translate(-50%,-50%)",
            width: PANEL_W,
            height: PANEL_H,
            animation: leaving
              ? "odPanelDrop 0.8s cubic-bezier(0.5, 0, 0.75, 0) forwards"
              : "odPanelRise 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) both",
          }}
        >
          <img
            src={DEATH_PANEL}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: PANEL_W,
              height: PANEL_H,
              objectFit: "fill",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              width: PANEL_W,
              height: PANEL_H,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Spacer where the docked DEATH RUN banner sits */}
            <img
              src={DEATH_RUN}
              alt=""
              draggable={false}
              style={{ width: TITLE_W, height: "auto", marginTop: 46, opacity: 0, pointerEvents: "none" }}
            />

            {/* Wheel: grows in once the panel has landed */}
            {showWheel && (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: WHEEL_PX,
                    height: WHEEL_PX,
                    animation: "odWheelIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.55s both",
                  }}
                >
                  <div
                    style={{
                      width: WHEEL_BASE,
                      height: WHEEL_BASE,
                      transform: `scale(${WHEEL_PX / WHEEL_BASE})`,
                      transformOrigin: "0 0",
                    }}
                  >
                    <DeathWheel ref={wheelRef} cards={wheelCards} art={artMap} onLand={handleLand} />
                  </div>
                </div>
                <div style={{ height: 40, animation: "odTextIn 0.4s ease 0.9s both" }}>
                  {phase === "countdown" && (
                    <div style={goldText(34)}>
                      {countdown > 0 ? `SPIN IN ${countdown}` : "SPIN!"}
                    </div>
                  )}
                  {(phase === "spinning" || phase === "preloadHold") && (
                    <div style={steelText(28)}>SPINNING...</div>
                  )}
                </div>
              </div>
            )}

            {/* Cards */}
            {showCards && (
              <div style={{ position: "relative", width: 800, height: 470, marginTop: 30 }}>
                {/* Rarity */}
                {(phase === "rarity" || (rarityLocked && !rightCentred)) && rarityText && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: 0,
                      right: 0,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      key={rarityLocked ? "locked" : "flip"}
                      style={{
                        ...(rarityLocked ? goldText(40) : steelText(34)),
                        letterSpacing: "4px",
                        animation: rarityLocked ? "odRarityPop 0.45s ease-out" : "none",
                      }}
                    >
                      {rarityText}
                    </div>
                  </div>
                )}

                {/* Left: the rotted card, held hostage */}
                <DeathCardFrame
                  image={removedImg}
                  name={removedName}
                  label="ROTTED"
                  tone="rot"
                  drained={DRAINING.includes(phase)}
                  style={{
                    position: "absolute",
                    left: 130,
                    top: 70,
                    opacity: LEFT_HIDDEN.includes(phase) ? 0 : 1,
                    animation:
                      phase === "knock"
                        ? "odKnockoff 0.7s ease forwards"
                        : phase === "hostage"
                        ? "odCardInLeft 0.6s ease"
                        : "none",
                  }}
                />

                {/* Right: mystery card, then the randomiser, then the scavenged card */}
                <div
                  style={{
                    position: "absolute",
                    left: rightCentred ? 280 : 430,
                    top: 70,
                    width: CARD_W,
                    height: CARD_H,
                    transition: "left 0.7s cubic-bezier(0.2,0.8,0.3,1)",
                    animation: phase === "hostage" ? "odCardInRight 0.6s ease 0.25s both" : "none",
                  }}
                >
                  <MysteryCard visible={mystery} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: mystery ? 0 : 1,
                      transition: "opacity 0.35s ease",
                    }}
                  >
                    <div
                      key={rollLanded ? "landed" : "rolling"}
                      style={{
                        filter: rollBlur ? "blur(3px) brightness(1.15)" : "none",
                        animation: rollLanded && !rightCentred ? "odLandPop 0.5s ease-out" : "none",
                      }}
                    >
                      <DeathCardFrame
                        image={rightImg}
                        name={rightName}
                        label={resultShown ? "SCAVENGED" : null}
                        tone="gold"
                      />
                    </div>
                  </div>
                </div>

                {phase === "sideRot" && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center" }}>
                    <span style={purpleText(40)}>THE SIDEBOARD ROTS</span>
                  </div>
                )}
                {BOTTOM_PHASES.includes(phase) && (
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
                      {seq?.sideboard_rotted ? " · Remove all sideboard cards" : ""}
                    </div>
                    <div style={steelText(20)}>Update your deck in Arena</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* While the sidebar executes the card, pull eyes to it: the sidebar lights up purple and
          glowing chevrons stream towards it from the game window. (Sidebar: x 0, y 270, 480×810.) */}
      {phase === "waiting" && (
        <>
          <style>{`
            @keyframes odSpot { 0%, 100% { box-shadow: inset 0 0 40px 6px rgba(150,80,255,.55), 0 0 30px 6px rgba(150,80,255,.5); border-color: rgba(200,150,255,.7) }
              50% { box-shadow: inset 0 0 80px 14px rgba(170,100,255,.9), 0 0 60px 14px rgba(170,100,255,.9); border-color: rgba(235,210,255,1) } }
            @keyframes odChev { 0% { opacity: 0; transform: translateX(40px) scale(.8) } 30% { opacity: 1 } 70% { opacity: 1 } 100% { opacity: 0; transform: translateX(-40px) scale(1.1) } }
          `}</style>
          <div style={{ position: "fixed", left: 0, top: 270, width: 480, height: 810, zIndex: 4, pointerEvents: "none", borderRadius: 6,
            border: "4px solid rgba(200,150,255,.7)", animation: "dfFadeIn .6s ease 5.8s both, odSpot 1.4s ease-in-out 5.8s infinite" }} />
          <div style={{ position: "fixed", left: 500, top: 615, zIndex: 4, pointerEvents: "none", display: "flex", gap: 6,
            animation: "dfFadeIn .6s ease 4.2s both" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...purpleText(110), lineHeight: 1, filter: "drop-shadow(0 0 14px rgba(170,100,255,1))",
                animation: `odChev 1.2s ease-in-out ${4.2 + (2 - i) * 0.2}s infinite both` }}>❮</div>
            ))}
          </div>
        </>
      )}

      {/* The scavenged card flies out of the sidebar and expands into the middle of the game */}
      {raised && seq?.replacement_card_image && (
        <div key={"scav-" + (seq.id || "")} style={{ position: "fixed", left: 1000, top: 352, width: 400, zIndex: 4, pointerEvents: "none",
          textAlign: "center", animation: leaving ? "odFadeOut 0.8s ease forwards" : "none" }}>
          <div style={{ animation: "odFly 0.9s cubic-bezier(.2,.8,.3,1) both" }}>
            <div style={{ width: 400, height: 558, borderRadius: 20, overflow: "hidden", background: "#120a20",
              animation: "odGold 2.4s ease-in-out .9s infinite" }}>
              <img src={seq.replacement_card_image} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />
            </div>
          </div>
          <div style={{ width: 1000, marginLeft: -300, marginTop: 14, animation: "odTextIn .6s ease .8s both" }}>
            <div style={{ ...goldText(34), letterSpacing: 6 }}>SCAVENGED</div>
            <div style={{ ...goldText(54), lineHeight: 1.05 }}>{(seq.replacement_card || "").toUpperCase()}</div>
            <div style={{ ...steelText(28) }}>
              {seq.rarity_roll ? `AN ${String(seq.rarity_roll).toUpperCase()} JOINS THE DECK` : "JOINS THE DECK"}
            </div>
          </div>
        </div>
      )}

      {/* DEATH RUN banner: slams in at the centre, then docks as the panel title */}
      <div
        style={{
          position: "fixed",
          left: "62.5%", // centre of the game window (480 + 1440 / 2 = 1200px)
          top: `calc(50% - ${PANEL_H / 2 - 46}px)`,
          width: TITLE_W,
          marginLeft: -TITLE_W / 2,
          transform: docked
            ? "translateY(0) scale(1) rotate(0deg)"
            : raised
            ? `translate(-460px, calc(${PANEL_H / 2 - 46 + 135}px - 50%)) scale(0.55)` // raised: moves to the left of the game window, the scavenged card takes the centre
            : `translateY(calc(${PANEL_H / 2 - 46 + 135}px - 50%)) scale(1)`, // centre of the game window (y 675)
          transition: `transform 1s ${DOCK_EASE}`,
          animation: leaving ? "odFadeOut 0.5s ease forwards" : "none",
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <img
          src={DEATH_RUN}
          alt="DEATH RUN"
          draggable={false}
          style={{
            display: "block",
            width: TITLE_W,
            height: "auto",
            animation: "dfGrow 1.6s cubic-bezier(.2,.7,.2,1) 2s both, dfDeathGlow 3s ease-in-out 3.6s infinite",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

// Face-down card on the right while the rotted card is held hostage
function MysteryCard({ visible }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 14,
        border: "3px dashed rgba(214,140,60,0.8)",
        background:
          "radial-gradient(circle at 50% 45%, rgba(120,80,40,0.35), rgba(11,11,18,0.95) 70%)",
        boxShadow: "0 0 18px 4px rgba(214,140,60,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      <div style={{ ...goldText(130), animation: "odPulse 1.4s ease-in-out infinite" }}>?</div>
    </div>
  );
}

// Small notice once the deck has been verified in the Run Tracker
function VerifiedNote({ removedName, replacementName }) {
  return (
    <div className="w-screen h-screen" style={{ background: "transparent" }}>
      <style>{`
        @keyframes odNote {
          0% { transform: translate(-50%, 40px); opacity: 0; }
          10% { transform: translate(-50%, 0); opacity: 1; }
          90% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 20px); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          left: "62.5%", // centre of the game window (480 + 1440 / 2 = 1200px)
          bottom: "16%",
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "18px 34px 18px 22px",
          borderRadius: 16,
          background: "rgba(11,11,18,0.94)",
          border: "2px solid rgba(214,140,60,0.85)",
          boxShadow: "0 0 26px 6px rgba(214,140,60,0.3), 0 10px 30px rgba(0,0,0,0.6)",
          animation: `odNote ${NOTE_MS}ms ease both`,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FFF0CD, #D68C3C)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1A120C",
            fontSize: 34,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          ✓
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...goldText(34), letterSpacing: "3px" }}>DECK VERIFIED</div>
          <div style={steelText(19)}>
            −1 {removedName} · +1 {replacementName} · NEXT ROUND READY
          </div>
        </div>
      </div>
    </div>
  );
}