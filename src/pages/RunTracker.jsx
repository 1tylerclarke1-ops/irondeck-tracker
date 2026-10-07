import React, { useEffect, useState, useCallback } from "react";
import { differenceInCalendarDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import RunStats from "@/components/run/RunStats";
import RoundPanel from "@/components/run/RoundPanel";
import BestRun from "@/components/run/BestRun";
import { useDeckRules } from "@/lib/useDeckRules";
import { num } from "@/components/run/runHelpers";

export default function RunTracker() {
  const [season, setSeason] = useState(null);
  const [runs, setRuns] = useState([]);
  const [cards, setCards] = useState([]);
  const [decays, setDecays] = useState([]);
  const [climb, setClimb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mythicBusy, setMythicBusy] = useState(false);
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

  const loadClimb = useCallback(async () => {
    const all = await base44.entities.Climb.list();
    const sorted = [...all].sort((a, b) => (b.number || 0) - (a.number || 0));
    setClimb(sorted[0] || null);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const found = await loadSeason();
      await loadClimb();
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
  }, [loadSeason, loadRuns, loadCards, loadDecays, loadClimb]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sortedRuns = [...runs].sort(
    (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
  );
  const inProgress = runs.find((r) => r.result === "in_progress");
  const latest = sortedRuns[0];

  const { rules, allPass } = useDeckRules(cards);
  const rulesLoading = rules.some((r) => r.pass === null || r.loading);
  const failingRules = rules.filter((r) => r.pass === false).map((r) => r.label);

  const decayDue = runs.some(
    (r) =>
      r.result === "died" &&
      !decays.some((d) => d.attempt_number === r.attempt_number)
  );

  const snapshot = (r) => ({
    total_wins: num(r.total_wins),
    round_wins: num(r.round_wins),
    round_losses: num(r.round_losses),
    round_status: r.round_status,
    result: r.result,
  });

  const startRound = async () => {
    setBusy(true);
    try {
      if (inProgress) {
        const prev = snapshot(inProgress);
        await base44.entities.Run.update(inProgress.id, {
          round_wins: 0,
          round_losses: 0,
          round_status: "playing",
        });
        setHistory((h) => [...h, prev]);
      } else {
        const maxAttempt = runs.reduce(
          (max, r) => Math.max(max, r.attempt_number || 0),
          0
        );
        await base44.entities.Run.create({
          season_id: season.id,
          attempt_number: maxAttempt + 1,
          wins: 0,
          losses: 0,
          total_wins: 0,
          round_wins: 0,
          round_losses: 0,
          round_status: "playing",
          result: "in_progress",
        });
        setHistory([]);
      }
      await loadRuns(season.id);
    } finally {
      setBusy(false);
    }
  };

  const recordWin = async () => {
    setBusy(true);
    try {
      const prev = snapshot(inProgress);
      const newRoundWins = num(inProgress.round_wins) + 1;
      const newRunWins = num(inProgress.total_wins) + 1;
      const update = {
        round_wins: newRoundWins,
        total_wins: newRunWins,
      };
      if (newRoundWins >= 7) {
        update.round_status = "survived";
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
      const newRoundLosses = num(inProgress.round_losses) + 1;
      const update = { round_losses: newRoundLosses };
      if (newRoundLosses >= 2) {
        update.round_status = "died";
        update.result = "died";
      }
      await base44.entities.Run.update(inProgress.id, update);
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

  const completeMythic = async () => {
    if (!climb || climb.status !== "active") return;
    setMythicBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const start = climb.start_date ? new Date(climb.start_date) : null;
      const days = start
        ? differenceInCalendarDays(new Date(today), start) + 1
        : 1;
      await base44.entities.Climb.update(climb.id, {
        mythic_date: today,
        days_taken: days,
        status: "complete",
      });
      await loadClimb();
    } finally {
      setMythicBusy(false);
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

  let phase;
  if (inProgress) {
    phase = inProgress.round_status === "playing" ? "playing" : "ready";
  } else if (latest && latest.result === "died" && decayDue) {
    phase = "died-blocked";
  } else {
    phase = "new-run";
  }

  const displayRun = inProgress || (phase === "died-blocked" ? latest : null);
  const roundWins = num(displayRun?.round_wins);
  const roundLosses = num(displayRun?.round_losses);
  const runWins = num(displayRun?.total_wins);
  const best = runs.reduce((m, r) => Math.max(m, num(r.total_wins)), 0);

  const day = (() => {
    if (!climb) return null;
    if (climb.status === "active" && climb.start_date) {
      return differenceInCalendarDays(new Date(), new Date(climb.start_date)) + 1;
    }
    if (climb.status === "complete") {
      return num(climb.days_taken) || null;
    }
    return null;
  })();

  const showMythic = Boolean(climb && climb.status === "active");
  const survived = inProgress?.round_status === "survived";
  const canStart = allPass && !decayDue;
  const canUndo = history.length > 0;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-6">Run Tracker</h1>
      <div className="space-y-6">
        <RunStats
          seasonNumber={season.season_number}
          day={day}
          roundWins={roundWins}
          roundLosses={roundLosses}
          runWins={runWins}
          best={best}
          showMythic={showMythic}
          onMythic={completeMythic}
          mythicBusy={mythicBusy}
        />
        <BestRun runs={runs} />
        <RoundPanel
          phase={phase}
          survived={survived}
          onWin={recordWin}
          onLoss={recordLoss}
          onUndo={undo}
          onStart={startRound}
          canUndo={canUndo}
          busy={busy}
          canStart={canStart}
          failingRules={failingRules}
          rulesLoading={rulesLoading}
          decayDue={decayDue}
        />
      </div>
    </div>
  );
}