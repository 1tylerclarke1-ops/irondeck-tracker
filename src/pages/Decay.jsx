import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import DecayStatus from "@/components/decay/DecayStatus";
import SpinWheel from "@/components/decay/SpinWheel";
import { num } from "@/components/run/runHelpers";

export default function Decay() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [runs, setRuns] = useState([]);
  const [decays, setDecays] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const active = await base44.entities.Season.filter({ status: "active" });
      const found = active.length > 0 ? active[0] : null;
      setSeason(found);
      if (found) {
        const [cardList, runList, decayList] = await Promise.all([
          base44.entities.Card.filter({ season_id: found.id }),
          base44.entities.Run.filter({ season_id: found.id }),
          base44.entities.Decay.filter({ season_id: found.id }),
        ]);
        setCards(cardList);
        setRuns(runList);
        setDecays(decayList);
      } else {
        setCards([]);
        setRuns([]);
        setDecays([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AppNav />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AppNav />
        <NoSeason />
      </div>
    );
  }

  const decayAttempts = new Set(decays.map((d) => num(d.attempt_number)));
  const dueRun = runs
    .filter((r) => r.result === "died" && !decayAttempts.has(num(r.attempt_number)))
    .sort((a, b) => num(b.attempt_number) - num(a.attempt_number))[0];

  if (!dueRun) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AppNav />
        <h1 className="text-2xl font-bold mb-6">Decay</h1>
        <DecayStatus message="No decay due" />
      </div>
    );
  }

  const eligible = cards.filter((c) => num(c.copies) > 0 && c.rarity !== "basic");
  const mythics = eligible.filter((c) => c.rarity === "mythic");
  const rares = eligible.filter((c) => c.rarity === "rare");

  let targetRarity = null;
  let pool = [];
  if (mythics.length > 0) {
    targetRarity = "mythic";
    pool = mythics;
  } else if (rares.length > 0) {
    targetRarity = "rare";
    pool = rares;
  }

  if (!targetRarity) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AppNav />
        <h1 className="text-2xl font-bold mb-6">Decay</h1>
        <DecayStatus message="Season over – the last rare is gone" />
      </div>
    );
  }

  const seen = new Set();
  const uniqueCards = [];
  for (const c of pool) {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      uniqueCards.push(c);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-2">Decay</h1>
      <p className="text-muted-foreground mb-6">
        Decay due for Attempt #{dueRun.attempt_number}
      </p>
      <SpinWheel cards={uniqueCards} rarity={targetRarity} />
    </div>
  );
}