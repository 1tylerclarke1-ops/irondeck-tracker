// Resolve a list of deck entries to Scryfall cards with confidence scoring.
// Each entry: { name, set, number }. Returns an array parallel to entries of:
//   { card, confidence, candidates }
// where `candidates` are the top 3 search results ({ name, set, image }) for
// entries where no card was accepted.

import { postCollection } from "@/lib/scryfall";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Levenshtein edit distance.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Normalise a card name: lowercase, trim, remove punctuation, collapse spaces.
function normalise(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

// All candidate names for a Scryfall card: the full name plus every face name.
function cardNames(card) {
  const names = new Set();
  if (!card) return [];
  if (card.name) names.add(card.name);
  if (Array.isArray(card.card_faces)) {
    card.card_faces.forEach((f) => {
      if (f.name) names.add(f.name);
    });
  }
  return Array.from(names);
}

// Score a Scryfall card against an entry name. 100 for an exact normalised
// match, otherwise a Levenshtein similarity ratio against the best-matching
// name (full name or any face name).
function scoreCard(entryName, card) {
  const target = normalise(entryName);
  if (!target || !card) return 0;
  let best = 0;
  for (const n of cardNames(card)) {
    const cand = normalise(n);
    if (!cand) continue;
    if (cand === target) return 100;
    const maxLen = Math.max(target.length, cand.length);
    if (maxLen === 0) continue;
    const ratio = Math.round((1 - levenshtein(target, cand) / maxLen) * 100);
    if (ratio > best) best = ratio;
  }
  return best;
}

function cardImage(card) {
  if (!card) return null;
  return (
    card.image_uris?.normal ||
    card.card_faces?.[0]?.image_uris?.normal ||
    null
  );
}

function toCandidate(card) {
  return {
    name: card?.name || "",
    set: card?.set || "",
    image: cardImage(card),
  };
}

async function searchByName(name) {
  const q = `f:standard game:arena "${name}"`;
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(
    q
  )}&unique=cards`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return [];
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

async function fetchFuzzy(name) {
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(
    name
  )}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function resolveCards(entries) {
  const results = entries.map(() => ({
    card: null,
    confidence: 0,
    candidates: [],
  }));

  // 1. Resolve entries that have set + number via the batched collection API.
  const byKey = {};
  const setLookups = [];
  entries.forEach((e, i) => {
    if (!e.set || !e.number) return;
    const key = `${e.set.toLowerCase()}:${e.number}`;
    if (!byKey[key]) {
      byKey[key] = { key, set: e.set.toLowerCase(), collector_number: String(e.number), indices: [] };
      setLookups.push(byKey[key]);
    }
    byKey[key].indices.push(i);
  });

  if (setLookups.length) {
    const ids = setLookups.map((l) => ({
      set: l.set,
      collector_number: l.collector_number,
    }));
    const data = await postCollection(ids);
    data.forEach((c) => {
      const key = `${c.set}:${c.collector_number}`;
      if (byKey[key]) {
        for (const i of byKey[key].indices) {
          results[i].card = c;
          results[i].confidence = 100;
        }
      }
    });
  }

  // 2. For each unresolved entry, search by name and score the results.
  for (let i = 0; i < entries.length; i++) {
    if (results[i].card) continue;
    const entry = entries[i];
    const found = await searchByName(entry.name);
    await sleep(100);

    const scored = found
      .map((c) => ({ card: c, score: scoreCard(entry.name, c) }))
      .sort((a, b) => b.score - a.score);

    if (scored.length && scored[0].score >= 90) {
      results[i].card = scored[0].card;
      results[i].confidence = scored[0].score;
      continue;
    }

    // 3. Fall back to /cards/named?fuzzy, accepted if it scores >= 75.
    const candidates = scored.slice(0, 3).map((s) => toCandidate(s.card));
    const fuzzy = await fetchFuzzy(entry.name);
    await sleep(100);

    if (fuzzy) {
      const score = scoreCard(entry.name, fuzzy);
      if (score >= 75) {
        results[i].card = fuzzy;
        results[i].confidence = score;
        continue;
      }
    }

    results[i].candidates = candidates;
  }

  return results;
}