import React, { useEffect, useMemo, useRef, useState } from "react";
import { isSameDay, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { liveReload } from "@/lib/liveReload";
import { demoDeathEvent } from "@/lib/demoDeath";
import { loadDayLogs, roundDay } from "@/lib/roundDay";
import DeckRow from "@/components/overlay/DeckRow";
import { goldText, steelText, irondeckText } from "@/lib/overlayText";
import useOutroAnimation from "@/hooks/useOutroAnimation";
import ChoppingBlock from "@/components/overlay/ChoppingBlock";
import CtaPopup from "@/components/overlay/CtaPopup";
import { blockState } from "@/lib/condemned";

const RUST = "#a35a3d";

// Frame layout: the deck list fills the left column under the logo corner.
const PANEL_LEFT = 12;
const PANEL_TOP = 282; // under the logo, which caps the sidebar (top band is 270px)
const PANEL_W = 456;
const PANEL_H = 1080 - PANEL_TOP - 12; // 786
const ROW_W = PANEL_W - 28; // each row fills the panel width
const TOTAL_HEIGHT = PANEL_H + 16;
const ROW_GAP = 2;
const MAX_ROW = 30;
const MIN_ROW = 14;
const FRAME_W = 482;

// Different printings of the same card (e.g. two Settle the Wreckage arts)
// are shown as one row with the copies added together.
function mergePrintings(list) {
  const byKey = new Map();
  for (const c of list) {
    const key = `${(c.name || "").toLowerCase()}|${c.zone || "main"}`;
    const m = byKey.get(key);
    if (!m) {
      byKey.set(key, { ...c });
      continue;
    }
    m.copies = (Number(m.copies) || 0) + (Number(c.copies) || 0);
    m.original_copies = (Number(m.original_copies) || 0) + (Number(c.original_copies) || 0);
    m.is_decay_replacement = Boolean(m.is_decay_replacement || c.is_decay_replacement);
    if (!m.scryfall_id) m.scryfall_id = c.scryfall_id;
  }
  return [...byKey.values()];
}

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

// Don't spoil the death screen: while a fresh death plays out, show the deck
// as it was BEFORE the rot, and switch to the new deck once the death
// screen's result has been shown (it takes about 30 seconds).
const DEATH_REVEAL_MS = 26000; // lead-in (2s) + sidebar execution (16.8s) + scavenged card in the middle (6.9s), then the deck returns
const ROT_LEAD_MS = 2000; // the execution starts exactly 2s after the death, so it stays in step with the death screen
const toMs = (v) => {
  if (!v) return 0;
  const t = String(v);
  return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`).getTime();
};
const sameName = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
const scryNormal = (id) => (id ? `https://api.scryfall.com/cards/${id}?format=image&version=normal` : "");
// Put back the card the rot removed and take out the card it scavenged.
function undoRot(list, ev, zone) {
  if (!ev || (ev.zone || "main") !== zone) return list;
  return list.map((c) => {
    let copies = Number(c.copies) || 0;
    if (sameName(c.name, ev.card_removed)) copies += 1;
    if (sameName(c.name, ev.replacement_card)) copies = Math.max(0, copies - 1);
    return copies === (Number(c.copies) || 0) ? c : { ...c, copies };
  });
}

export default function OverlayDeck({ outro } = {}) {
  const [season, setSeason] = useState(null);
  const [rawCards, setCards] = useState([]);
  const [rawSideCards, setSideCards] = useState([]);
  const [deathEv, setDeathEv] = useState(null);
  const [, setRevealTick] = useState(0);
  const loadedOnce = useRef(false);
  const [climb, setClimb] = useState(null);
  const [dayLogs, setDayLogs] = useState([]);
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
        const [list, climbs, runs, decs, logs, evs] = await Promise.all([
          base44.entities.Card.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
          base44.entities.Run.filter({ season_id: s.id }),
          base44.entities.Decay.filter({ season_id: s.id }),
          loadDayLogs(s.id),
          base44.entities.DecayEvent.filter({ season_id: s.id }, "-updated_date", 1).catch(() => []),
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
        setDayLogs(logs);
        const ev = demoDeathEvent(s, list) || (evs && evs[0]) || null;
        setDeathEv(ev);
        // A run that died moments ago whose death isn't recorded yet: the rot
        // may already have changed the cards, so keep showing the old deck.
        const justDied = runs
          .filter((r) => r.round_status === "died")
          .sort((a, b) => toMs(b.updated_date) - toMs(a.updated_date))[0];
        const deathPending =
          justDied &&
          Date.now() - toMs(justDied.updated_date) < 60000 &&
          !(ev && ev.run_id === justDied.id);
        if (!deathPending || !loadedOnce.current) {
          loadedOnce.current = true;
          setCards(sortDeck(mergePrintings(list.filter((c) => (c.zone || "main") === "main"))));
          setSideCards(
            sortDeck(mergePrintings(list.filter((c) => (c.zone || "main") === "sideboard")))
          );
        }
      } catch (e) {
        // keep last data on error
      }
    };
    const stopLive = liveReload(["Season", "Card", "Run", "Decay", "DayLog", "DecayEvent", "Climb"], load);
    return () => {
      active = false;
      stopLive();
    };
  }, []);

  // While the death screen plays, show the pre-rot deck; reveal afterwards.
  const deathBorn = deathEv ? toMs(deathEv.updated_at) || toMs(deathEv.created_date) : 0;
  const holdUntil = deathEv && deathEv.step === "death" ? deathBorn + DEATH_REVEAL_MS : 0;
  const holding = holdUntil > Date.now();
  useEffect(() => {
    if (!holding) return undefined;
    const t = setTimeout(() => setRevealTick((n) => n + 1), holdUntil - Date.now() + 50);
    return () => clearTimeout(t);
  }, [holding, holdUntil]);
  const cards = useMemo(
    () => (holding ? undoRot(rawCards, deathEv, "main") : rawCards),
    [rawCards, deathEv, holding]
  );
  const sideCards = useMemo(
    () => (holding ? undoRot(rawSideCards, deathEv, "sideboard") : rawSideCards),
    [rawSideCards, deathEv, holding]
  );

  // Chopping block: the sidebar alternates deck list (20s) and condemned card (8s).
  // While the death screen plays, the deck fades out and the condemned card is executed.
  const block = blockState(season);
  const condemnedRow = block
    ? [...rawCards, ...rawSideCards].find((c) => sameName(c.name, block.name))
    : null;
  const [blockTurn, setBlockTurn] = useState(false);
  useEffect(() => {
    if (!block || isOutro) {
      setBlockTurn(false);
      return undefined;
    }
    const t = setTimeout(() => setBlockTurn((b) => !b), blockTurn ? 8000 : 20000);
    return () => clearTimeout(t);
  }, [blockTurn, !!block, isOutro]);
  const rotMode = Boolean(holding && deathEv && !isOutro);
  // While the death screen shows the card over the game, the block waits empty.
  const rotAt = deathBorn + ROT_LEAD_MS;
  const [, setLeadTick] = useState(0);
  useEffect(() => {
    if (!rotMode || Date.now() >= rotAt) return undefined;
    const t = setTimeout(() => setLeadTick((x) => x + 1), rotAt - Date.now() + 30);
    return () => clearTimeout(t);
  }, [rotMode, rotAt]);
  const rotLive = rotMode && Date.now() >= rotAt;
  const sideMode = rotMode ? "rot" : blockTurn && block ? "block" : "deck";
  const day = useMemo(
    () =>
      roundDay({
        logs: dayLogs,
        climb,
        playing: run?.round_status === "playing",
      }),
    [dayLogs, climb, run]
  );

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

  const OUTER_PAD = 16;
  const PANEL_PAD_V = 28;
  const HEADER_H = 0;
  const SECTION_H = 30;
  const SUB_H = 22;
  const outroReserve = isOutro && n > 0 ? 100 : isOutro && n === 0 ? 60 : 0;
  const avail = TOTAL_HEIGHT - OUTER_PAD - PANEL_PAD_V - HEADER_H - outroReserve;

  const sectionsCount =
    1 +
    (finalSide.length ? 1 : 0) +
    (finalRustedMain.length || finalRustedSide.length ? 1 : 0);
  // MAIN / SIDEBOARD subheadings only when both have rotted cards
  const bothRotted = finalRustedMain.length > 0 && finalRustedSide.length > 0;
  const subsCount = bothRotted ? 2 : 0;
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
        padding: `${PANEL_TOP}px 0 0 ${PANEL_LEFT}px`,
        boxSizing: "border-box",
      }}
    >
