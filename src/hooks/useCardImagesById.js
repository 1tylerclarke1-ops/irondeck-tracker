import { useEffect, useState } from "react";
import { postCollection } from "@/lib/scryfall";

// Fetches card image data from Scryfall by scryfall id (POST /cards/collection
// with { id } identifiers). Returns a map: scryfall_id -> { normal, artCrop, artist, name }.
// Before the fetch completes an id is undefined; after, it is null (not found) or
// the data object, so callers can distinguish loading from missing.
export default function useCardImagesById(ids) {
  const [data, setData] = useState({});
  const key = (ids || []).join("|");

  useEffect(() => {
    let active = true;
    const list = (ids || []).filter(Boolean);
    if (list.length === 0) {
      setData({});
      return;
    }
    (async () => {
      try {
        const res = await postCollection(list.map((id) => ({ id })));
        if (!active) return;
        const map = {};
        for (const id of list) map[id] = null;
        for (const c of res) {
          map[c.id] = {
            normal:
              c.image_uris?.normal ||
              c.card_faces?.[0]?.image_uris?.normal ||
              null,
            artCrop:
              c.image_uris?.art_crop ||
              c.card_faces?.[0]?.image_uris?.art_crop ||
              null,
            artist: c.artist,
            name: c.name,
          };
        }
        setData(map);
      } catch {
        if (!active) return;
        const map = {};
        for (const id of list) map[id] = null;
        setData(map);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}