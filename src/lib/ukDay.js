// IronDeck days are UK calendar days (Europe/London), not UTC.
// One round per UK date; a session just after midnight belongs to the new day.

const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "YYYY-MM-DD" for a Date, timestamp or ISO string (defaults to now).
export function ukDate(when = new Date()) {
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return "";
  return FMT.format(d); // en-CA formats as YYYY-MM-DD
}

const dayNumber = (ymd) => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400000); // whole days since 1970

// Whole days from date a to date b ("2026-10-10" → "2026-10-13" = 3).
export function daysBetween(a, b) {
  if (!a || !b) return 0;
  return dayNumber(b) - dayNumber(a);
}

// The UK date n days after ymd.
export function addDays(ymd, n) {
  return new Date((dayNumber(ymd) + n) * 86400000).toISOString().slice(0, 10);
}

// Missed days between the last day played and today.
// - lastPlayed: UK date of the most recent finished round (or missed day), or "".
// - unfinished: UK date of a round that was started but never finished, or "".
// Returns the list of UK dates that count as missed, oldest first.
// An unfinished round counts as missed on the day it was started.
export function missedDates({ lastPlayed, unfinished, today = ukDate() }) {
  const out = [];
  if (unfinished && unfinished < today) out.push(unfinished);
  const from = [lastPlayed, unfinished].filter(Boolean).sort().pop() || "";
  if (!from) return out; // nothing played yet this season: no missed days
  for (let d = addDays(from, 1); d < today; d = addDays(d, 1)) out.push(d);
  return out;
}