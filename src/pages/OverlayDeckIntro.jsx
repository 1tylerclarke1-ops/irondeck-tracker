import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs, roundDay } from "@/lib/roundDay";
import IntroLayout from "@/components/overlay/IntroLayout";
import DeckIntroRecap from "@/components/overlay/DeckIntroRecap";
import Sentencing from "@/components/overlay/Sentencing";
import RulesIntro from "@/components/overlay/RulesIntro";
import { RulesCard, PardonMoment, MilestoneBanner, SeasonReview } from "@/components/overlay/IntroStages";
import { planIntro } from "@/lib/introRoute";
import { ukDate } from "@/lib/ukDay";
const LOGO_IMG = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
import useCardImagesById from "@/hooks/useCardImagesById";
import StartGate from "@/components/overlay/StartGate";

function sortDeck(list) {
  const key = (c) => (c.card_type === "land" ? 999 : Number(c.mana_value) || 0);
  return [...list].sort((a, b) => key(a) - key(b) || (a.name || "").localeCompare(b.name || ""));
}

export default function OverlayDeckIntro() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [runs, setRuns] = useState([]);
  const [climbs, setClimbs] = useState([]);
  const [climb, setClimb] = useState(null);
  const [dayLogs, setDayLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState(null); // which opening plays (decided once, from the data)
  const [idx, setIdx] = useState(0); // current stage
  const [badgeOn, setBadgeOn] = useState(false);
  const [go, setGo] = useState(false); // waits for OBS recording + 3-2-1 (see StartGate)
  const rulesParam = useMemo(() => new URLSearchParams(window.location.search).get("rules"), []);
  const [stageScale, setStageScale] = useState(1);
  useEffect(() => {
    const fit = () => setStageScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const recapOff = useMemo(
    () => new URLSearchParams(window.location.search).get("recap") === "off",
    []
  );

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "#0d1016";
    body.style.background = "#0d1016";
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
          setAllCards([]);
          setRuns([]);
          setClimbs([]);
          setClimb(null);
          return;
        }
        const [list, climbList, runList, logs] = await Promise.all([
          base44.entities.Card.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
          base44.entities.Run.filter({ season_id: s.id }),
          loadDayLogs(s.id),
        ]);
        if (!active) return;
        const sortedClimbs = [...climbList].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        setSeason(s);
        setClimbs(sortedClimbs);
        setClimb(sortedClimbs[0] || null);
        setRuns(runList);
        setDayLogs(logs);
        setAllCards(list);
        setCards(sortDeck(list.filter((c) => (c.zone || "main") === "main" && (Number(c.copies) || 0) > 0)));
        setLoaded(true);
      } catch (e) {
        // keep last data on error
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const day = useMemo(
    () =>
      roundDay({
        logs: dayLogs,
        climb,
        playing: runs.some((r) => r.round_status === "playing"),
      }),
    [dayLogs, climb, runs]
  );

  const seasonNumber = season?.season_number ?? null;

  // Decide the opening once, when the data first arrives, so it never changes
  // mid-play (e.g. when Start Round is pressed while the intro runs).
  useEffect(() => {
    if (!loaded || plan || !season) return;
    setPlan(planIntro({ seasonNumber, logs: dayLogs, season, today: ukDate(), rulesParam }));
  }, [loaded, plan, season, seasonNumber, dayLogs, rulesParam]);

  const stages = plan?.stages || ["recap"];
  const cur = stages[idx];
  const next = useCallback((i) => setIdx((x) => (x === i ? x + 1 : x)), []);

  // The "deck" stage just shows the deck for a while before the wheel.
  useEffect(() => {
    if (cur !== "deck") return undefined;
    const t = setTimeout(() => next(idx), 9000);
    return () => clearTimeout(t);
  }, [cur, idx, next]);

  const scryfallIds = useMemo(() => {
    const ids = Array.from(
      new Set(allCards.map((c) => c.scryfall_id).filter(Boolean))
    );
    ids.sort();
    return ids;
  }, [allCards]);

  const images = useCardImagesById(scryfallIds);

  const num = (v) => Number(v) || 0;
  const currentRun =
    runs.find((r) => r.result === "in_progress") ||
    [...runs].sort((a, b) => num(b.attempt_number) - num(a.attempt_number))[0] || null;
  const best = runs.reduce((m, r) => Math.max(m, num(r.total_wins)), 0);
  const completed = climbs.filter((c) => c.status === "complete" && c.days_taken != null);
  const record = completed.length ? Math.min(...completed.map((c) => c.days_taken)) : null;
  const rottedCount = allCards.reduce((sum, c) => {
    const o = num(c.original_copies);
    return o > 0 ? sum + Math.max(0, o - num(c.copies)) : sum;
  }, 0);
  const sideCards = sortDeck(
    allCards.filter((c) => c.zone === "sideboard" && num(c.copies) > 0)
  );
  const rottedCards = allCards
    .map((c) => ({ card: c, rotted: Math.max(0, num(c.original_copies) - num(c.copies)) }))
    .filter((r) => num(r.card.original_copies) > 0 && r.rotted > 0)
    .sort((a, b) => b.rotted - a.rotted);
  const zoneCount = (zone) =>
    allCards.filter((c) => (c.zone || "main") === zone).reduce((sum, c) => sum + num(c.copies), 0);

      if (!go) return <StartGate onGo={() => setGo(true)} />;

  return (
    <>
      <IntroLayout
        seasonNumber={seasonNumber}
        day={day}
        runWins={currentRun ? num(currentRun.total_wins) : null}
        best={best}
        record={record}
        rottedCount={rottedCount}
        sideboardCount={zoneCount("sideboard")}
        mainCount={zoneCount("main")}
        cards={cards}
        sideCards={sideCards}
        rottedCards={rottedCards}
        images={images}
      />
      {/* The current stage, with the next one already mounted underneath, so
          stages hand over without the deck flashing in between. */}
      {[idx, idx + 1].map((i) => {
        const key = stages[i];
        if (!key || key === "deck" || key === "end") return null;
        if (i === idx + 1 && (cur === "deck" || !plan)) return null;
        const active = i === idx;
        const done = () => next(i);
        let el = null;
        if (key === "recap")
          el = recapOff ? null : <DeckIntroRecap season={season} onBadge={() => setBadgeOn(true)} onDone={done} />;
        if (key === "rules") el = <RulesIntro active={active} onDone={done} />;
        if (key === "rulesCard") el = <RulesCard active={active} seasonNumber={seasonNumber} onDone={done} />;
        if (key === "review")
          el = <SeasonReview active={active} season={season} seasonNumber={seasonNumber} allCards={allCards} cardImages={images} onDone={done} />;
        if (key === "milestone") el = <MilestoneBanner active={active} items={plan?.milestones} onDone={done} />;
        if (key === "pardon") {
          const pName = season?.last_pardoned || "";
          const pCard = allCards.find((c) => c.name === pName);
          let times = 1;
          try { times = Number(JSON.parse(season?.pardon_counts || "{}")[pName]) || 1; } catch { times = 1; }
          el = <PardonMoment active={active} name={pName} times={times}
            image={pCard?.scryfall_id ? `https://api.scryfall.com/cards/${pCard.scryfall_id}?format=image&version=normal` : ""} onDone={done} />;
        }
        if (key === "wheel")
          el = <Sentencing season={season} cards={allCards} active={active} fadeIn={stages[i - 1] === "deck"} onDone={done} />;
        return (
          <div key={`${i}-${key}`} style={{ position: "fixed", inset: 0, zIndex: active ? 62 : 61, pointerEvents: "none" }}>
            {el}
          </div>
        );
      })}
      {recapOff && cur === "recap" && <SkipRecap onSkip={() => next(0)} />}
      {(badgeOn || idx > 0 || recapOff) && (
        <div style={{ position: "fixed", left: "50%", top: "50%", width: 1920, height: 1080, zIndex: 70, pointerEvents: "none",
          transform: `translate(-50%, -50%) scale(${stageScale})` }}>
          <img src={LOGO_IMG} alt="" draggable={false}
            style={{ position: "absolute", left: 17, top: 40, height: 190, width: "auto", maxWidth: "none",
              filter: "drop-shadow(0 0 18px rgba(255,110,20,0.55)) drop-shadow(0 6px 10px #000)" }} />
        </div>
      )}
    </>
  );
}

// ?recap=off: skip the shield and recap straight to the next stage.
function SkipRecap({ onSkip }) {
  useEffect(() => { onSkip(); }, [onSkip]);
  return null;
}