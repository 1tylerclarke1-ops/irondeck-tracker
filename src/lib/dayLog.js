import { base44 } from "@/api/base44Client";
import { ukDate } from "@/lib/ukDay";

// Create a DayLog record for a finished round (survived or died) or a missed day.
// date: the UK calendar day (defaults to today).
export async function createDayLog({
  season,
  run,
  climb,
  day,
  roundWins,
  roundLosses,
  result,
  runWinsAfter,
  decayIds,
  date,
}) {
  return base44.entities.DayLog.create({
    season_id: season?.id || "",
    run_id: run?.id || "",
    climb_id: climb?.id || null,
    day: day ?? null,
    date: date || ukDate(),
    wins: roundWins,
    losses: roundLosses,
    result,
    run_wins_after: runWinsAfter,
    decay_ids: decayIds || [],
  });
}

// Delete the most recent DayLog for a run (used when Undo reverses an ending).
export async function deleteLatestDayLogForRun(runId) {
  const logs = await base44.entities.DayLog.filter({ run_id: runId });
  if (!logs.length) return;
  const latest = [...logs].sort(
    (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
  )[0];
  await base44.entities.DayLog.delete(latest.id);
}