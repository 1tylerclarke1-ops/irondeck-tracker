import { base44 } from "@/api/base44Client";
import { num } from "@/components/run/runHelpers";

// The Condemned card: picked at the start of the day, rots if the run dies or
// the day is missed, pardoned after surviving its sentence.
//
// Sentences (the executioner remembers every card pardoned this season):
//   1st capture: 3 days
//   2nd capture: 2 days  "THE EXECUTIONER REMEMBERS"
//   3rd capture: 1 day   "THE EXECUTIONER'S VENDETTA"
//   4th and later: 1 day "THE VENDETTA CONTINUES"
// The pardon list lives on the Season, so it resets with each new season.
//
// Pool: rares and mythics. If none are left, uncommons ("THE EXECUTIONER
// LOWERS HIS SIGHTS"); if none of those, commons.

const SENTENCES = [3, 2, 1];
export const sentenceFor = (capture) => SENTENCES[Math.min(Math.max(capture, 1), SENTENCES.length) - 1];

export function captureTitle(capture) {
  if (capture >= 4) return "THE VENDETTA CONTINUES";
  if (capture === 3) return "THE EXECUTIONER'S VENDETTA";
  if (capture === 2) return "THE EXECUTIONER REMEMBERS";
  return "";
}

const readPardons = (season) => {
  try { return JSON.parse(season?.pardon_counts || "{}") || {}; } catch { return {}; }
};

const POOLS = [
  { pool: "rare", match: (r) => r === "rare" || r === "mythic" },
  { pool: "uncommon", match: (r) => r === "uncommon" },
  { pool: "common", match: (r) => r === "common" },
];

// The wheel's pool: unique names still in the deck (main or sideboard) of the
// highest rarity group that has any. { pool: "rare" | "uncommon" | "common", names }
export function poolFor(cards) {
  for (const p of POOLS) {
    const names = new Set();
    for (const c of cards || []) {
      if (num(c.copies) > 0 && p.match(c.rarity)) names.add(c.name);
    }
    if (names.size) return { pool: p.pool, names: [...names] };
  }
  return { pool: "rare", names: [] };
}

// Kept for older callers: the names the wheel can pick from.
export function eligibleNames(cards) {
  return poolFor(cards).names;
}

// Current block state for overlays: null when nothing is condemned.
export function blockState(season) {
  if (!season?.condemned_card) return null;
  const sentence = num(season.block_sentence) || 3;
  const served = num(season.block_days);
  const capture = num(season.block_capture) || 1;
  return {
    name: season.condemned_card,
    day: Math.min(served + 1, sentence), // "DAY x/3"
    sentence,
    capture,
    recapture: capture > 1,
    title: captureTitle(capture),
    pool: season.block_pool || "rare",
  };
}

// Pick a condemned card now (the wheel's result) and save it.
export async function condemnNew({ season, cards }) {
  const { pool, names } = poolFor(cards);
  if (names.length === 0) return season;
  const name = names[Math.floor(Math.random() * names.length)];
  const capture = num(readPardons(season)[name]) + 1;
  const update = {
    condemned_card: name,
    condemned_since: new Date().toISOString(),
    block_days: 0,
    block_sentence: sentenceFor(capture),
    block_capture: capture,
    block_pool: pool,
  };
  await base44.entities.Season.update(season.id, update);
  return { ...season, ...update };
}

// Start of day: keep the current condemned card if it's still in the deck,
// otherwise pick a new one. Returns the (possibly updated) season.
export async function ensureCondemned({ season, cards }) {
  const { names } = poolFor(cards);
  const still = (cards || []).some((c) => c.name === season.condemned_card && num(c.copies) > 0);
  if (season.condemned_card && still) return season;
  if (names.length === 0) return season;
  return condemnNew({ season, cards });
}

// Day survived: serve one day; pardon when the sentence is done.
export async function serveBlockDay(season) {
  if (!season?.condemned_card) return { pardoned: false };
  const served = num(season.block_days) + 1;
  const sentence = num(season.block_sentence) || 3;
  if (served < sentence) {
    await base44.entities.Season.update(season.id, { block_days: served });
    return { pardoned: false };
  }
  const pardons = readPardons(season);
  pardons[season.condemned_card] = num(pardons[season.condemned_card]) + 1;
  await base44.entities.Season.update(season.id, {
    condemned_card: "",
    block_days: 0,
    pardon_counts: JSON.stringify(pardons),
    last_pardoned: season.condemned_card,
    pardoned_at: new Date().toISOString(),
  });
  return { pardoned: true, name: season.condemned_card };
}

// After the condemned card rots: clear the block so the wheel spins fresh.
export async function clearCondemned(season) {
  await base44.entities.Season.update(season.id, { condemned_card: "", block_days: 0 });
}