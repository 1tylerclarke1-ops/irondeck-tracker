import { rarityFor, typeFor, manaInfoFor } from "@/components/season/arenaImport";
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

const buildQuery = (rarityVal, season, isLand) => {
  const typeFilter = isLand ? "t:land" : "-t:land";
  return `f:standard game:arena r:${rarityVal} ${typeFilter} id<=${(
    season.colours || ""
  ).toLowerCase()}`;
};

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
  ...manaInfoFor(data),
});

const pickBasicLand = (season) => {
  const colours = (season.colours || "")
    .toLowerCase()
    .split("")
    .filter((c) => COLOUR_LAND[c]);
  const pool = colours.length > 0 ? colours : ["w", "u", "b", "r", "g"];
  return COLOUR_LAND[pool[Math.floor(Math.random() * pool.length)]];
};

// Fetch 13 cards (12 decoys + replacement last) from Scryfall /cards/random,
// about 100ms apart, using the same query as the original replacement roll.
// Returns { cards (full normalized), rollCards ({name, image_url}), replacement }.
export async function fetchRollCards({ rarity, season, deckCards, isLand }) {
  const seen = new Set();
  const cards = [];
  let q = buildQuery(rarity, season, isLand);
  let switched = false;

  for (let i = 0; i < 13; i++) {
    let data = null;
    for (let attempt = 0; attempt < 4 && !data; attempt++) {
      let res = null;
      try {
        res = await fetch(randomUrl(q));
      } catch {
        res = null;
      }
      if (!res) {
        await delay(100);
        continue;
      }
      if (res.status === 404) {
        if (!switched) {
          switched = true;
          q = buildQuery(OTHER_RARITY[rarity], season, isLand);
        }
        break;
      }
      if (!res.ok) {
        await delay(100);
        continue;
      }
      data = await res.json();
      const existing = deckCards.find((c) => c.name === data.name);
      if (existing && num(existing.copies) >= 4) {
        data = null;
        continue;
      }
      if (seen.has(data.name)) {
        data = null;
        continue;
      }
    }
    if (data) {
      seen.add(data.name);
      cards.push(normalize(data));
    } else {
      const name = pickBasicLand(season);
      cards.push({
        name,
        rarity: "basic",
        card_type: "land",
        imageUrl: null,
        mana_cost: "",
        colours: "",
        mana_value: 0,
      });
    }
    await delay(100);
  }

  const replacement = cards[cards.length - 1];
  const rollCards = cards.map((c) => ({ name: c.name, image_url: c.imageUrl }));
  return { cards, rollCards, replacement };
}