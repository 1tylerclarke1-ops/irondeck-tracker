import React, { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, isSameDay, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import DeckRow from "@/components/overlay/DeckRow";
import useCardImagesById from "@/hooks/useCardImagesById";
import useOutroAnimation from "@/hooks/useOutroAnimation";

const RUST = "#a35a3d";

const TOTAL_HEIGHT = 1080;
const PAD_VERTICAL = 32;
const TITLE_BLOCK = 46;
const HEADING_HEIGHT = 24;
const ROW_GAP = 4;
const MAX_ROW = 44;
const MIN_ROW = 16;

function sortDeck(cards) {
  const enriched = cards.map((c) => ({
    ...c,
    _land: c.card_type === "land" ? 1 : 0,
    _mv: c.card_type === "land" ? 999 : Number(c.mana_value) || 0,
  }));
  enriched.sort((a, b) => {
    if (a._land !== b._land) return a._land - b._land;
    if (a._mv !== b._mv) return a._mv - b._mv;
    return (a.name || "").localeCompare(b.name || "");
  });
  return enriched;
}

export default function OverlayDeck({ outro } = {}) {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [sideCards, setSideCards] = useState([]);
  const [climb, setClimb] = useState(null);
  const [run, setRun] = useState(null);
  const [decays, setDecays] = useState([]);

  const isOutro = useMemo(() => {
    if (outro !== undefined) return Boolean(outro);
    const p = new URLSearchParams(window.location.search);
    return p.get("mode") === "outro";
  }, [outro]);

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
        const seasons = await base44.entities.Season.filter({ status: "active" });
        if (!active) return;
        const s = seasons && seasons[0];
        if (!s) {
          setSeason(null);
          setCards([]);
          setSideCards([]);
          setClimb(null);
          setRun(null);
          setDecays([]);
          return;
        }
        const [list, climbs, runs, decs] = await Promise.all([
          base44.entities.Card.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
          base44.entities.Run.filter({ season_id: s.id }),
          base44.entities.Decay.filter({ season_id: s.id }),
        ]);
        if (!active) return;
        const sortedClimbs = [...climbs].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        const sortedRuns = [...runs].sort(
          (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
        );
        setSeason(s);
        setClimb(sortedClimbs[0] || null);
        setRun(
          runs.find((r) => r.result === "in_progress") || sortedRuns[0] || null
        );
        setDecays(decs);
        setCards(sortDeck(list.filter((c) => (c.zone || "main") === "main")));
        setSideCards(
          sortDeck(list.filter((c) => (c.zone || "main") === "sideboard"))
        );
      } catch (e) {
        // keep last data on error
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const day = useMemo(() => {
    if (!climb) return null;
    if (climb.status === "active" && climb.start_date)
      return differenceInCalendarDays(new Date(), new Date(climb.start_date)) + 1;
    if (climb.status === "complete") return climb.days_taken || null;
    return null;
  }, [climb]);

  const seasonNumber = season?.season_number ?? null;

  const scryfallIds = useMemo(() => {
    const ids = Array.from(
      new Set(
        [...cards, ...sideCards].map((c) => c.scryfall_id).filter(Boolean)
      )
    );
    ids.sort();
    return ids;
  }, [cards, sideCards]);
  const images = useCardImagesById(scryfallIds);

  const todayDecays = useMemo(() => {
    const now = new Date();
    return decays
      .filter((d) => d.date && isSameDay(parseISO(d.date), now))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [decays]);

  const todayOldest = useMemo(
    () => [...todayDecays].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [todayDecays]
  );

  const todayRustedNames = useMemo(
    () => new Set(todayDecays.map((d) => d.card_removed)),
    [todayDecays]
  );

  const n = todayOldest.length;
  const animating = isOutro && n > 0;
  const { appliedCount, activeIdx, ticked } = useOutroAnimation(
    isOutro,
    todayOldest
  );

  // Per (name, zone) counts of today's removals and replacements
  const removedTodayCount = {};
  const replacedTodayCount = {};
  for (const d of todayOldest) {
    const z = d.zone || "main";
    const rk = `${d.card_removed}|${z}`;
    const pk = `${d.replacement_card}|${z}`;
    removedTodayCount[rk] = (removedTodayCount[rk] || 0) + 1;
    replacedTodayCount[pk] = (replacedTodayCount[pk] || 0) + 1;
  }

  // Pre-decay copies: reverse all of today's decays from the current deck
  const preCopiesMap = {};
  for (const c of [...cards, ...sideCards]) {
    const z = c.zone || "main";
    const k = `${c.name}|${z}`;
    let pre = Number(c.copies) || 0;
    if (removedTodayCount[k]) pre += removedTodayCount[k];
    if (replacedTodayCount[k]) pre -= replacedTodayCount[k];
    preCopiesMap[c.id] = pre;
  }

  // Decays fully applied so far
  const removedAppliedCount = {};
  const replacedAppliedCount = {};
  for (let j = 0; j < appliedCount; j++) {
    const d = todayOldest[j];
    const z = d.zone || "main";
    const rk = `${d.card_removed}|${z}`;
    const pk = `${d.replacement_card}|${z}`;
    removedAppliedCount[rk] = (removedAppliedCount[rk] || 0) + 1;
    replacedAppliedCount[pk] = (replacedAppliedCount[pk] || 0) + 1;
  }

  const active = activeIdx != null ? todayOldest[activeIdx] : null;
  const activeZone = active?.zone || "main";
  const activeRemovedKey = active ? `${active.card_removed}|${activeZone}` : null;
  const activeReplacedKey = active
    ? `${active.replacement_card}|${activeZone}`
    : null;

  const displayCopiesPreTick = (c) => {
    const z = c.zone || "main";
    const k = `${c.name}|${z}`;
    let disp = preCopiesMap[c.id] ?? (Number(c.copies) || 0);
    disp -= removedAppliedCount[k] || 0;
    disp += replacedAppliedCount[k] || 0;
    return Math.max(0, disp);
  };

  const displayCopies = (c) => {
    let disp = displayCopiesPreTick(c);
    if (active && ticked) {
      const z = c.zone || "main";
      const k = `${c.name}|${z}`;
      if (activeRemovedKey === k) disp -= 1;
      if (activeReplacedKey === k) disp += 1;
    }
    return Math.max(0, disp);
  };

  const dCopies = (c) => (animating ? displayCopies(c) : Number(c.copies) || 0);

  const preTickRusted = (c) => {
    const o = Number(c.original_copies) || 0;
    return o > 0 ? Math.max(0, o - displayCopiesPreTick(c)) : 0;
  };

  const isCorroding = (c) => {
    if (!active || ticked) return false;
    return activeRemovedKey === `${c.name}|${c.zone || "main"}`;
  };
  const isReplacementEntering = (c) => {
    if (!active || !ticked) return false;
    if (activeReplacedKey !== `${c.name}|${c.zone || "main"}`) return false;
    return displayCopiesPreTick(c) === 0;
  };
  const isRustedEntering = (c) => {
    if (!active || !ticked) return false;
    if (activeRemovedKey !== `${c.name}|${c.zone || "main"}`) return false;
    return preTickRusted(c) === 0;
  };
  const salvagedVisible = (c) => {
    if (!c.is_decay_replacement) return false;
    if (!animating) return true;
    const z = c.zone || "main";
    const k = `${c.name}|${z}`;
    if (!replacedTodayCount[k]) return true;
    let applied = replacedAppliedCount[k] || 0;
    if (active && ticked && activeReplacedKey === k) applied += 1;
    return applied > 0;
  };

  const mainCards = cards.filter((c) => dCopies(c) > 0);
  const sideMain = sideCards.filter((c) => dCopies(c) > 0);
  const rustedCards = [...cards, ...sideCards]
    .map((c) => {
      const o = Number(c.original_copies) || 0;
      const d = dCopies(c);
      return { card: c, rusted: o > 0 ? Math.max(0, o - d) : 0 };
    })
    .filter((r) => r.rusted > 0)
    .sort((a, b) => b.rusted - a.rusted);
  const rustedMainCards = rustedCards.filter(
    (r) => (r.card.zone || "main") === "main"
  );
  const rustedSideCards = rustedCards.filter(
    (r) => (r.card.zone || "main") === "sideboard"
  );
  const rustedMainCount = rustedMainCards.reduce((s, r) => s + r.rusted, 0);
  const rustedSideCount = rustedSideCards.reduce((s, r) => s + r.rusted, 0);

  // Row height from the final (current) state so it stays stable mid-animation
  const finalMain = cards.filter((c) => (Number(c.copies) || 0) > 0);
  const finalSide = sideCards.filter((c) => (Number(c.copies) || 0) > 0);
  const finalRustedMain = cards.filter((c) => {
    const o = Number(c.original_copies) || 0;
    const cp = Number(c.copies) || 0;
    return (c.zone || "main") === "main" && o > 0 && o - cp > 0;
  });
  const finalRustedSide = sideCards.filter((c) => {
    const o = Number(c.original_copies) || 0;
    const cp = Number(c.copies) || 0;
    return o > 0 && o - cp > 0;
  });
  const fHasSide = finalSide.length > 0;
  const fHasRustedMain = finalRustedMain.length > 0;
  const fHasRustedSide = finalRustedSide.length > 0;
  const avail = TOTAL_HEIGHT - PAD_VERTICAL - TITLE_BLOCK;

  // Sideboard rusted is a compact strip sized for up to 5 rows
  const COMPACT_ROW = 18;
  const sideRustedRows = finalRustedSide.length;
  const sideRustedFootprint = fHasRustedSide
    ? HEADING_HEIGHT +
      ROW_GAP +
      sideRustedRows * COMPACT_ROW +
      Math.max(0, sideRustedRows - 1) * ROW_GAP
    : 0;

  const mainRows =
    finalMain.length + finalSide.length + finalRustedMain.length;
  const mainHeadings = (fHasSide ? 1 : 0) + (fHasRustedMain ? 1 : 0);
  const mainChildCount = mainRows + mainHeadings;
  const mainGaps = mainChildCount > 1 ? (mainChildCount - 1) * ROW_GAP : 0;
  const rowH =
    mainRows > 0
      ? Math.max(
          MIN_ROW,
          Math.min(
            MAX_ROW,
            (avail -
              sideRustedFootprint -
              mainHeadings * HEADING_HEIGHT -
              mainGaps) /
              mainRows
          )
        )
      : MAX_ROW;

  const hasSide = sideMain.length > 0;
  const hasRustedMain = rustedMainCards.length > 0;
  const hasRustedSide = rustedSideCards.length > 0;

  const title = `Season ${seasonNumber ?? "—"} · Day ${day ?? "—"}`;

  const rowProps = (c) => ({
    imageUrl: images[c.scryfall_id]?.normal,
    loading: Boolean(c.scryfall_id) && images[c.scryfall_id] === undefined,
    height: rowH,
  });

  return (
    <div
      style={{
        background: "transparent",
        minHeight: "100vh",
        padding: "16px 24px",
        color: "#fff",
        fontFamily: "sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes ovd-corrode { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes ovd-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes ovd-slidein { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes ovd-dropin { from { transform: translateY(-18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      <h1
        style={{
          textAlign: "center",
          fontSize: "1.4rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          margin: "0 0 12px",
          color: "#fff",
        }}
      >
        {title}
      </h1>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            width: 460,
            display: "flex",
            flexDirection: "column",
            gap: ROW_GAP,
          }}
        >
          {mainCards.map((c) => (
            <DeckRow
              key={c.id}
              card={c}
              variant="current"
              copies={animating ? dCopies(c) : undefined}
              corroding={animating && isCorroding(c)}
              entering={animating && isReplacementEntering(c)}
              salvaged={animating ? salvagedVisible(c) : undefined}
              {...rowProps(c)}
            />
          ))}
          {hasSide && (
            <>
              <div
                style={{
                  height: HEADING_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "2px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: RUST,
                }}
              >
                SIDEBOARD
              </div>
              {sideMain.map((c) => (
                <DeckRow
                  key={c.id}
                  card={c}
                  variant="current"
                  copies={animating ? dCopies(c) : undefined}
                  corroding={animating && isCorroding(c)}
                  entering={animating && isReplacementEntering(c)}
                  salvaged={animating ? salvagedVisible(c) : undefined}
                  {...rowProps(c)}
                />
              ))}
            </>
          )}
          {hasRustedMain && (
            <>
              <div
                style={{
                  height: HEADING_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "2px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: RUST,
                }}
              >
                RUSTED – MAIN ({rustedMainCount})
              </div>
              {rustedMainCards.map((r) => (
                <DeckRow
                  key={r.card.id}
                  card={r.card}
                  variant="rusted"
                  copies={animating ? dCopies(r.card) : undefined}
                  entering={animating && isRustedEntering(r.card)}
                  glow={isOutro && todayRustedNames.has(r.card.name)}
                  {...rowProps(r.card)}
                />
              ))}
            </>
          )}
          {hasRustedSide && (
            <>
              <div
                style={{
                  height: HEADING_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "2px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: RUST,
                }}
              >
                RUSTED – SIDEBOARD ({rustedSideCount})
              </div>
              {rustedSideCards.map((r) => (
                <DeckRow
                  key={r.card.id}
                  card={r.card}
                  variant="rusted"
                  copies={animating ? dCopies(r.card) : undefined}
                  entering={animating && isRustedEntering(r.card)}
                  glow={isOutro && todayRustedNames.has(r.card.name)}
                  {...rowProps(r.card)}
                  height={COMPACT_ROW}
                />
              ))}
            </>
          )}
        </div>
      </div>
      {isOutro && n === 0 && <DaySurvivedBanner />}
      {isOutro && n > 0 && <OutroPanel run={run} decays={todayDecays} />}
    </div>
  );
}

function DaySurvivedBanner() {
  return (
    <div style={{ marginTop: "14px", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          padding: "10px 28px",
          borderRadius: "8px",
          background: "rgba(20,23,29,0.82)",
          border: "1px solid #2d8a4e",
          color: "#fff",
          fontWeight: 800,
          letterSpacing: "0.12em",
          fontSize: "1.2rem",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        DAY SURVIVED
      </div>
    </div>
  );
}

function OutroPanel({ run, decays }) {
  const status = run?.round_status;
  const wins = run?.round_wins ?? 0;
  const losses = run?.round_losses ?? 0;
  const resultLabel =
    status === "survived"
      ? "DAY SURVIVED"
      : status === "died"
      ? "RUN DIED"
      : "IN PROGRESS";
  const resultColor =
    status === "survived"
      ? "#2d8a4e"
      : status === "died"
      ? "#c0392b"
      : RUST;

  return (
    <div
      style={{
        marginTop: "14px",
        display: "flex",
        gap: "16px",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "10px 18px",
          borderRadius: "8px",
          background: "rgba(20,23,29,0.82)",
          border: `1px solid ${resultColor}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 200,
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: resultColor,
          }}
        >
          TODAY
        </span>
        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>
          {resultLabel}
        </span>
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {wins}–{losses}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          padding: "10px 16px",
          borderRadius: "8px",
          background: "rgba(20,23,29,0.82)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: RUST,
            marginBottom: "6px",
          }}
        >
          CARDS RUSTED TODAY
        </div>
        {decays.length === 0 ? (
          <div
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            No decay today.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 18px",
            }}
          >
            {decays.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.82rem",
                  color: "#fff",
                }}
              >
                <span
                  style={{
                    textDecoration: "line-through",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {d.card_removed}
                </span>
                <span style={{ color: RUST, fontWeight: 800 }}>→</span>
                <span style={{ fontWeight: 700 }}>{d.replacement_card}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}