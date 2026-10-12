import { useEffect, useState } from "react";

// Finds a plain, standard printing of each card by NAME (English, regular black
// border, 2015 frame; no full-art / borderless / showcase / extended-art /
// promo / joke-set printings), so deck rows show a clean, readable name plate
// whatever printing was imported. Cards are looked up in batches and remembered.

const CLEAN =
  "lang:en frame:2015 border:black -is:fullart -is:showcase -is:extendedart -is:etched -is:promo -is:funny prefer:newest";
const BATCH = 15;
const STORE_KEY = "irondeck-plates-v1";

const keyOf = (name) => (name || "").toLowerCase().split(/\s+\/\/\/?\s+/)[0].trim();

const cache = new Map(); // key -> { url, pw } (pw = planeswalker frame)
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  Object.entries(saved).forEach(([k, v]) => cache.set(k, v));
} catch {
  // no saved plates
}
const save = () => {
  try {
    const out = {};
    cache.forEach((v, k) => {
      if (v && v.url) out[k] = v;
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(out));
  } catch {
    // ignore
  }
};

const listeners = new Set();
const queue = new Set();
let timer = null;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const imageOf = (c) =>
  c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || null;
const typeOf = (c) => c?.type_line || c?.card_faces?.[0]?.type_line || "";

async function lookup(names) {
  const q = `(${names.map((n) => `!"${n.replace(/"/g, "")}"`).join(" or ")}) ${CLEAN}`;
  const found = new Map();
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards`;
  for (let page = 0; url && page < 3; page++) {
    let json = null;
    try {
      const res = await fetch(url);
      if (!res.ok) break; // 404 = none matched
      json = await res.json();
    } catch {
      break;
    }
    for (const c of json.data || []) {
      const entry = { url: imageOf(c), pw: /planeswalker/i.test(typeOf(c)) };
      found.set(keyOf(c.name), entry);
      if (c.card_faces?.[0]?.name) found.set(keyOf(c.card_faces[0].name), entry);
    }
    url = json.has_more ? json.next_page : null;
    if (url) await delay(100);
  }
  return found;
}

async function flush() {
  timer = null;
  const names = [...queue];
  queue.clear();
  for (let i = 0; i < names.length; i += BATCH) {
    const chunk = names.slice(i, i + BATCH);
    const found = await lookup(chunk);
    chunk.forEach((n) => cache.set(keyOf(n), found.get(keyOf(n)) || { url: null }));
    save();
    listeners.forEach((fn) => fn());
    await delay(100);
  }
}

function request(name) {
  queue.add(name.split(/\s+\/\/\/?\s+/)[0].trim());
  if (!timer) timer = setTimeout(flush, 60);
}

// { url, pw } once looked up; url is null if no clean printing was found.
export function usePlateImage(name) {
  const k = keyOf(name);
  const [plate, setPlate] = useState(() => (k ? cache.get(k) : undefined));
  useEffect(() => {
    if (!k) return undefined;
    if (cache.has(k)) {
      setPlate(cache.get(k));
      return undefined;
    }
    const fn = () => cache.has(k) && setPlate(cache.get(k));
    listeners.add(fn);
    request(name);
    return () => listeners.delete(fn);
  }, [k]);
  return plate;
}