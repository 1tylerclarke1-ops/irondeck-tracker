import React, { useEffect, useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import AppNav from "@/components/AppNav";
import NoSeason from "@/components/run/NoSeason";
import RunStats from "@/components/run/RunStats";
import RoundPanel from "@/components/run/RoundPanel";
import BestRun from "@/components/run/BestRun";
import VerifyDeck from "@/components/run/VerifyDeck";
import { useDeckRules } from "@/lib/useDeckRules";
import { num } from "@/components/run/runHelpers";
import { performDecay } from "@/lib/performDecay";
import { ensureCondemned, serveBlockDay, clearCondemned } from "@/lib/condemned";
import { ukDate, missedDates } from "@/lib/ukDay";
import { createDayLog, deleteLatestDayLogForRun } from "@/lib/dayLog";
import { loadDayLogs, readDayLogs, roundDay } from "@/lib/roundDay";
import {
  useArenaAutoResults,
  useAutoResultsSetting,
  ArenaAutoStatus,
} from "@/components/run/ArenaAutoResults";

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
  const [deathEvent, setDeathEvent] = useState(null);
  const [decayApplying, setDecayApplying] = useState(false);
  const [decayError, setDecayError] = useState(null);
  const [dayLogs, setDayLogs] = useState([]);
  const [logsOk, setLogsOk] = useState(true);

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

  const loadDeathEvent = useCallback(async (seasonId) => {
    if (!seasonId) {
      setDeathEvent(null);
      return;
    }
    const list = await base44.entities.DecayEvent.filter(
      { season_id: seasonId },
      "-updated_date",
      1
    );
    setDeathEvent(list && list.length ? list[0] : null);
  }, []);

  const reloadDayLogs = useCallback(async (seasonId) => {
    const logs = await readDayLogs(seasonId);
    if (logs) setDayLogs(logs);
    setLogsOk(Boolean(logs));
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
      if (found) {
        await Promise.all([
          loadClimb(),
          loadRuns(found.id),
          loadCards(found.id),
          loadDecays(found.id),
          loadDeathEvent(found.id),
          reloadDayLogs(found.id),
        ]);
      } else {
        setRuns([]);
        setCards([]);
        setDecays([]);
        setDeathEvent(null);
        setDayLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadSeason, loadRuns, loadCards, loadDecays, loadDeathEvent, loadClimb, reloadDayLogs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

    useEffect(() => {
      loadAll();
    }, [loadAll]);

  const sortedRuns = [...runs].sort(
    (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
  );
  const inProgress = runs.find((r) => r.result === "in_progress");
  const latest = sortedRuns[0];

  // DAY counts rounds played in this climb (see src/lib/roundDay.js)
  const day = roundDay({
    logs: dayLogs,
    climb,
    playing: inProgress?.round_status === "playing",
  });

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

  // Missed days (UK calendar days with no round, plus a round started on an
  // earlier day and never finished): each one rots a card before today's round,
  // the condemned card first, then a fresh pick per extra day. Each gets a
  // "missed" DayLog and a "missed" DecayEvent, which the next intro plays.
  const handleMissedDays = async () => {
    const lastPlayed = dayLogs.reduce((m, l) => (l.date && l.date > m ? l.date : m), "");
    const unfinished =
      inProgress?.round_status === "playing" && inProgress.round_started_at
        ? ukDate(inProgress.round_started_at)
        : "";
    const missed = missedDates({ lastPlayed, unfinished, today: ukDate() });
    let s = season;
    let fresh = cards;
    if (!missed.length) return { ok: true, season: s, cards: fresh };
    const ok = window.confirm(
      `${missed.length} missed day${missed.length > 1 ? "s" : ""} (${missed.join(", ")}).\n` +
        `Each one rots a card, starting with the condemned card. Continue?`
    );
    if (!ok) return { ok: false };
    const runForDecay = inProgress || latest;
     let dayNo = dayLogs.filter((l) => !climb?.id || l.climb_id === climb.id).length;
    for (const date of missed) {
      fresh = await base44.entities.Card.filter({ season_id: season.id });
      if (!s.condemned_card || !fresh.some((c) => c.name === s.condemned_card && num(c.copies) > 0)) {
        s = await ensureCondemned({ season: { ...s, condemned_card: "" }, cards: fresh });
      }
      const res = await performDecay({
        season: s, cards: fresh, run: runForDecay, condemned: s.condemned_card, step: "missed",
      });
      await clearCondemned(s);
      s = { ...s, condemned_card: "", block_days: 0 };
      dayNo += 1;
      await createDayLog({
        season, run: runForDecay, climb, day: dayNo,
        roundWins: 0, roundLosses: 0, result: "missed",
        runWinsAfter: num(runForDecay?.total_wins),
        decayIds: res?.decayId ? [res.decayId] : [],
        date,
      });
    }
    fresh = await base44.entities.Card.filter({ season_id: season.id });
    await Promise.all([loadCards(season.id), loadDecays(season.id), reloadDayLogs(season.id)]);
    return { ok: true, season: s, cards: fresh };
  };

  const startRound = async () => {
    setBusy(true);
    try {
      const m = await handleMissedDays();
      if (!m.ok) return;
      await ensureCondemned({ season: m.season, cards: m.cards });
      if (inProgress) {
        const prev = snapshot(inProgress);
         await base44.entities.Run.update(inProgress.id, {
          round_wins: 0,
          round_losses: 0,
          round_status: "playing",
          round_started_at: new Date().toISOString(),
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
          round_started_at: new Date().toISOString(),
          result: "in_progress",
        });
        setHistory([]);
      }
      await Promise.all([loadRuns(season.id), loadSeason()]);
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
      if (newRoundWins >= 7) {
        await createDayLog({
          season,
          run: inProgress,
          climb,
          day,
          roundWins: newRoundWins,
          roundLosses: num(inProgress.round_losses),
          result: "survived",
          runWinsAfter: newRunWins,
          decayIds: [],
        });
        await reloadDayLogs(season.id);
        await serveBlockDay(season);
        await loadSeason();
      }
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
      const died = newRoundLosses >= 2;
      if (died) {
        update.round_status = "died";
        update.result = "died";
      }
      await base44.entities.Run.update(inProgress.id, update);
      setHistory((h) => [...h, prev]);
      await loadRuns(season.id);
      if (died) {
        setDecayError(null);
        setDecayApplying(true);
        let decayId = null;
        try {
          const decayResult = await performDecay({ season, cards, run: inProgress, condemned: season.condemned_card });
          decayId = decayResult?.decayId || null;
          await clearCondemned(season);
          loadSeason();
          await Promise.all([
            loadCards(season.id),
            loadDecays(season.id),
            loadDeathEvent(season.id),
          ]);
        } catch (e) {
          setDecayError(e?.message || "Decay failed");
        } finally {
          setDecayApplying(false);
        }
        await createDayLog({
          season,
          run: inProgress,
          climb,
          day,
          roundWins: num(inProgress.round_wins),
          roundLosses: newRoundLosses,
          result: "died",
          runWinsAfter: num(inProgress.total_wins),
          decayIds: decayId ? [decayId] : [],
        });
        await reloadDayLogs(season.id);
      }
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
      const wasEnded =
        target.round_status === "survived" || target.round_status === "died";
      const willBePlaying = prev.round_status === "playing";
      await base44.entities.Run.update(target.id, prev);
      if (wasEnded && willBePlaying) {
        await deleteLatestDayLogForRun(target.id);
        await reloadDayLogs(season.id);
      }
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
      const days = (day || 1) + (Number(dayLogs.priorDays) || 0); // challenge days, not just this season
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

  const [autoOn, setAutoOn] = useAutoResultsSetting();
  const autoLast = useArenaAutoResults({
    enabled: autoOn && !loading && Boolean(season),
    run: inProgress,
    busy,
    onWin: recordWin,
    onLoss: recordLoss,
  });

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


  const showMythic = Boolean(climb && climb.status === "active");
  const survived = inProgress?.round_status === "survived";
  const deathUnverified = deathEvent?.step === "death";
  const canStart = allPass && !decayDue && !deathUnverified && logsOk;
  const canUndo = history.length > 0;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <AppNav />
      <h1 className="text-2xl font-bold mb-6">Run Tracker</h1>
      <div className="space-y-6">
        {!logsOk && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              Couldn't read the day history, so the day number may be wrong. Start Round is paused until it loads. Refresh this page to try again.
          </div>
        )}
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
        <VerifyDeck
          deathEvent={deathEvent}
          cards={cards}
          onVerified={() => loadDeathEvent(season.id)}
        />
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
        <ArenaAutoStatus on={autoOn} setOn={setAutoOn} last={autoLast} />
        {decayApplying && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            Applying decay…
          </div>
        )}
        {decayError && !decayApplying && (
          <div className="text-sm text-destructive">
            Decays failed: {decayError}
          </div>
        )}
      </div>
    </div>
  );
}