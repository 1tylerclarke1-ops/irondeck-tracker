import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import RunPanel from "@/components/run/RunPanel";
import RunResult from "@/components/run/RunResult";
import BestRun from "@/components/run/BestRun";
import { useDeckRules } from "@/lib/useDeckRules";
import { num } from "@/components/run/runHelpers";

export default function RunTracker() {
  const [season, setSeason] = useState(null);
  const [runs, setRuns] = useState([]);
  const [cards, setCards] = useState([]);
  const [decays, setDecays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

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

  const loadCards = useCallback(async (seasonId) => {
    const list = await base44.entities.Card.filter({ season_id: seasonId });
    setCards(list);
  }, []);

  const loadDecays = useCallback(async (seasonId) => {
    const list = await base44.entities.Decay.filter({ season_id: seasonId });
    setDecays(list);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const found = await loadSeason();
      if (found) {
        await loadRuns(found.id);
        await loadCards(found.id);
        await loadDecays(found.id);
      } else {
        setRuns([]);
        setCards([]);
        setDecays([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadSeason, loadRuns, loadCards, loadDecays]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sorted = [...runs].sort((a, b) => b.attempt_number - a.attempt_number);
  const inProgress = runs.find((r) => r.result === "in_progress");
  const latest = sorted[0];

  const { rules, allPass } = useDeckRules(cards);
  const rulesLoading = rules.some((r) => r.pass === null || r.loading);
  const failingRules = rules.filter((r) => r.pass === false).map((r) => r.label);

  const decayDue = runs.some(
    (r) =>
      r.result === "died" &&
      !decays.some((d) => d.attempt_number === r.attempt_number)
  );

  const snapshot = (r) => ({
    stage_wins: num(r.stage_wins),
    stage_losses: num(r.stage_losses),
    stage: num(r.stage, 1),
    total_wins: num(r.total_wins),
    result: r.result,
    stage_cleared_pending: Boolean(r.stage_cleared_pending),
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
        stage_cleared_pending: false,
        result: "in_progress",
      });
      setHistory([]);
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
      const tw = num(inProgress.total_wins);
      const newStageWins = sw + 1;
      const newTotalWins = tw + 1;
      let update;
      if (newStageWins >= 7) {
        update = {
          stage_wins: 7,
          total_wins: newTotalWins,
          stage_cleared_pending: true,
          result: "in_progress",
        };
      } else {
        update = {
          stage_wins: newStageWins,
          total_wins: newTotalWins,
          stage_cleared_pending: false,
          result: "in_progress",
        };
      }
      await base44.entities.Run.update(inProgress.id, update);
      setHistory((h) => [...h, prev]);
      await loadRuns(season.id);
    } finally {
      setBusy(false);
    }
  };

  const continueStage = async () => {
    setBusy(true);
    try {
      const prev = snapshot(inProgress);
      const st = num(inProgress.stage, 1);
      await base44.entities.Run.update(inProgress.id, {
        stage: st + 1,
        stage_wins: 0,
        stage_losses: 0,
        stage_cleared_pending: false,
        result: "in_progress",
      });
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
              onWin={recordWin}
              onLoss={recordLoss}
              onContinue={continueStage}
              onUndo={undo}
              canUndo={history.length > 0}
              busy={busy}
            />
          ) : (
            <RunResult
              run={latest}
              onStart={startRun}
              starting={busy}
              canStart={allPass}
              failingRules={failingRules}
              rulesLoading={rulesLoading}
              decayDue={decayDue}
            />
          )}
        </div>
      )}
    </div>
  );
}