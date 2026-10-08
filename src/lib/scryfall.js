const COLLECTION_URL = "https://api.scryfall.com/cards/collection";

export async function postCollection(identifiers) {
  const out = [];
  for (let i = 0; i < identifiers.length; i += 75) {
    const chunk = identifiers.slice(i, i + 75);
    if (chunk.length === 0) continue;
    const res = await fetch(COLLECTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk }),
    });
    if (!res.ok) throw new Error("Scryfall request failed");
    const json = await res.json();
    (json.data || []).forEach((c) => out.push(c));
  }
  return out;
}

export async function fetchCardArtById(id) {
  if (!id) return null;
  try {
    const res = await fetch(`https://api.scryfall.com/cards/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      artCrop:
        data.image_uris?.art_crop ||
        data.card_faces?.[0]?.image_uris?.art_crop ||
        null,
      normal:
        data.image_uris?.normal ||
        data.card_faces?.[0]?.image_uris?.normal ||
        null,
      artist: data.artist || null,
    };
  } catch {
    return null;
  }
}

export function cardHasOutsideTheGame(card) {
  if (card.oracle_text && /outside the game/i.test(card.oracle_text)) return true;
  if (card.card_faces) {
    return card.card_faces.some(
      (f) => f.oracle_text && /outside the game/i.test(f.oracle_text)
    );
  }
  return false;
}