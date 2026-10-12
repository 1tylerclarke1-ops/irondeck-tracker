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
    });
    list.push({
      query: `${base} r:${OTHER_RARITY[rarity]} ${f.q}`,
      label: f.label,
      fallback: idx > 0,
    });
  });
  return list;
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

const searchUrl = (q, page) =>
  `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&page=${page}`;

const fetchSearch = async (q, page = 1) => {
  try {
    const res = await fetch(searchUrl(q, page));
    if (!res.ok) return { status: res.status, data: null };
    return { status: res.status, data: await res.json() };
  } catch {
    return { status: 0, data: null };
  }
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Fetch 13 cards (up to 12 decoys + replacement last) from Scryfall.
// Fast version: one search per query (plus one random page when there is more
// than one page of results), instead of one request per card. The first query
// that has usable cards is locked; the replacement and decoys come from it.
// Land decays fall back to a random season basic land. The replacement (last
// slot) must resolve or this throws.
export async function fetchRollCards({ rarity, season, deckCards, cardType }) {
  const queryList = buildQueryList(cardType, rarity, season);
  const isLand = cardType === "land";
  const usable = (data) => {
    if (!isValid(data)) return false;
    const existing = deckCards.find((c) => c.name === data.name);
    return !(existing && num(existing.copies) >= 4);
  };

  let locked = null;
  let picked = [];
  for (const item of queryList) {
    const first = await fetchSearch(item.query, 1);
    if (!first.data) {
      await delay(100);
      continue; // 404 = no matches for this query; try the next one
    }
    let list = first.data.data || [];
    const pages = Math.ceil((first.data.total_cards || list.length) / 175);
    if (pages > 1) {
      const page = 1 + Math.floor(Math.random() * pages);
      if (page !== 1) {
        await delay(100);
        const other = await fetchSearch(item.query, page);
        if (other.data?.data?.length) list = other.data.data;
      }
    }
    const seen = new Set();
    const pool = shuffle(list.filter(usable)).filter((d) => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });
    if (pool.length === 0) continue;
    locked = item;
    picked = pool.slice(0, 13).map(normalize);
    break;
  }

  if (!locked && isLand) {
    locked = { kind: "basic", label: "basic land", fallback: true };
    const seen = new Set();
    for (let i = 0; i < 8 && picked.length < 5; i++) {
      const data = await fetchNamedExact(pickBasicLand(season));
      await delay(100);
      if (!isValid(data) || seen.has(data.name)) continue;
      seen.add(data.name);
      picked.push(normalize(data));
    }
  }
  if (!locked || picked.length === 0) {
    throw new Error("Could not find a replacement card for the decay roll.");
  }

  const replacementRule = `${cardType} → ${locked.label}${
    locked.fallback ? " (fallback)" : ""
  }`;
  const [replacement, ...decoys] = picked;
  const allCards = [...decoys, replacement];
  const rollCards = allCards.map((c) => ({ name: c.name, image_url: c.imageUrl }));
  return { cards: allCards, rollCards, replacement, replacementRule };
}