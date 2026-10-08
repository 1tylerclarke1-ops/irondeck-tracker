import React, { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import IntroLayout from "@/components/overlay/IntroLayout";
import DeckIntroRecap from "@/components/overlay/DeckIntroRecap";
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
  const [recapDone, setRecapDone] = useState(false);
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
        const [list, climbList, runList] = await Promise.all([
          base44.entities.Card.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
          base44.entities.Run.filter({ season_id: s.id }),
        ]);
        if (!active) return;
        const sortedClimbs = [...climbList].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        setSeason(s);
        setClimbs(sortedClimbs);
        setClimb(sortedClimbs[0] || null);
        setRuns(runList);
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

  const day = useMemo(() => {
    if (!climb) return null;
    if (climb.status === "active" && climb.start_date) {
      return differenceInCalendarDays(new Date(), new Date(climb.start_date)) + 1;
    }
    if (climb.status === "complete") return climb.days_taken || null;
    return null;
  }, [climb]);

  const seasonNumber = season?.season_number ?? null;

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
      {!recapDone && !recapOff && (
        <DeckIntroRecap season={season} onDone={() => setRecapDone(true)} />
      )}
    </>
  );
}