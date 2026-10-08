import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import DecayStatus from "@/components/decay/DecayStatus";
import { Button } from "@/components/ui/button";
import { num } from "@/components/run/runHelpers";

const ts = (d) => (d?.date ? new Date(d.date).getTime() : 0);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function Decay() {
  const [season, setSeason] = useState(null);
  const [decays, setDecays] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const active = await base44.entities.Season.filter({ status: "active" });
      const found = active.length > 0 ? active[0] : null;
      setSeason(found);
      if (found) {
        const [decayList, eventList] = await Promise.all([
          base44.entities.Decay.filter({ season_id: found.id }),
          base44.entities.DecayEvent.list("-updated_date", 1),
        ]);
        setDecays(decayList);
        setEvent(eventList && eventList.length ? eventList[0] : null);
      } else {
        setDecays([]);
        setEvent(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const replay = async () => {
    if (!event?.id) return;
    setReplaying(true);
    try {
      await base44.entities.DecayEvent.update(event.id, {
        step: "death",
        updated_at: new Date().toISOString(),
      });
      await loadAll();
    } finally {
      setReplaying(false);
    }
  };

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

  const latest = [...decays].sort((a, b) => ts(b) - ts(a))[0];

  if (!latest) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <AppNav />
        <h1 className="text-2xl font-bold mb-6">Decay</h1>
        <DecayStatus message="No decay yet" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-6">Decay</h1>
      <div className="rounded-lg border p-6 space-y-3">
        <div className="text-sm text-muted-foreground">Latest decay</div>
        <div className="text-lg font-semibold">{latest.card_removed}</div>
        <div className="text-sm text-muted-foreground">
          {cap(latest.rarity_from)} → {cap(latest.rarity_to)}
        </div>
        <div className="text-sm">
          Replacement: <span className="font-medium">{latest.replacement_card}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          How obtained: <span className="capitalize">{latest.how_obtained}</span>
          {" · "}
          Zone: <span className="capitalize">{latest.zone || "main"}</span>
          {latest.attempt_number != null && (
            <> · Attempt #{num(latest.attempt_number)}</>
          )}
        </div>
        {latest.date && (
          <div className="text-sm text-muted-foreground">
            {new Date(latest.date).toLocaleString()}
          </div>
        )}
        <div className="pt-2">
          <Button onClick={replay} disabled={!event || replaying}>
            {replaying ? "Replaying…" : "Replay"}
          </Button>
        </div>
      </div>
    </div>
  );
}