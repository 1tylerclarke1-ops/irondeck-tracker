import React, { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, isSameDay, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import DeckRow from "@/components/overlay/DeckRow";
import { goldText, steelText, irondeckText } from "@/lib/overlayText";
import useOutroAnimation from "@/hooks/useOutroAnimation";

const RUST = "#a35a3d";

const TOTAL_HEIGHT = 1080;
const ROW_GAP = 4;
const MAX_ROW = 74;
const MIN_ROW = 22;
const FRAME_W = 482;

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

  // Final-state counts for stable row height
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

  const OUTER_PAD = 32;
  const PANEL_PAD_V = 28;
  const HEADER_H = 56;
  const SECTION_H = 30;
  const SUB_H = 22;
  const outroReserve = isOutro && n > 0 ? 100 : isOutro && n === 0 ? 60 : 0;
  const avail = TOTAL_HEIGHT - OUTER_PAD - PANEL_PAD_V - HEADER_H - outroReserve;

  const sectionsCount =
    1 +
    (finalSide.length ? 1 : 0) +
    (finalRustedMain.length || finalRustedSide.length ? 1 : 0);
  const subsCount =
    (finalRustedMain.length ? 1 : 0) + (finalRustedSide.length ? 1 : 0);
  const totalRows =
    finalMain.length +
    finalSide.length +
    finalRustedMain.length +
    finalRustedSide.length;
  const totalItems = totalRows + sectionsCount + subsCount;
  const headingsH = sectionsCount * SECTION_H + subsCount * SUB_H;
  const gaps = totalItems > 1 ? (totalItems - 1) * ROW_GAP : 0;
  const rowH =
    totalRows > 0
      ? Math.max(
          MIN_ROW,
          Math.min(MAX_ROW, (avail - headingsH - gaps) / totalRows)
        )
      : MAX_ROW;

  const hasSide = sideMain.length > 0;
  const hasRustedMain = rustedMainCards.length > 0;
  const hasRustedSide = rustedSideCards.length > 0;

  const mainCount = mainCards.reduce((s, c) => s + dCopies(c), 0);
  const sideCount = sideMain.reduce((s, c) => s + dCopies(c), 0);
  const rottedCount = rustedMainCount + rustedSideCount;

  return (
    <div
      style={{
        background: "transparent",
        minHeight: "100vh",
        padding: "16px 24px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes ovd-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes ovd-slidein { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes ovd-dropin { from { transform: translateY(-18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            width: FRAME_W + 24,
            background: "rgba(10,10,12,0.88)",
            border: "2px solid #5A462E",
            borderRadius: 12,
            padding: "14px 12px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={irondeckText(30)}>IRONDECK</div>
            <div style={goldText(20)}>
              SEASON {seasonNumber ?? "—"} · DAY {day ?? "—"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
            <SectionTitle title="MAIN DECK" count={mainCount} />
            {mainCards.map((c) => (
              <DeckRow
                key={c.id}
                card={c}
                variant="current"
                copies={animating ? dCopies(c) : undefined}
                height={rowH}
                corroding={animating && isCorroding(c)}
                entering={animating && isReplacementEntering(c)}
                salvaged={animating ? salvagedVisible(c) : undefined}
              />
            ))}
            {hasSide && (
              <>
                <SectionTitle title="SIDEBOARD" count={sideCount} />
                {sideMain.map((c) => (
                  <DeckRow
                    key={c.id}
                    card={c}
                    variant="current"
                    copies={animating ? dCopies(c) : undefined}
                    height={rowH}
                    corroding={animating && isCorroding(c)}
                    entering={animating && isReplacementEntering(c)}
                    salvaged={animating ? salvagedVisible(c) : undefined}
                  />
                ))}
              </>
            )}
            {(hasRustedMain || hasRustedSide) && (
              <>
                <SectionTitle title="ROTTED" count={rottedCount} />
                {hasRustedMain && (
                  <>
                    <SubHeading title="MAIN" count={rustedMainCount} />
                    {rustedMainCards.map((r) => (
                      <DeckRow
                        key={r.card.id}
                        card={r.card}
                        variant="rusted"
                        copies={animating ? dCopies(r.card) : undefined}
                        height={rowH}
                        entering={animating && isRustedEntering(r.card)}
                        glow={isOutro && todayRustedNames.has(r.card.name)}
                      />
                    ))}
                  </>
                )}
                {hasRustedSide && (
                  <>
                    <SubHeading title="SIDEBOARD" count={rustedSideCount} />
                    {rustedSideCards.map((r) => (
                      <DeckRow
                        key={r.card.id}
                        card={r.card}
                        variant="rusted"
                        copies={animating ? dCopies(r.card) : undefined}
                        height={rowH}
                        entering={animating && isRustedEntering(r.card)}
                        glow={isOutro && todayRustedNames.has(r.card.name)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {isOutro && n === 0 && <DaySurvivedBanner />}
      {isOutro && n > 0 && <OutroPanel run={run} decays={todayDecays} />}
    </div>
  );
}

function SectionTitle({ title, count }) {
  return (
    <div
      style={{
        height: 30,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <span style={{ ...steelText(18), fontWeight: 900, letterSpacing: "2px" }}>
          {title}
        </span>
        <span style={{ ...goldText(16) }}>{count}</span>
      </div>
      <div
        style={{
          height: 1,
          background: "#5A462E",
          marginTop: 3,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

function SubHeading({ title, count }) {
  return (
    <div
      style={{
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
      }}
    >
      <span style={{ ...steelText(13), fontWeight: 900, letterSpacing: "1.5px" }}>
        {title}
      </span>
      <span style={{ ...goldText(12) }}>{count}</span>
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