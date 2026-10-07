import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import RunPanel from "@/components/run/RunPanel";
import RunResult from "@/components/run/RunResult";
import BestRun from "@/components/run/BestRun";
import { num } from "@/components/run/runHelpers";

export default function RunTracker() {
  const [season, setSeason] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [clearedStage, setClearedStage] = useState(null);

  const loadSeason = useCallback(async () => {
    const active = await base44.entities.Season.filter({ status: "active" });
    const found = active.length > 0 ? active[0] : null;
    setSeason(found);
    return found;
  }, []);

  const loadRuns = useCallback(async (seasonId) => {
    const list = await base44.entities.Run.filter({ season_id: seasonId });
    setRuns(list);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const found = await loadSeason();
      if (found) await loadRuns(found.id);
      else setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [loadSeason, loadRuns]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sorted = [...runs].sort((a, b) => b.attempt_number - a.attempt_number);
  const inProgress = runs.find((r) => r.result === "in_progress");
  const latest = sorted[0];

  const snapshot = (r) => ({
    stage_wins: num(r.stage_wins),
    stage_losses: num(r.stage_losses),
    stage: num(r.stage, 1),
    total_wins: num(r.total_wins),
    result: r.result,
  });

  const startRun = async () => {
    setBusy(true);
    try {
      const maxAttempt = runs.reduce(
        (max, r) => (r.attempt_number > max ? r.attempt_number : max),
        0
      );
      await base44.entities.Run.create({
        season_id: season.id,
        attempt_number: maxAttempt + 1,
        wins: 0,
        losses: 0,
        stage: 1,
        stage_wins: 0,
        stage_losses: 0,
        total_wins: 0,
        result: "in_progress",
      });
      setHistory([]);
      setClearedStage(null);
      await loadRuns(season.id);
    } finally {
      setBusy(false);
    }
  };

  const recordWin = async () => {
    setBusy(true);
    try {
      const prev = snapshot(inProgress);
      const sw = num(inProgress.stage_wins);
      const sl = num(inProgress.stage_losses);
      const st = num(inProgress.stage, 1);
      const tw = num(inProgress.total_wins);
      const newStageWins = sw + 1;
      const newTotalWins = tw + 1;
      let update;
      if (newStageWins >= 7) {
        update = {
          stage_wins: 0,
          stage_losses: 0,
          stage: st + 1,
          total_wins: newTotalWins,
          result: "in_progress",
        };
        setClearedStage({ stage: st, stage_wins: newStageWins, stage_losses: sl });
      } else {
        update = {
          stage_wins: newStageWins,
          total_wins: newTotalWins,
          result: "in_progress",
        };
        setClearedStage(null);
      }
      await base44.entities.Run.update(inProgress.id, update);
      setHistory((h) => [...h, prev]);
      await loadRuns(season.id);
    } finally {
      setBusy(false);
    }
  };

  const recordLoss = async () => {
    setBusy(true);
    try {
      const prev = snapshot(inProgress);
      const newStageLosses = num(inProgress.stage_losses) + 1;
      const died = newStageLosses >= 2;
      await base44.entities.Run.update(inProgress.id, {
        stage_losses: newStageLosses,
        result: died ? "died" : "in_progress",
      });
      setHistory((h) => [...h, prev]);
      setClearedStage(null);
      await loadRuns(season.id);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const target = inProgress || latest;
    if (!target) return;
    setBusy(true);
    try {
      await base44.entities.Run.update(target.id, prev);
      setHistory((h) => h.slice(0, -1));
      setClearedStage(null);
      await loadRuns(season.id);
    } finally {
      setBusy(false);
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-6">Run Tracker</h1>
      {!season ? (
        <NoSeason />
      ) : (
        <div className="space-y-6">
          <BestRun runs={runs} />
          {inProgress ? (
            <RunPanel
              run={inProgress}
              clearedStage={clearedStage}
              onWin={recordWin}
              onLoss={recordLoss}
              onUndo={undo}
              canUndo={history.length > 0}
              busy={busy}
            />
          ) : (
            <RunResult run={latest} onStart={startRun} starting={busy} />
          )}
        </div>
      )}
    </div>
  );
}