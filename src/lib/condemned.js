import { base44 } from "@/api/base44Client";
import { num } from "@/components/run/runHelpers";

// The Condemned card: picked at the start of the day, rots if the run dies,
// pardoned after surviving its sentence (3 days, then 2 on recapture, then 1).

const SENTENCES = [3, 2, 1];

const readPardons = (season) => {
  try { return JSON.parse(season?.pardon_counts || "{}") || {}; } catch { return {}; }
};

// Unique rare/mythic names still in the deck (main or sideboard).
export function eligibleNames(cards) {
  const names = new Set();
  for (const c of cards || []) {
    if (num(c.copies) > 0 && (c.rarity === "mythic" || c.rarity === "rare")) names.add(c.name);
  }
  return [...names];
}

// Current block state for overlays: null when nothing is condemned.
export function blockState(season) {
  if (!season?.condemned_card) return null;
  const sentence = num(season.block_sentence) || 3;
  const served = num(season.block_days);
  return {
    name: season.condemned_card,
    day: Math.min(served + 1, sentence), // "DAY x/3"
    sentence,
    capture: num(season.block_capture) || 1,
    recapture: (num(season.block_capture) || 1) > 1,
  };
}

// Start of day: keep the current condemned card if it's still in the deck,
// otherwise spin for a new one. Returns the (possibly updated) season.
export async function ensureCondemned({ season, cards }) {
  const names = eligibleNames(cards);
  if (season.condemned_card && names.includes(season.condemned_card)) return season;
  if (names.length === 0) return season;
  const name = names[Math.floor(Math.random() * names.length)];
  const pardons = readPardons(season);
  const capture = num(pardons[name]) + 1;
  const update = {
    condemned_card: name,
    condemned_since: new Date().toISOString(),
    block_days: 0,
    block_sentence: SENTENCES[Math.min(capture, SENTENCES.length) - 1],
    block_capture: capture,
  };
  await base44.entities.Season.update(season.id, update);
  return { ...season, ...update };
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
  });
  return { pardoned: true, name: season.condemned_card };
}

// After the condemned card rots: clear the block so tomorrow spins fresh.
export async function clearCondemned(season) {
  await base44.entities.Season.update(season.id, { condemned_card: "", block_days: 0 });
}