import { rarityFor, typeFor, manaInfoFor } from "@/components/season/arenaImport";
import { cardHasOutsideTheGame } from "@/lib/scryfall";
import { num } from "@/components/run/runHelpers";

const OTHER_RARITY = { uncommon: "common", common: "uncommon" };
const COLOUR_LAND = {
  w: "Plains",
  u: "Island",
  b: "Swamp",
  r: "Mountain",
  g: "Forest",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const colourClause = (season) => `id<=${(season.colours || "").toLowerCase()}`;
const randomUrl = (q) =>
  `https://api.scryfall.com/cards/random?q=${encodeURIComponent(q)}`;

const normalize = (data) => ({
  name: data.name,
  rarity: rarityFor(data),
  card_type: typeFor(data),
  imageUrl:
    data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal || null,
  scryfall_id: data.id,
  set: data.set,
  collector_number: data.collector_number,
  outside_the_game: cardHasOutsideTheGame(data),
  ...manaInfoFor(data),
});

// A card is only usable when it has a name, a Scryfall id, and a normal image.
const isValid = (data) =>
  !!(
    data &&
    data.name &&
    data.id &&
    (data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal)
  );

const pickBasicLand = (season) => {
  const colours = (season.colours || "")
    .toLowerCase()
    .split("")
    .filter((c) => COLOUR_LAND[c]);
  const pool = colours.length > 0 ? colours : ["w", "u", "b", "r", "g"];
  return COLOUR_LAND[pool[Math.floor(Math.random() * pool.length)]];
};

// Ordered type filters per decayed card type. Each entry is tried with the
// rolled rarity first, then the other rarity; we advance only on a 404.
const TYPE_FILTERS = {
  creature: [{ q: "t:creature", label: "creature" }],
  planeswalker: [
    { q: "t:planeswalker", label: "planeswalker" },
    { q: "t:creature", label: "creature" },
  ],
  battle: [
    { q: "t:battle", label: "battle" },
    { q: "t:creature", label: "creature" },
  ],
  instant: [
    { q: "t:instant", label: "instant" },
    { q: "t:sorcery", label: "sorcery" },
    { q: "-t:land", label: "nonland" },
  ],
  sorcery: [
    { q: "t:sorcery", label: "sorcery" },
    { q: "t:instant", label: "instant" },
    { q: "-t:land", label: "nonland" },
  ],
  artifact: [
    { q: "t:artifact -t:creature -t:land", label: "artifact" },
    { q: "t:enchantment -t:creature", label: "enchantment" },
    { q: "-t:land", label: "nonland" },
  ],
  enchantment: [
    { q: "t:enchantment -t:creature -t:land", label: "enchantment" },
    { q: "t:artifact -t:creature", label: "artifact" },
    { q: "-t:land", label: "nonland" },
  ],
  land: [{ q: "t:land -t:basic", label: "land" }],
};

// Flat ordered query list: each type filter × (rolled rarity, other rarity).
const buildQueryList = (cardType, rarity, season) => {
  const base = `f:standard game:arena ${colourClause(season)}`;
  const filters = TYPE_FILTERS[cardType] || TYPE_FILTERS.creature;
  const list = [];
  filters.forEach((f, idx) => {
    list.push({
      query: `${base} r:${rarity} ${f.q}`,
      label: f.label,
      fallback: idx > 0,
      kind: "random",
    });
    list.push({
      query: `${base} r:${OTHER_RARITY[rarity]} ${f.q}`,
      label: f.label,
      fallback: idx > 0,
      kind: "random",
    });
  });
  return list;
};

const fetchRandom = async (q) => {
  try {
    const res = await fetch(randomUrl(q));
    if (!res.ok) return { status: res.status, data: null };
    return { status: res.status, data: await res.json() };
  } catch {
    return { status: 0, data: null };
  }
};

const fetchNamedExact = async (name) => {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

// Fetch 13 cards (up to 12 decoys + replacement last) from Scryfall. The
// replacement and decoys share one locked query (the first that returns
// matches). Land decays fall back to a random season basic land. The
// replacement (last slot) must resolve or this throws.
export async function fetchRollCards({ rarity, season, deckCards, cardType }) {
  const seen = new Set();
  const decoys = [];
  const queryList = buildQueryList(cardType, rarity, season);
  const isLand = cardType === "land";

  // 1. Lock the first query that returns matches (non-404). Land falls back to basics.
  let locked = null;
  for (const item of queryList) {
    const { status } = await fetchRandom(item.query);
    await delay(100);
    if (status === 404) continue;
    locked = item;
    break;
  }
  if (!locked && isLand) {
    locked = { kind: "basic", label: "basic land", fallback: true };
  }
  if (!locked) {
    throw new Error("Could not find a replacement card for the decay roll.");
  }

  const replacementRule = `${cardType} → ${locked.label}${
    locked.fallback ? " (fallback)" : ""
  }`;

  // 2. Fetch one distinct, valid card from the locked query (or basic fallback).
  const fetchOne = async () => {
    if (locked.kind === "basic") {
      const name = pickBasicLand(season);
      const data = await fetchNamedExact(name);
      await delay(100);
      if (!isValid(data) || seen.has(data.name)) return null;
      return normalize(data);
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      const { status, data } = await fetchRandom(locked.query);
      await delay(100);
      if (status === 404) return null;
      if (!data || !isValid(data)) continue;
      if (seen.has(data.name)) continue;
      const existing = deckCards.find((c) => c.name === data.name);
      if (existing && num(existing.copies) >= 4) continue;
      return normalize(data);
    }
    return null;
  };

  // 3. Replacement first (must resolve or throw).
  const replacement = await fetchOne();
  if (!replacement) {
    throw new Error("Could not find a replacement card for the decay roll.");
  }
  seen.add(replacement.name);

  // 4. Fill up to 12 decoys (skip when unavailable).
  while (decoys.length < 12) {
    const card = await fetchOne();
    if (!card) break;
    seen.add(card.name);
    decoys.push(card);
  }

  const allCards = [...decoys, replacement];
  const rollCards = allCards.map((c) => ({ name: c.name, image_url: c.imageUrl }));
  return { cards: allCards, rollCards, replacement, replacementRule };
}