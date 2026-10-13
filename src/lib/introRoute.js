// Which opening the Overlay Intro plays, worked out from the season's DayLogs.
// Agreed routes (13 Oct):
//  s1start      Season 1, Day 1:   shield → full rules → new deck → wheel
//  seasonStart  Season 2+, Day 1:  shield → season review → rules card → new deck → wheel
//  onBlock      survived, sentence not finished: recap → still on the block → deck
//  pardon       survived the last day: recap → walks free → wheel → deck
//  death        Death Run: recap (rotted → scavenged) → current deck → wheel
//  missed       missed day(s) / unfinished round: recap (rots) → current deck → wheel
// Season 1 Days 2+ add the rules card after the recap. Milestones (recognition
// only) follow the recap on onBlock / pardon / death.

const toMs = (v) => {
  if (!v) return 0;
  const s = String(v);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z") || 0;
};
const n = (v) => Number(v) || 0;
const newestFirst = (a, b) =>
  (b.date || "").localeCompare(a.date || "") || toMs(b.created_date) - toMs(a.created_date);

const DAY_MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 365];

export function planIntro({ seasonNumber, logs, season, today, rulesParam }) {
  const earlier = [...(logs || [])].sort(newestFirst); // every finished round (the Run Tracker counts rounds, not dates)
  const missed = [];
  for (const l of earlier) {
    if (l.result === "missed") missed.push(l);
    else break;
  }
  const prev = earlier.find((l) => l.result !== "missed") || null;
  const s1 = !(n(seasonNumber) > 1);

  let route;
  if (!earlier.length) route = s1 ? "s1start" : "seasonStart";
  else if (missed.length) route = "missed";
  else if (prev.result === "died") route = "death";
  else if (
    prev.result === "survived" &&
    season?.pardoned_at &&
    toMs(season.pardoned_at) >= toMs(prev.created_date) - 5 * 60 * 1000
  ) route = "pardon";
  else route = "onBlock";

  // Milestones from yesterday's round (not after missed days or at a season start).
  const milestones = [];
  if (prev && (route === "death" || route === "pardon" || route === "onBlock")) {
    const older = earlier.filter((l) => l !== prev && l.result !== "missed");
    const bestBefore = older.reduce((m, l) => Math.max(m, n(l.run_wins_after)), 0);
    const runWins = n(prev.run_wins_after);
    if (runWins >= 7 && runWins > bestBefore) milestones.push({ title: "NEW BEST RUN", sub: `${runWins} WINS` });
    if (prev.result === "survived" && n(prev.wins) >= 7 && n(prev.losses) === 0)
      milestones.push({ title: "FLAWLESS DAY", sub: "7–0" });
    if (DAY_MILESTONES.includes(n(prev.day)))
      milestones.push({ title: `DAY ${n(prev.day)}`, sub: prev.result === "survived" ? "SURVIVED" : "REACHED" });
  }

  const stages = ["recap"];
  if (route === "s1start") stages.push("rules", "deck", "wheel");
  else if (route === "seasonStart") stages.push("review", "rulesCard", "deck", "wheel");
  else {
    if (s1) stages.push("rulesCard");
    if (milestones.length) stages.push("milestone");
    if (route === "missed" || route === "death") stages.push("deck", "wheel");
    if (route === "pardon") stages.push("pardon", "wheel");
    if (route === "onBlock") stages.push("wheel");
  }
  // Testing switches: ?rules=on forces the full rules, ?rules=off drops all rules.
  if (rulesParam === "on" && !stages.includes("rules")) stages.splice(1, 0, "rules");
  const finalStages = (rulesParam === "off" ? stages.filter((s) => s !== "rules" && s !== "rulesCard") : stages).concat("end");

  return { route, stages: finalStages, milestones, missedCount: missed.length, prev };
}