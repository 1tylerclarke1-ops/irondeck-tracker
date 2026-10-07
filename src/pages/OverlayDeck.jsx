import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DeckRow from "@/components/overlay/DeckRow";

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

export default function OverlayDeck() {
  const [cards, setCards] = useState([]);

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
        const season = seasons && seasons[0];
        if (!season) {
          setCards([]);
          return;
        }
        const list = await base44.entities.Card.filter({ season_id: season.id });
        if (!active) return;
        const main = list.filter((c) => (c.zone || "main") === "main");
        setCards(sortDeck(main));
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

  return (
    <div
      style={{
        background: "transparent",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: "1rem 1rem 2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.22rem",
          width: 340,
        }}
      >
        {cards.map((c) => (
          <DeckRow key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}