<CtaPopup tone={Number(run?.round_losses) >= 1 ? "rot" : "gold"} blocked={rotMode || isOutro} />
      <style>{`
        @keyframes ovd-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes ovd-slidein { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes ovd-dropin { from { transform: translateY(-18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            width: PANEL_W,
            position: "relative",
            height: PANEL_H,
            // iron-to-rot border: ember at the top, steel, rot purple at the bottom
            border: "2px solid transparent",
            background:
              "linear-gradient(rgba(8,9,13,0.72), rgba(8,9,13,0.72)) padding-box, linear-gradient(180deg, #E8892F, #c7ced8 45%, #8a5cf0) border-box",
            boxShadow: "0 0 22px rgba(150,80,255,0.35)",
            borderRadius: 14,
            padding: "14px 12px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP, opacity: sideMode === "deck" ? 1 : 0, transition: "opacity 0.8s ease" }}>
            <SectionTitle title="MAIN DECK" count={mainCount} />
            {mainCards.map((c) => (
              <DeckRow
                key={c.id}
                card={c}
                variant="current"
                copies={animating ? dCopies(c) : undefined}
                height={rowH}
                rowWidth={ROW_W}
                corroding={animating && isCorroding(c)}
                entering={animating && isReplacementEntering(c)}
                salvaged={animating ? salvagedVisible(c) : undefined}
                glow={!!block && sameName(c.name, block.name)}
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
                rowWidth={ROW_W}
                    corroding={animating && isCorroding(c)}
                    entering={animating && isReplacementEntering(c)}
                    salvaged={animating ? salvagedVisible(c) : undefined}
                    glow={!!block && sameName(c.name, block.name)}
                  />
                ))}
              </>
            )}
            {(hasRustedMain || hasRustedSide) && (
              <>
                <SectionTitle title="ROTTED" count={rottedCount} />
                {hasRustedMain && (
                  <>
                    {hasRustedSide && <SubHeading title="MAIN" count={rustedMainCount} />}
                    {rustedMainCards.map((r) => (
                      <DeckRow
                        key={r.card.id}
                        card={r.card}
                        variant="rusted"
                        copies={animating ? dCopies(r.card) : undefined}
                        height={rowH}
                rowWidth={ROW_W}
                        entering={animating && isRustedEntering(r.card)}
                        glow={isOutro && todayRustedNames.has(r.card.name)}
                      />
                    ))}
                  </>
                )}
                {hasRustedSide && (
                  <>
                    {hasRustedMain && <SubHeading title="SIDEBOARD" count={rustedSideCount} />}
                    {rustedSideCards.map((r) => (
                      <DeckRow
                        key={r.card.id}
                        card={r.card}
                        variant="rusted"
                        copies={animating ? dCopies(r.card) : undefined}
                        height={rowH}
                rowWidth={ROW_W}
                        entering={animating && isRustedEntering(r.card)}
                        glow={isOutro && todayRustedNames.has(r.card.name)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
          {(block || rotMode) && (
            <div style={{ position: "absolute", inset: 0, opacity: sideMode === "deck" ? 0 : 1, transition: "opacity 0.8s ease" }}>
              <ChoppingBlock
                key={rotMode ? (rotLive ? "rot" : "wait") : "block"}
                mode={rotMode ? (rotLive ? "rot" : "wait") : "block"}
                name={rotMode ? deathEv.card_removed : block.name}
                image={rotMode ? deathEv.card_removed_image : scryNormal(condemnedRow?.scryfall_id)}
                day={block?.day}
                sentence={block?.sentence}
                recapture={block?.recapture}
                newName={rotMode ? deathEv.replacement_card : undefined}
                newImage={rotMode ? deathEv.replacement_card_image : undefined}
                rarity={rotMode ? deathEv.rarity_roll : undefined}
                rollCards={rotMode ? deathEv.roll_cards : undefined}
              />
            </div>
          )}
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