import { base44 } from "@/api/base44Client";
import { ukDate } from "@/lib/ukDay";

// DAY counts ROUNDS played in the current climb, not calendar days.
// - while a round is being played: rounds finished + 1
// - after a round ends today: that round's day (still shown after the result)
// - on a later day, before the round starts: rounds finished + 1
// - a completed climb shows how many days it took

// Reads the season's DayLogs, trying up to 3 times. Returns null if they still
// can't be read, so the caller can keep what it had (not "no days played").
export async function readDayLogs(seasonId) {
  if (!seasonId || !base44.entities.DayLog) return [];
  for (let i = 0; i < 3; i++) {
    try {
      return await base44.entities.DayLog.filter({ season_id: seasonId });
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  return null;
}

export async function loadDayLogs(seasonId) {
  return (await readDayLogs(seasonId)) || [];
}

const todayUtc = () => ukDate(); // UK calendar day (name kept for older code)

export function roundDay({ logs, climb, playing }) {
  if (climb?.status === "complete" && climb.days_taken) return climb.days_taken;
  const mine = (logs || []).filter((l) => !climb?.id || l.climb_id === climb.id);
  const finished = mine.length;
  if (playing) return finished + 1;
  if (finished === 0) return 1;
  const latestDate = mine.reduce((m, l) => (l.date && l.date > m ? l.date : m), "");
  return latestDate === todayUtc() ? finished : finished + 1;
}