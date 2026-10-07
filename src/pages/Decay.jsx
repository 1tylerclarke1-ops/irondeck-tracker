import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import DecayStatus from "@/components/decay/DecayStatus";
import SpinWheel from "@/components/decay/SpinWheel";
import ReplacementPanel from "@/components/decay/ReplacementPanel";
import { num } from "@/components/run/runHelpers";

export default function Decay() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [runs, setRuns] = useState([]);
  const [decays, setDecays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decayedCard, setDecayedCard] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [applying, setApplying] = useState(false);

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

  if (completed) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AppNav />
        <h1 className="text-2xl font-bold mb-6">Decay</h1>
        <DecayStatus message="Decay complete" />
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

  const eligible = cards.filter(
    (c) => num(c.copies) > 0 && (c.rarity === "mythic" || c.rarity === "rare")
  );

  if (eligible.length === 0) {
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
  for (const c of eligible) {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      uniqueCards.push(c);
    }
  }

  const applyDecay = async (howObtained, rolled) => {
    setApplying(true);
    try {
      const newCopies = Math.max(num(decayedCard.copies) - 1, 0);
      await base44.entities.Card.update(decayedCard.id, { copies: newCopies });
      const now = new Date().toISOString();
      const existing = cards.find((c) => c.name === rolled.name);
      if (existing) {
        await base44.entities.Card.update(existing.id, {
          copies: num(existing.copies) + 1,
          is_decay_replacement: true,
          decayed_at: now,
        });
      } else {
        await base44.entities.Card.create({
          season_id: season.id,
          name: rolled.name,
          copies: 1,
          rarity: rolled.rarity,
          card_type: rolled.card_type,
          mana_cost: rolled.mana_cost || "",
          colours: rolled.colours || "",
          mana_value: rolled.mana_value ?? null,
          is_decay_replacement: true,
          decayed_at: now,
        });
      }
      await base44.entities.Decay.create({
        season_id: season.id,
        attempt_number: dueRun.attempt_number,
        card_removed: decayedCard.name,
        rarity_from: decayedCard.rarity,
        rarity_to: rolled.rarity,
        replacement_card: rolled.name,
        how_obtained: howObtained,
        date: new Date().toISOString(),
      });
      setCompleted(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-2">Decay</h1>
      <p className="text-muted-foreground mb-6">
        Decay due for run {num(dueRun.round_wins)}–{num(dueRun.round_losses)}
      </p>
      <div className="space-y-6">
        <SpinWheel cards={uniqueCards} onDecayed={setDecayedCard} />
        {decayedCard && (
          <ReplacementPanel
            decayedCard={decayedCard}
            rarity={decayedCard.rarity}
            season={season}
            deckCards={cards}
            onApply={applyDecay}
            applying={applying}
          />
        )}
      </div>
    </div>
  );
}