import { base44 } from "@/api/base44Client";

// DAY counts ROUNDS played in the current climb, not calendar days.
// - while a round is being played: rounds finished + 1
// - after a round ends today: that round's day (still shown after the result)
// - on a later day, before the round starts: rounds finished + 1
// - a completed climb shows how many days it took

export async function loadDayLogs(seasonId) {
  if (!seasonId || !base44.entities.DayLog) return [];
  try {
    return await base44.entities.DayLog.filter({ season_id: seasonId });
  } catch {
    return [];
  }
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

export function roundDay({ logs, climb, playing }) {
  if (climb?.status === "complete" && climb.days_taken) return climb.days_taken;
  const mine = (logs || []).filter((l) => !climb?.id || l.climb_id === climb.id);
  const finished = mine.length;
  if (playing) return finished + 1;
  if (finished === 0) return 1;
  const latestDate = mine.reduce((m, l) => (l.date && l.date > m ? l.date : m), "");
  return latestDate === todayUtc() ? finished : finished + 1;
}