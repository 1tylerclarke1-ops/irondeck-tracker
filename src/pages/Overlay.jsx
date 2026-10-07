import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function Overlay() {
  const [data, setData] = useState(null);

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
          setData({ season: null });
          return;
        }
        const [runs, cards] = await Promise.all([
          base44.entities.Run.filter({ season_id: season.id }),
          base44.entities.Card.filter({ season_id: season.id }),
        ]);
        if (!active) return;
        const sortedRuns = [...runs].sort(
          (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
        );
        const currentRun =
          runs.find((r) => r.result === "in_progress") || sortedRuns[0] || null;
        const bestRun = runs.reduce(
          (m, r) => Math.max(m, r.total_wins || 0),
          0
        );
        const mythics = cards
          .filter((c) => c.rarity === "mythic")
          .reduce((s, c) => s + (c.copies || 0), 0);
        const rares = cards
          .filter((c) => c.rarity === "rare")
          .reduce((s, c) => s + (c.copies || 0), 0);
        setData({ season, currentRun, bestRun, mythics, rares });
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

  const s = data;

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ background: "transparent" }}
    >
      <div
        className="flex gap-16 text-white"
        style={{
          fontFamily: "sans-serif",
          textShadow: "0 2px 8px rgba(0,0,0,0.85)",
        }}
      >
        <Stat
          label="Attempt"
          value={s?.currentRun ? `#${s.currentRun.attempt_number}` : "—"}
        />
        <Stat label="Stage" value={s?.currentRun?.stage ?? "—"} />
        <Stat
          label="Stage Wins"
          value={s?.currentRun ? `${s.currentRun.stage_wins || 0}/7` : "—"}
        />
        <Stat
          label="Stage Losses"
          value={s?.currentRun ? `${s.currentRun.stage_losses || 0}/2` : "—"}
        />
        <Stat label="Run Wins" value={s?.currentRun?.total_wins ?? "—"} />
        <Stat label="Best Run" value={s?.bestRun ?? "—"} />
        <Stat label="Mythics" value={s?.mythics ?? "—"} />
        <Stat label="Rares" value={s?.rares ?? "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <span style={{ fontSize: "1rem", opacity: 0.75 }}>{label}</span>
      <span style={{ fontSize: "3rem", fontWeight: 700 }}>{value}</span>
    </div>
  );
}