// Demo mode: test the whole death sequence (and its sounds) without losing.
// Add ?demo=death to BOTH the Layout and Death Screen addresses. Nothing is saved:
// no loss, no rot, no database changes. Both pages pick the same start time (the
// next 20-second mark, at least 4s away) and the same "random" cards, so they stay
// in sync even though OBS loads them separately. Refresh to play it again.
export const isDemoDeath =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "death";
const STEP = 20000;
const born = isDemoDeath ? Math.ceil((Date.now() + 4000) / STEP) * STEP : 0;
const img = (c) => (c?.scryfall_id ? `https://api.scryfall.com/cards/${c.scryfall_id}?format=image&version=normal` : "");

// Same seed on both pages -> same shuffle.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cached = null;
export function demoDeathEvent(season, cards) {
  if (!isDemoDeath || !season || Date.now() < born) return null;
  if (cached) return cached;
  const live = (cards || [])
    .filter((c) => (Number(c.copies) || 0) > 0 && (c.zone || "main") === "main")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (!live.length) return null;
  const victim =
    live.find((c) => c.name === season.condemned_card) ||
    live.find((c) => c.rarity === "rare" || c.rarity === "mythic") ||
    live[0];
  const pool = live.filter((c) => c.name !== victim.name && (c.rarity === "common" || c.rarity === "uncommon"));
  const rnd = seeded(born / 1000);
  const roll = [...(pool.length ? pool : live)].sort(() => rnd() - 0.5).slice(0, 5);
  const winner = roll[roll.length - 1];
  const at = new Date(born).toISOString();
  cached = {
    id: "demo-" + born, season_id: season.id, run_id: "demo", step: "death",
    created_date: at, updated_at: at, updated_date: at,
    chosen_card: victim.name, card_removed: victim.name, card_removed_image: img(victim),
    replacement_card: winner.name, replacement_card_image: img(winner),
    rarity_roll: winner.rarity === "uncommon" ? "uncommon" : "common",
    roll_cards: roll.map((c) => ({ name: c.name, image_url: img(c) })),
    zone: "main", sideboard_rotted: false, wheel_card_names: [], wheel_card_ids: [], wheel_card_art: [],
  };
  return cached;
}