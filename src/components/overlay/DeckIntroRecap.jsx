import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { postCollection } from "@/lib/scryfall";
import { irondeckText } from "@/lib/overlayText";
import { INTRO_BG_STYLE } from "@/lib/overlayAssets";

const DPRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const SURVIVED = `${DPRE}158b6c909_survived.png`;
const DEATH_RUN = `${DPRE}a1e57edaa_death-run.png`;
// TDC Gaming shield (transparent PNG). Forges in at the centre, then docks
// top-left as a channel badge while the recap plays. Leave "" to skip it.
const LOGO_IMG = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
const LOGO_MS = 2700; // recap starts this long after the logo begins
const LOGO_H = 600;
const LOGO_W = Math.round(LOGO_H * 0.782);
const LOGO_CX = 960;
const LOGO_CY = 520;
const BADGE_H = 150; // docked size
const BADGE_CX = 118;
const BADGE_CY = 108;

// ---- Timeline (ms from start) ----
const T_HEAD_IN = 150; // "Previously on IronDeck" fades in, centred
const T_HEAD_UP = 1500; // header glides up to the top
const T_BANNER = 2250; // result banner fades/scales in
const T_LINE = 3100; // day line fades in
const T_MAIN = 3900; // rotted card (death) or run counter (win)
const T_TURN = 4900; // rot drains → arrow draws → scavenged card rises
const T_OUT = 10500; // start fading out to the deck
const FADE_OUT_MS = 1100;
const IMAGE_WAIT_MS = 3000; // max wait for card images before starting

const W = 1920;
const H = 1080;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const CINZEL = '"Cinzel", serif';

// Solid, high-contrast text (readable on stream compression).
const solid = (size, color, extra = {}) => ({
  fontFamily: CINZEL,
  fontWeight: 900,
  fontSize: size,
  lineHeight: 1,
  color,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textShadow:
    "0 2px 0 #000, 0 0 6px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.85)",
  whiteSpace: "nowrap",
  ...extra,
});

