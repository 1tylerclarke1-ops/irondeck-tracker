import { base44 } from "@/api/base44Client";
import { ukDate } from "@/lib/ukDay";

// DAY counts ROUNDS played in the current climb, not calendar days.
// - while a round is being played: rounds finished + 1
// - after a round ends today: that round's day (still shown after the result)
// - on a later day, before the round starts: rounds finished + 1
// - a completed climb shows how many days it took

// Days already played in this climb in EARLIER seasons (the day count carries on
// across seasons until Mythic). 0 if there's no active climb or it can't be read.
async function priorDays(seasonId) {
  try {
    const climbs = await base44.entities.Climb.filter({ status: "active" });
    const climb = climbs && climbs[0];
    if (!climb) return 0;
    const all = await base44.entities.DayLog.filter({ climb_id: climb.id });
    return (all || []).filter((l) => l.season_id !== seasonId).length;
  } catch {
    return 0;
  }
}

// Reads the season's DayLogs, trying up to 3 times. Returns null if they still
// can't be read, so the caller can keep what it had (not "no days played").
// The list also carries .priorDays (days from earlier seasons of this climb).
export async function readDayLogs(seasonId) {
  if (!seasonId || !base44.entities.DayLog) return [];
  for (let i = 0; i < 3; i++) {
    try {
      const logs = await base44.entities.DayLog.filter({ season_id: seasonId });
      logs.priorDays = await priorDays(seasonId);
      return logs;
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
  const finished = mine.length + (Number(logs?.priorDays) || 0); // + earlier seasons of this climb
  if (playing) return finished + 1;
  if (mine.length === 0) return finished + 1; // nothing played yet this season
  const latestDate = mine.reduce((m, l) => (l.date && l.date > m ? l.date : m), "");
  return latestDate === todayUtc() ? finished : finished + 1;
}