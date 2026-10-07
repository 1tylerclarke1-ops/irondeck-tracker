import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import SeasonForm from "@/components/season/SeasonForm";
import ActiveSeasonPanel from "@/components/season/ActiveSeasonPanel";
import DeckCounters from "@/components/season/DeckCounters";
import DecklistTable from "@/components/season/DecklistTable";
import CardForm from "@/components/season/CardForm";
import ArenaImport from "@/components/season/ArenaImport";
import RefreshCardData from "@/components/season/RefreshCardData";
import RulesChecklist from "@/components/season/RulesChecklist";
import AppNav from "@/components/AppNav";

export default function SeasonSetup() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [runs, setRuns] = useState([]);
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

  const loadRuns = useCallback(async (seasonId) => {
    const list = await base44.entities.Run.filter({ season_id: seasonId });
    setRuns(list);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const found = await loadSeason();
      if (found) {
        await loadCards(found.id);
        await loadRuns(found.id);
      } else {
        setCards([]);
        setRuns([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadSeason, loadCards, loadRuns]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await base44.entities.Season.update(season.id, { status: "ended" });
      const allClimbs = await base44.entities.Climb.list();
      const sorted = [...allClimbs].sort(
        (a, b) => (b.number || 0) - (a.number || 0)
      );
      const latestClimb = sorted[0];
      if (latestClimb && latestClimb.status === "complete") {
        await base44.entities.Climb.create({
          number: (latestClimb.number || 0) + 1,
          start_date: new Date().toISOString().slice(0, 10),
          status: "active",
        });
      }
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

  const locked = runs.length > 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <AppNav />
      <h1 className="text-2xl font-bold">Season Setup</h1>
      {!season ? (
        <SeasonForm onCreated={loadAll} />
      ) : (
        <>
          <ActiveSeasonPanel season={season} onEnd={handleEnd} ending={ending} />
          <DeckCounters cards={cards} />
          <RulesChecklist cards={cards} />
          {locked && (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-700 dark:text-blue-300">
              Decklist locked: this season has runs. Use the Decay page to change cards.
            </div>
          )}
          <RefreshCardData
            seasonId={season.id}
            cards={cards}
            onRefreshed={() => loadCards(season.id)}
          />
          {!locked && (
            <>
              <CardForm seasonId={season.id} onAdded={() => loadCards(season.id)} />
              <ArenaImport seasonId={season.id} onImported={() => loadCards(season.id)} />
            </>
          )}
          <DecklistTable
            cards={cards}
            onChange={() => loadCards(season.id)}
            locked={locked}
          />
        </>
      )}
    </div>
  );
}