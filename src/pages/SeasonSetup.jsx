import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import SeasonForm from "@/components/season/SeasonForm";
import ActiveSeasonPanel from "@/components/season/ActiveSeasonPanel";
import DeckCounters from "@/components/season/DeckCounters";
import DecklistTable from "@/components/season/DecklistTable";
import CardForm from "@/components/season/CardForm";

export default function SeasonSetup() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  const loadSeason = useCallback(async () => {
    const active = await base44.entities.Season.filter({ status: "active" });
    const found = active.length > 0 ? active[0] : null;
    setSeason(found);
    return found;
  }, []);

  const loadCards = useCallback(async (seasonId) => {
    const cardList = await base44.entities.Card.filter({ season_id: seasonId });
    setCards(cardList);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const found = await loadSeason();
      if (found) await loadCards(found.id);
      else setCards([]);
    } finally {
      setLoading(false);
    }
  }, [loadSeason, loadCards]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await base44.entities.Season.update(season.id, { status: "ended" });
      await loadAll();
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Season Setup</h1>
      {!season ? (
        <SeasonForm onCreated={loadAll} />
      ) : (
        <>
          <ActiveSeasonPanel season={season} onEnd={handleEnd} ending={ending} />
          <DeckCounters cards={cards} />
          <CardForm seasonId={season.id} onAdded={() => loadCards(season.id)} />
          <DecklistTable cards={cards} onChange={() => loadCards(season.id)} />
        </>
      )}
    </div>
  );
}