function useStageScale() {
  const get = () =>
    Math.min(window.innerWidth / W, window.innerHeight / H) || 1;
  const [s, setS] = useState(get);
  useLayoutEffect(() => {
    const on = () => setS(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return s;
}

function useElapsed(running) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf;
    const tick = () => {
      setT(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return t;
}

const at = (t, from) => t >= from;

function Plate({ children, tone = "gold", style }) {
  const border =
    tone === "rot" ? "rgba(170,130,240,0.7)" : "rgba(226,160,80,0.7)";
  return (
    <div
      style={{
        padding: "14px 34px",
        borderRadius: 12,
        background: "rgba(8,9,13,0.86)",
        border: `2px solid ${border}`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.7)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Card({ image, name, tone, cardH, drained, style }) {
  const cardW = Math.round(cardH * 0.716);
  const ring =
    tone === "rot"
      ? "0 0 0 3px #7c5aa8, 0 0 28px 6px rgba(124,90,168,0.6)"
      : "0 0 0 3px #e0a050, 0 0 34px 8px rgba(224,160,80,0.65)";
  return (
    <div
      style={{
        position: "relative",
        width: cardW,
        height: cardH,
        borderRadius: cardW * 0.05,
        overflow: "hidden",
        background: "#0b0b12",
        boxShadow: `${ring}, 0 16px 40px rgba(0,0,0,0.8)`,
        ...style,
      }}
    >
      {image ? (
        <img
          src={image}
          alt={name || ""}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            filter: drained
              ? "grayscale(1) brightness(0.55) contrast(1.1)"
              : "none",
            transition: "filter 1.1s ease",
          }}
        />
      ) : (
        <div
          style={{
            ...solid(26, "#F5E6C4", { whiteSpace: "normal" }),
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 20,
            lineHeight: 1.2,
          }}
        >
          {name}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(110,70,180,0.45)",
          mixBlendMode: "multiply",
          opacity: drained ? 1 : 0,
          transition: "opacity 1.1s ease",
        }}
      />
    </div>
  );
}

function Tag({ text, tone }) {
  return (
    <Plate tone={tone} style={{ padding: "8px 22px", borderRadius: 10 }}>
      <span style={solid(24, tone === "rot" ? "#D9C6FF" : "#FFD691")}>
        {text}
      </span>
    </Plate>
  );
}

function Arrow({ draw }) {
  return (
    <svg
      width="130"
      height="60"
      viewBox="0 0 130 60"
      style={{ filter: "drop-shadow(0 0 12px rgba(255,140,40,0.95))" }}
    >
      <path
        d="M8 30 L112 30 M92 10 L116 30 L92 50"
        stroke="#ff9a36"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={draw ? 0 : 100}
        style={{ transition: `stroke-dashoffset 0.7s ${EASE}` }}
      />
    </svg>
  );
}

function DeathBody({ t, decays, images }) {
  const many = decays.length >= 2;
  const cardH = many ? 280 : 340;
  const showRot = at(t, T_MAIN);
  const drained = at(t, T_MAIN + 500);
  const draw = at(t, T_TURN);
  const showNew = at(t, T_TURN + 450);
  const flash = at(t, T_TURN + 450) && !at(t, T_TURN + 1300);
  if (!decays.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 612,
        display: "flex",
        justifyContent: "center",
        gap: many ? 110 : 0,
      }}
    >
      {decays.map((d, i) => (
        <div
          key={d.id || i}
          style={{ display: "flex", alignItems: "center", gap: 34 }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              opacity: showRot ? 1 : 0,
              transform: showRot ? "translateY(0)" : "translateY(26px)",
              transition: `opacity 0.8s ease, transform 0.9s ${EASE}`,
            }}
          >
            <Tag text="Rotted" tone="rot" />
            <Card
              image={images[d.card_removed]}
              name={d.card_removed}
              tone="rot"
              cardH={cardH}
              drained={drained}
            />
          </div>
          <Arrow draw={draw} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              opacity: showNew ? 1 : 0,
              transform: showNew
                ? "translateY(0) scale(1)"
                : "translateY(30px) scale(0.94)",
              transition: `opacity 0.7s ease, transform 0.9s ${EASE}`,
            }}
          >
            <Tag text="Scavenged" tone="gold" />
            <div style={{ position: "relative" }}>
              <Card
                image={images[d.replacement_card]}
                name={d.replacement_card}
                tone="gold"
                cardH={cardH}
              />
              <div
                style={{
                  position: "absolute",
                  inset: -40,
                  borderRadius: 30,
                  background:
                    "radial-gradient(closest-side, rgba(255,214,140,0.85), rgba(255,160,60,0) 70%)",
                  mixBlendMode: "screen",
                  opacity: flash ? 1 : 0,
                  transition: "opacity 0.45s ease",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WinBody({ t, log }) {
  const after = Number(log.run_wins_after) || 0;
  const gained = Number(log.wins) || 0;
  const before = Math.max(0, after - gained);
  const show = at(t, T_MAIN);
  const p = Math.min(1, Math.max(0, (t - (T_MAIN + 500)) / 1400));
  const eased = 1 - Math.pow(1 - p, 3);
  const value = Math.round(before + (after - before) * eased);
  const landed = p >= 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 640,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(26px)",
        transition: `opacity 0.8s ease, transform 0.9s ${EASE}`,
      }}
    >
      <span style={solid(30, "#E8DCC4", { letterSpacing: "0.3em" })}>
        Run
      </span>
      <span
        style={{
          ...solid(190, "#FFD691"),
          textShadow: landed
            ? "0 4px 0 #000, 0 0 30px rgba(255,170,60,0.9), 0 0 70px rgba(255,140,40,0.6)"
            : "0 4px 0 #000, 0 0 18px rgba(0,0,0,0.9)",
          transform: landed ? "scale(1.06)" : "scale(1)",
          transition: `text-shadow 0.5s ease, transform 0.5s ${EASE}`,
        }}
      >
        {value}
      </span>
      <span style={solid(30, "#E8DCC4", { letterSpacing: "0.3em" })}>
        {after === 1 ? "Win" : "Wins"}
      </span>
    </div>
  );
}

// Gold embers drifting up (win only).
function Embers() {
  const dots = Array.from({ length: 26 }, (_, i) => ({
    left: 8 + ((i * 37) % 84),
    size: 3 + (i % 4),
    delay: (i * 0.53) % 6,
    dur: 5 + (i % 5),
  }));
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${d.left}%`,
            bottom: -20,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            background: "#ffcf7a",
            boxShadow: "0 0 10px 3px rgba(255,170,60,0.8)",
            animation: `rcp-ember ${d.dur}s linear ${d.delay}s infinite`,
            opacity: 0,
          }}
        />
      ))}
    </>
  );
}

// The channel shield's entrance: blur-in → flash, ring and ember burst →
// light sweep → shrinks into the top-left corner and stays as a badge.
function LogoIntro({ tl }) {
  const shown = at(tl, 150);
  const landed = at(tl, 900) && !at(tl, 2500);
  const docked = at(tl, 2500);
  const k = BADGE_H / LOGO_H;
  const transform = docked
    ? `translate(${BADGE_CX - LOGO_CX}px, ${BADGE_CY - LOGO_CY}px) scale(${k})`
    : shown
    ? "translate(0px, 0px) scale(1)"
    : "translate(0px, 0px) scale(1.25)";
  const sparks = Array.from({ length: 34 }, (_, i) => {
    const a = (i / 34) * Math.PI * 2 + (i % 3) * 0.2;
    const d = 300 + ((i * 53) % 260);
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.85 - 60, s: 4 + (i % 4), dl: (i % 5) * 0.03 };
  });
  return (
    <div
      style={{
        position: "absolute",
        left: LOGO_CX - LOGO_W / 2,
        top: LOGO_CY - LOGO_H / 2,
        width: LOGO_W,
        height: LOGO_H,
        transform,
        transformOrigin: "center",
        transition: `transform ${docked ? 1 : 0.9}s ${EASE}`,
      }}
    >
      {landed && (
        <>
          <div
            style={{
              position: "absolute",
              inset: "-45%",
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(255,236,200,0.95), rgba(255,140,50,0.55) 40%, rgba(255,110,40,0) 72%)",
              mixBlendMode: "screen",
              animation: "rcp-flash 0.8s ease-out forwards",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 380,
              height: 380,
              borderRadius: "50%",
              border: "6px solid #ff9a36",
              boxShadow: "0 0 30px 8px rgba(255,140,40,0.75), inset 0 0 30px 6px rgba(255,140,40,0.5)",
              animation: "rcp-ring 0.95s ease-out forwards",
            }}
          />
          {sparks.map((p, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: p.s,
                height: p.s,
                borderRadius: "50%",
                background: "#ffd38a",
                boxShadow: "0 0 10px 3px rgba(255,160,60,0.9)",
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                animation: `rcp-burst 1.3s ease-out ${p.dl}s forwards`,
              }}
            />
          ))}
        </>
      )}
      <img
        src={LOGO_IMG}
        alt="TDC Gaming"
        draggable={false}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "block",
          opacity: shown ? 1 : 0,
          filter: shown
            ? "blur(0px) brightness(1) drop-shadow(0 0 28px rgba(255,110,40,0.45))"
            : "blur(14px) brightness(2.4) drop-shadow(0 0 0px rgba(255,110,40,0))",
          transition: "opacity 0.8s ease, filter 0.9s ease",
        }}
      />
      {at(tl, 1350) && !docked && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            WebkitMaskImage: `url(${LOGO_IMG})`,
            WebkitMaskSize: "100% 100%",
            maskImage: `url(${LOGO_IMG})`,
            maskSize: "100% 100%",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "35%",
              background:
                "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,240,210,0.7), rgba(255,255,255,0))",
              animation: "rcp-sweep 0.9s ease-in-out both",
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function DeckIntroRecap({ season, onDone }) {
  const [log, setLog] = useState(null);
  const [decays, setDecays] = useState([]);
  const [images, setImages] = useState({});
  const [ready, setReady] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(!LOGO_IMG);
  const [logoFailed, setLogoFailed] = useState(false);
  const [noRecap, setNoRecap] = useState(false);
  const [closing, setClosing] = useState(false);
  const scale = useStageScale();
  const tl = useElapsed(!!LOGO_IMG && logoLoaded && !logoFailed);
  const logoDone = !LOGO_IMG || logoFailed || tl >= LOGO_MS;
  const t = useElapsed(ready && logoDone);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  };

  // Load the most recent DayLog dated before today, then its Decay records.
  useEffect(() => {
    let active = true;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      try {
        if (!season?.id) return;
        const logs = await base44.entities.DayLog.filter({
          season_id: season.id,
        });
        if (!active) return;
        const earlier = logs
          .filter((l) => (l.date || "") < today)
          .sort(
            (a, b) =>
              (b.date || "").localeCompare(a.date || "") ||
              new Date(b.created_date || 0) - new Date(a.created_date || 0)
          );
        if (!earlier.length) {
          setNoRecap(true);
          return;
        }
        const found = earlier[0];
        const ids = (found.decay_ids || []).filter(Boolean);
        let list = [];
        if (found.result === "died" && ids.length) {
          const ds = await base44.entities.Decay.filter({
            season_id: season.id,
          });
          if (!active) return;
          const byId = {};
          ds.forEach((d) => {
            byId[d.id] = d;
          });
          list = ids.map((id) => byId[id]).filter(Boolean);
        }
        setDecays(list);
        setLog(found);
      } catch {
        setNoRecap(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.id]);

  // Fetch and preload card images, then start the timeline (max IMAGE_WAIT_MS).
  useEffect(() => {
    if (!log) return;
    let active = true;
    const go = () => active && setReady(true);
    const names = Array.from(
      new Set(
        decays.flatMap((d) => [d.card_removed, d.replacement_card]).filter(Boolean)
      )
    );
    if (!names.length) {
      go();
      return () => {
        active = false;
      };
    }
    const timeout = setTimeout(go, IMAGE_WAIT_MS);
    (async () => {
      try {
        const res = await postCollection(names.map((n) => ({ name: n })));
        const map = {};
        for (const c of res) {
          const url =
            c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || null;
          if (!url) continue;
          if (c.name) map[c.name] = url;
          const front = c.card_faces?.[0]?.name;
          if (front) map[front] = url;
        }
        // Match stored names case-insensitively too.
        names.forEach((n) => {
          if (map[n]) return;
          const k = Object.keys(map).find(
            (x) => x.toLowerCase() === n.toLowerCase()
          );
          if (k) map[n] = map[k];
        });
        await Promise.all(
          Object.values(map).map(
            (src) =>
              new Promise((r) => {
                const img = new Image();
                img.onload = img.onerror = r;
                img.src = src;
              })
          )
        );
        if (!active) return;
        setImages(map);
      } catch {
        // best effort
      }
      clearTimeout(timeout);
      go();
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [log, decays]);

  // Preload the logo; skip it if it fails or takes longer than 3s.
  useEffect(() => {
    if (!LOGO_IMG) return;
    const img = new Image();
    img.onload = () => setLogoLoaded(true);
    img.onerror = () => setLogoFailed(true);
    img.src = LOGO_IMG;
    const id = setTimeout(() => setLogoLoaded(true), 3000);
    return () => clearTimeout(id);
  }, []);

  // Nothing to recap: after the logo, fade straight to the deck.
  useEffect(() => {
    if (!logoDone || !noRecap) return;
    setClosing(true);
    const id = setTimeout(() => finish(), FADE_OUT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoDone, noRecap]);

  useEffect(() => {
    if (t >= T_OUT + FADE_OUT_MS) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const died = log?.result === "died";
  const fadingOut = at(t, T_OUT);
  const headIn = at(t, T_HEAD_IN);
  const headUp = at(t, T_HEAD_UP);
  const bannerIn = at(t, T_BANNER);
  const lineIn = at(t, T_LINE);

  const wl = log ? `${log.wins ?? 0}–${log.losses ?? 0}` : "";
  const line = !log
    ? ""
    : died
    ? `Day ${log.day ?? "—"} · Lost ${wl} · Run ended at ${
        log.run_wins_after ?? 0
      } wins`
    : `Day ${log.day ?? "—"} · Won ${wl} · Survived the day`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        pointerEvents: "none",
        overflow: "hidden",
        background: INTRO_BG_STYLE,
        opacity: fadingOut || closing ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      <style>{`
        @keyframes rcp-pulse { 0%,100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes rcp-ember { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: 1; } 85% { opacity: 0.8; } 100% { transform: translateY(-1150px); opacity: 0; } }
        @keyframes rcp-flash { 0% { opacity: 0; transform: scale(0.6); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(1.5); } }
        @keyframes rcp-ring { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.3); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(3.2); } }
        @keyframes rcp-burst { 0% { opacity: 1; transform: translate(0, 0) scale(1); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); } }
        @keyframes rcp-sweep { 0% { transform: translateX(-140%) skewX(-20deg); } 100% { transform: translateX(240%) skewX(-20deg); } }
      `}</style>

      {/* Pulsing side glows: orange left, purple right (alternating) */}
      <div
        style={{
          position: "absolute",
          left: "-18%",
          top: "-10%",
          width: "60%",
          height: "120%",
          background:
            "radial-gradient(closest-side, rgba(255,120,30,0.42), rgba(255,120,30,0) 75%)",
          mixBlendMode: "screen",
          animation: "rcp-pulse 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "-18%",
          top: "-10%",
          width: "60%",
          height: "120%",
          background:
            "radial-gradient(closest-side, rgba(150,90,255,0.45), rgba(150,90,255,0) 75%)",
          mixBlendMode: "screen",
          animation: "rcp-pulse 4s ease-in-out -2s infinite",
        }}
      />

      {log && ready && !died && <Embers />}

      {log && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: W,
            height: H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {/* Header: fades in centred, then glides up */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 70,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              opacity: headIn ? 1 : 0,
              transform: headUp ? "translateY(0) scale(1)" : "translateY(370px) scale(1.25)",
              transition: `opacity 1s ease, transform 1s ${EASE}`,
            }}
          >
            <span style={solid(34, "#E8DCC4", { letterSpacing: "0.35em" })}>
              Previously on
            </span>
            <span style={irondeckText(92)}>IRONDECK</span>
          </div>

          {/* Result banner */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 222,
              width: 780,
              marginLeft: -390,
              opacity: bannerIn ? 1 : 0,
              transform: bannerIn ? "scale(1)" : "scale(0.86)",
              filter: bannerIn ? "blur(0)" : "blur(10px)",
              transition: `opacity 0.8s ease, transform 0.9s ${EASE}, filter 0.8s ease`,
            }}
          >
            <img
              src={died ? DEATH_RUN : SURVIVED}
              alt={died ? "Death run" : "Survived"}
              draggable={false}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            {!died && bannerIn && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  WebkitMaskImage: `url(${SURVIVED})`,
                  WebkitMaskSize: "100% 100%",
                  maskImage: `url(${SURVIVED})`,
                  maskSize: "100% 100%",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: "30%",
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,240,200,0.85), rgba(255,255,255,0))",
                    animation: "rcp-sweep 1.4s ease-in-out 0.5s 2 both",
                  }}
                />
              </div>
            )}
          </div>

          {/* Day line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 518,
              display: "flex",
              justifyContent: "center",
              opacity: lineIn ? 1 : 0,
              transform: lineIn ? "translateY(0)" : "translateY(14px)",
              transition: `opacity 0.8s ease, transform 0.8s ${EASE}`,
            }}
          >
            <Plate tone={died ? "rot" : "gold"}>
              <span style={solid(34, "#F5E6C4")}>{line}</span>
            </Plate>
          </div>

          {died ? (
            <DeathBody t={t} decays={decays} images={images} />
          ) : (
            <WinBody t={t} log={log} />
          )}
        </div>
      )}

      {/* TDC shield: forges in, then docks top-left as a badge */}
      {LOGO_IMG && !logoFailed && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: W,
            height: H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <LogoIntro tl={tl} />
        </div>
      )}
    </div>
  );
}
