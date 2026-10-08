import { postCollection } from "@/lib/scryfall";
const RARITY_ENUM = ["mythic", "rare", "uncommon", "common", "basic"];
const TYPE_PRIORITY = [
  "creature",
  "planeswalker",
  "land",
  "instant",
  "sorcery",
  "artifact",
  "enchantment",
  "battle",
];

export function parseArenaText(text) {
  const lines = text.split(/\r?\n/);
  let zone = null;
  const entries = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower === "deck") {
      zone = "main";
      continue;
    }
    if (lower === "sideboard") {
      zone = "sideboard";
      continue;
    }
    if (lower === "commandzone" || lower === "companion") {
      zone = null;
      continue;
    }
    if (!zone) continue;
    const m = line.match(/^(\d+)\s+(.+)\s+\(([A-Za-z0-9]+)\)\s*(\d+)\s*$/);
    if (m) {
      entries.push({
        copies: parseInt(m[1], 10),
        name: m[2].trim(),
        set: m[3],
        number: m[4],
        zone,
      });
      continue;
    }
    const m2 = line.match(/^(\d+)\s+(.+)$/);
    if (m2) {
      entries.push({
        copies: parseInt(m2[1], 10),
        name: m2[2].trim(),
        set: null,
        number: null,
        zone,
      });
    }
  }
  return entries;
}

function frontTypeLine(card) {
  if (card.card_faces && card.card_faces[0] && card.card_faces[0].type_line) {
    return card.card_faces[0].type_line;
  }
  return (card.type_line || "").split(" // ")[0];
}

export function rarityFor(card) {
  if (!card) return "";
  if (frontTypeLine(card).toLowerCase().includes("basic land")) return "basic";
  const r = (card.rarity || "").toLowerCase();
  return RARITY_ENUM.includes(r) ? r : "common";
}

export function typeFor(card) {
  if (!card) return "";
  const t = frontTypeLine(card).toLowerCase();
  for (const type of TYPE_PRIORITY) {
    if (t.includes(type)) return type;
  }
  return "creature";
}

export function manaInfoFor(card) {
  if (!card) return { mana_cost: "", colours: "", mana_value: null };
  const face = card.card_faces && card.card_faces[0] ? card.card_faces[0] : card;
  const mana_cost = face.mana_cost || "";
  const colors = face.colors || card.colors || [];
  const colours = colors.join("").toUpperCase();
  const mana_value =
    face.cmc != null ? face.cmc : card.cmc != null ? card.cmc : null;
  return { mana_cost, colours, mana_value };
}

// Project a Scryfall card onto the Scryfall-derived fields stored on a Card.
export function scryfallFieldsFor(card) {
  if (!card) return null;
  const mi = manaInfoFor(card);
  return {
    scryfall_id: card.id,
    set: card.set,
    collector_number: card.collector_number,
    mana_cost: mi.mana_cost,
    colours: mi.colours,
    mana_value: mi.mana_value,
    rarity: rarityFor(card),
    card_type: typeFor(card),
  };
}

export async function lookupCards(entries) {
  const lookups = [];
  const byKey = {};
  entries.forEach((e) => {
    const key = e.set
      ? `set:${e.set.toLowerCase()}:${e.number}`
      : `name:${e.name.toLowerCase()}`;
    if (!byKey[key]) {
      byKey[key] = {
        key,
        set: e.set ? e.set.toLowerCase() : null,
        collector_number: e.number ? String(e.number) : null,
        name: e.name,
        card: null,
      };
      lookups.push(byKey[key]);
    }
  });

  const setLookups = lookups.filter((l) => l.set);
  if (setLookups.length) {
    const ids = setLookups.map((l) => ({
      set: l.set,
      collector_number: l.collector_number,
    }));
    const data = await postCollection(ids);
    data.forEach((c) => {
      const key = `set:${c.set}:${c.collector_number}`;
      if (byKey[key]) byKey[key].card = c;
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nameMatches = (deckName, card) => {
    const dn = (deckName || "").toLowerCase().trim();
    const full = (card?.name || "").toLowerCase().trim();
    const front = full.split(" // ")[0];
    return dn === full || dn === front;
  };
  const fetchNamed = async (name, mode) => {
    const url = `https://api.scryfall.com/cards/named?${mode}=${encodeURIComponent(
      name
    )}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  // Cards not found by set + collector number: try exact name lookup.
  const missingExact = lookups.filter((l) => !l.card);
  for (const l of missingExact) {
    const card = await fetchNamed(l.name, "exact");
    if (card && nameMatches(l.name, card)) l.card = card;
    await sleep(100);
  }

  // Still not found: try fuzzy name lookup.
  const missingFuzzy = lookups.filter((l) => !l.card);
  for (const l of missingFuzzy) {
    const card = await fetchNamed(l.name, "fuzzy");
    if (card && nameMatches(l.name, card)) l.card = card;
    await sleep(100);
  }

  return entries.map((e) => {
    const key = e.set
      ? `set:${e.set.toLowerCase()}:${e.number}`
      : `name:${e.name.toLowerCase()}`;
    return byKey[key].card || null;
  });
}