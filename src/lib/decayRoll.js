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

// Ordered fallback queries for a slot.
const buildQueries = (rarity, season, isLand) => {
  const base = `f:standard game:arena ${colourClause(season)}`;
  const typeFilter = isLand ? "t:land" : "-t:land";
  if (isLand) {
    return [
      `${base} r:${rarity} ${typeFilter}`,
      `${base} r:${OTHER_RARITY[rarity]} ${typeFilter}`,
    ];
  }
  return [
    `${base} r:${rarity} ${typeFilter}`,
    `${base} r:${OTHER_RARITY[rarity]} ${typeFilter}`,
    `${base} (r:uncommon or r:common) ${typeFilter}`,
  ];
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

// Fetch 13 cards (12 decoys + replacement last) from Scryfall /cards/random.
// Nonland slots retry with the other rarity, then uncommon-or-common with no
// rarity filter. Land slots fall back to a basic land (with id + image). The
// replacement (last slot) must resolve or this throws.
export async function fetchRollCards({ rarity, season, deckCards, isLand }) {
  const seen = new Set();
  const cards = [];
  const queries = buildQueries(rarity, season, isLand);

  for (let i = 0; i < 13; i++) {
    let card = null;
    let queryIdx = 0;

    // Up to 5 attempts: 1 initial + 4 retries. Advance the query on a 404.
    for (let attempt = 0; attempt < 5 && !card; attempt++) {
      const q = queries[Math.min(queryIdx, queries.length - 1)];
      const { status, data } = await fetchRandom(q);
      await delay(100);
      if (status === 404) {
        queryIdx++;
        continue;
      }
      if (!data || !isValid(data)) continue;
      const existing = deckCards.find((c) => c.name === data.name);
      if (existing && num(existing.copies) >= 4) continue;
      if (seen.has(data.name)) continue;
      card = normalize(data);
    }

    // Basic land fallback only for land decays; fetch its id + image.
    if (!card && isLand) {
      const name = pickBasicLand(season);
      const data = await fetchNamedExact(name);
      await delay(100);
      if (isValid(data)) card = normalize(data);
    }

    if (!card) {
      if (i === 12) {
        throw new Error("Could not find a replacement card for the decay roll.");
      }
      // Skip an unfilled decoy rather than return an invalid card.
      continue;
    }

    seen.add(card.name);
    cards.push(card);
  }

  const replacement = cards[cards.length - 1];
  const rollCards = cards.map((c) => ({ name: c.name, image_url: c.imageUrl }));
  return { cards, rollCards, replacement };
}