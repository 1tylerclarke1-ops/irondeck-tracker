export const zoneOf = (c) => c.zone || "main";

const BASIC_LAND_NAMES = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "snow-covered plains",
  "snow-covered island",
  "snow-covered swamp",
  "snow-covered mountain",
  "snow-covered forest",
]);

const isBasic = (c) =>
  c.rarity === "basic" || BASIC_LAND_NAMES.has((c.name || "").toLowerCase());

export function mainCount(cards) {
  return cards
    .filter((c) => zoneOf(c) === "main")
    .reduce((s, c) => s + (c.copies || 0), 0);
}

export function sideCount(cards) {
  return cards
    .filter((c) => zoneOf(c) === "sideboard")
    .reduce((s, c) => s + (c.copies || 0), 0);
}

export function mainRulePass(cards) {
  return mainCount(cards) === 60;
}

export function sideRulePass(cards) {
  const s = sideCount(cards);
  return s >= 0 && s <= 5;
}

export function copiesRulePass(cards) {
  const map = {};
  for (const c of cards) {
    if (isBasic(c)) continue;
    const key = (c.name || "").toLowerCase();
    map[key] = (map[key] || 0) + (c.copies || 0);
  }
  return Object.values(map).every((v) => v <= 4);
}

export function sideboardAllowedPass(cards) {
  if (sideCount(cards) === 0) return true;
  return cards.some(
    (c) =>
      zoneOf(c) === "main" &&
      (c.copies || 0) > 0 &&
      c.outside_the_game === true
  );
}