import React, { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import DeckCardTile from "@/components/overlay/DeckCardTile";
import DeckIntroRecap from "@/components/overlay/DeckIntroRecap";
import useCardImagesById from "@/hooks/useCardImagesById";

export default function OverlayDeckIntro() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
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
          setClimb(null);
          return;
        }
        const [list, climbs] = await Promise.all([
          base44.entities.Card.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
        ]);
        if (!active) return;
        const sortedClimbs = [...climbs].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        setSeason(s);
        setClimb(sortedClimbs[0] || null);
        setCards(list.filter((c) => (c.zone || "main") === "main"));
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
    if (climb.status === "active" && climb.start_date) {
      return differenceInCalendarDays(new Date(), new Date(climb.start_date)) + 1;
    }
    if (climb.status === "complete") return climb.days_taken || null;
    return null;
  }, [climb]);

  const seasonNumber = season?.season_number ?? null;

  const scryfallIds = useMemo(() => {
    const ids = Array.from(
      new Set(cards.map((c) => c.scryfall_id).filter(Boolean))
    );
    ids.sort();
    return ids;
  }, [cards]);

  const images = useCardImagesById(scryfallIds);

  const title = `Season ${seasonNumber ?? "—"} · Day ${day ?? "—"}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0d1016 0%, #1a1d24 100%)",
        color: "#fff",
        fontFamily: "sans-serif",
        padding: "1.5rem 1.5rem 2.5rem",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "2rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          margin: "0 0 1.5rem",
          color: "#fff",
        }}
      >
        {title}
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {cards.map((c) => (
          <DeckCardTile
            key={c.id}
            card={c}
            imageUrl={images[c.scryfall_id]?.normal}
            loading={
              Boolean(c.scryfall_id) && images[c.scryfall_id] === undefined
            }
          />
        ))}
      </div>
      {!recapDone && !recapOff && (
        <DeckIntroRecap
          season={season}
          onDone={() => setRecapDone(true)}
        />
      )}
    </div>
  );
}