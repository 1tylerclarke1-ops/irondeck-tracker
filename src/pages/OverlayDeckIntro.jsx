import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadDayLogs, roundDay } from "@/lib/roundDay";
import IntroLayout from "@/components/overlay/IntroLayout";
import DeckIntroRecap from "@/components/overlay/DeckIntroRecap";
import Sentencing from "@/components/overlay/Sentencing";
import RulesIntro from "@/components/overlay/RulesIntro";
const LOGO_IMG = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/5c1ebc3bb_tdc-shield.png";
import useCardImagesById from "@/hooks/useCardImagesById";

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
  const [recapDone, setRecapDone] = useState(false);
  const [sentenceDone, setSentenceDone] = useState(false);
  const [badgeOn, setBadgeOn] = useState(false);
  const [rulesDone, setRulesDone] = useState(false);
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
  // Rules play on Season 1, Day 1 (or force with ?rules=on, skip with ?rules=off)
  const showRules = rulesParam === "on" || (rulesParam !== "off" && seasonNumber === 1 && day === 1);

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
      {showRules && !rulesDone && (
        <RulesIntro active={recapDone || recapOff} onDone={() => setRulesDone(true)} />
      )}
      {!recapDone && !recapOff && (
        <DeckIntroRecap season={season} onBadge={() => setBadgeOn(true)} onDone={() => setRecapDone(true)} />
      )}
      {!sentenceDone && (
        <Sentencing season={season} cards={allCards}
          active={(recapDone || recapOff) && (!showRules || rulesDone)}
          onDone={() => setSentenceDone(true)} />
      )}
      {(badgeOn || recapDone || recapOff) && (
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