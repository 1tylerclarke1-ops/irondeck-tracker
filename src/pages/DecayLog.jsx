import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import DecayLogTotals from "@/components/decay/DecayLogTotals";
import DecayLogTable from "@/components/decay/DecayLogTable";

const ts = (d) => (d?.date ? new Date(d.date).getTime() : 0);

export default function DecayLog() {
  const [season, setSeason] = useState(null);
  const [decays, setDecays] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const active = await base44.entities.Season.filter({ status: "active" });
      const found = active.length > 0 ? active[0] : null;
      setSeason(found);
      if (found) {
        const list = await base44.entities.Decay.filter({ season_id: found.id });
        setDecays(list);
      } else {
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
      <div className="max-w-5xl mx-auto p-6">
        <AppNav />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <AppNav />
        <NoSeason />
      </div>
    );
  }

  const chrono = [...decays].sort((a, b) => ts(a) - ts(b));
  const numberMap = {};
  chrono.forEach((d, i) => {
    numberMap[d.id] = i + 1;
  });
  const rows = [...decays]
    .sort((a, b) => ts(b) - ts(a))
    .map((d) => ({ ...d, decay_number: numberMap[d.id] }));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-6">Decay Log</h1>
      <DecayLogTotals decays={decays} />
      <DecayLogTable rows={rows} />
    </div>
  );
}