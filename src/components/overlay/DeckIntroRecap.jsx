import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { postCollection } from "@/lib/scryfall";
import DeathCardFrame from "@/components/overlay/DeathCardFrame";
import { goldText, steelText, irondeckText } from "@/lib/overlayText";

const DPRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";
const SURVIVED = `${DPRE}158b6c909_survived.png`;
const DEATH_RUN = `${DPRE}a1e57edaa_death-run.png`;

const HOLD_MS = 8000;
const FADE_MS = 800;
const COVER_MS = 300;

// Glowing orange arrow pointing from the rotted card to the scavenged card.
function OrangeArrow() {
  return (
    <svg
      width="74"
      height="42"
      viewBox="0 0 74 42"
      style={{ filter: "drop-shadow(0 0 9px rgba(255,140,40,0.95))" }}
    >
      <path
        d="M6 21 L58 21 M46 8 L62 21 L46 34"
        stroke="#ff8c28"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DecayPair({ decay, images, scale, showRotted, showArrow, showScavenged }) {
  const removedImg = images[decay.card_removed] || null;
  const addedImg = images[decay.replacement_card] || null;
  const wrap = {
    transform: `scale(${scale})`,
    transformOrigin: "center",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  };
  const rottedStyle = {
    opacity: showRotted ? 1 : 0,
    transform: showRotted ? "translateX(0) scale(1)" : "translateX(-44px) scale(0.9)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };
  const arrowStyle = {
    opacity: showArrow ? 1 : 0,
    transform: showArrow ? "translateX(0)" : "translateX(-30px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };
  const scavengedStyle = {
    opacity: showScavenged ? 1 : 0,
    transform: showScavenged ? "translateY(0)" : "translateY(-54px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };
  return (
    <div style={wrap}>
      <div style={rottedStyle}>
        <DeathCardFrame
          image={removedImg}
          name={decay.card_removed}
          label="ROTTED ×1"
          tone="rot"
          drained
        />
      </div>
      <div style={arrowStyle}>
        <OrangeArrow />
      </div>
      <div style={scavengedStyle}>
        <DeathCardFrame
          image={addedImg}
          name={decay.replacement_card}
          label="SCAVENGED ×1"
          tone="gold"
        />
      </div>
    </div>
  );
}

export default function DeckIntroRecap({ season, onDone }) {
  const [log, setLog] = useState(null);
  const [decays, setDecays] = useState([]);
  const [images, setImages] = useState({});
  const [phase, setPhase] = useState("loading");
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
    const load = async () => {
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
          finish();
          return;
        }
        const found = earlier[0];
        setLog(found);
        const ids = (found.decay_ids || []).filter(Boolean);
        if (ids.length) {
          const ds = await base44.entities.Decay.filter({
            season_id: season.id,
          });
          if (!active) return;
          const byId = {};
          ds.forEach((d) => {
            byId[d.id] = d;
          });
          setDecays(ids.map((id) => byId[id]).filter(Boolean));
        }
        setPhase("banner");
      } catch {
        finish();
      }
    };
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.id]);

  // Fetch card images by name from Scryfall for the decayed cards.
  useEffect(() => {
    let active = true;
    const names = Array.from(
      new Set(
        decays.flatMap((d) =>
          [d.card_removed, d.replacement_card].filter(Boolean)
        )
      )
    );
    if (!names.length) return;
    (async () => {
      try {
        const res = await postCollection(names.map((n) => ({ name: n })));
        if (!active) return;
        const map = {};
        for (const c of res) {
          const url =
            c.image_uris?.normal ||
            c.card_faces?.[0]?.image_uris?.normal ||
            null;
          if (c.name && url) map[c.name] = url;
        }
        setImages(map);
      } catch {
        // best effort
      }
    })();
    return () => {
      active = false;
    };
  }, [decays]);

  // Animation timeline: banner stamp → line → rotted → arrow → scavenged → hold → cross-fade.
  useEffect(() => {
    if (phase === "loading") return;
    const timers = [];
    if (phase === "banner") {
      timers.push(setTimeout(() => setPhase("line"), 450));
      timers.push(setTimeout(() => setPhase("rotted"), 950));
      timers.push(setTimeout(() => setPhase("arrow"), 1450));
      timers.push(setTimeout(() => setPhase("scavenged"), 1950));
      timers.push(setTimeout(() => setPhase("outro"), HOLD_MS));
    }
    if (phase === "outro") {
      timers.push(setTimeout(() => finish(), FADE_MS));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const overlayOpacity =
    phase === "loading" || phase === "outro" ? 0 : 1;

  if (phase === "loading") {
    // Transparent while deciding; deck grid stays visible behind.
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          pointerEvents: "none",
          opacity: 0,
        }}
      />
    );
  }

  const died = log.result === "died";
  const banner = died ? DEATH_RUN : SURVIVED;
  const wl = `${log.wins ?? 0}\u2013${log.losses ?? 0}`;
  const line = died
    ? `DAY ${log.day ?? "\u2014"} \u00b7 LOST ${wl} \u00b7 RUN ENDED AT ${
        log.run_wins_after ?? 0
      } WINS`
    : `DAY ${log.day ?? "\u2014"} \u00b7 WON ${wl} \u00b7 RUN NOW AT ${
        log.run_wins_after ?? 0
      } WINS`;
  const multiple = decays.length >= 2;
  const scale = multiple ? 0.7 : 1;
  const showRotted = ["rotted", "arrow", "scavenged", "outro"].includes(phase);
  const showArrow = ["arrow", "scavenged", "outro"].includes(phase);
  const showScavenged = ["scavenged", "outro"].includes(phase);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.1rem",
        background: "linear-gradient(180deg, #0d1016 0%, #1a1d24 100%)",
        opacity: overlayOpacity,
        transition: `opacity ${phase === "outro" ? FADE_MS : COVER_MS}ms ease`,
      }}
    >
      <style>{`
        @keyframes dir-stamp { 0% { transform: scale(2.4) rotate(-10deg); opacity: 0; } 100% { transform: scale(1) rotate(-3deg); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.15rem",
        }}
      >
        <span style={steelText(24)}>PREVIOUSLY ON</span>
        <span style={irondeckText(40)}>IRONDECK</span>
      </div>

      {/* Banner */}
      <img
        src={banner}
        alt={died ? "DEATH RUN" : "SURVIVED"}
        draggable={false}
        style={{
          width: 620,
          height: "auto",
          objectFit: "contain",
          animation:
            "dir-stamp 0.4s cubic-bezier(0.15,0.9,0.3,1) both",
        }}
      />

      {/* Line */}
      <div
        style={{
          ...goldText(28),
          opacity: phase === "banner" ? 0 : 1,
          transform: phase === "banner" ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {line}
      </div>

      {/* Decays */}
      {decays.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "2rem",
            marginTop: "0.5rem",
          }}
        >
          {decays.map((d, i) => (
            <DecayPair
              key={d.id || i}
              decay={d}
              images={images}
              scale={scale}
              showRotted={showRotted}
              showArrow={showArrow}
              showScavenged={showScavenged}
            />
          ))}
        </div>
      )}
    </div>
  );
}