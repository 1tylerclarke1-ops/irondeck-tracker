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
  let inDeck = false;
  const entries = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower === "deck") {
      inDeck = true;
      continue;
    }
    if (lower === "sideboard" || lower === "commandzone" || lower === "companion") {
      inDeck = false;
      continue;
    }
    if (!inDeck) continue;
    const m = line.match(/^(\d+)\s+(.+)\s+\(([A-Za-z0-9]+)\)\s*(\d+)\s*$/);
    if (m) {
      entries.push({
        copies: parseInt(m[1], 10),
        name: m[2].trim(),
        set: m[3],
        number: m[4],
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

  const nameLookups = lookups.filter((l) => !l.card);
  if (nameLookups.length) {
    const uniqueNames = Array.from(new Set(nameLookups.map((l) => l.name)));
    const ids = uniqueNames.map((name) => ({ name }));
    const data = await postCollection(ids);
    const byName = {};
    data.forEach((c) => {
      byName[c.name.toLowerCase()] = c;
    });
    nameLookups.forEach((l) => {
      const c = byName[l.name.toLowerCase()];
      if (c) l.card = c;
    });
  }

  return entries.map((e) => {
    const key = e.set
      ? `set:${e.set.toLowerCase()}:${e.number}`
      : `name:${e.name.toLowerCase()}`;
    return byKey[key].card || null;
  });
}