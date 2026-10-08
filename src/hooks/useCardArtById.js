import { useEffect, useState } from "react";
import { fetchCardArtById } from "@/lib/scryfall";

// Fetches art_crop (plus normal + artist) for a list of Scryfall ids, one
// request per card against https://api.scryfall.com/cards/<id>. Returns a map
// keyed by scryfall_id -> { artCrop, normal, artist }. An id is undefined
// while loading and null once resolved (not found).
export default function useCardArtById(ids) {
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
      const out = {};
      for (let i = 0; i < list.length; i++) {
        const id = list[i];
        out[id] = await fetchCardArtById(id);
        if (!active) return;
        setData({ ...out });
        await new Promise((r) => setTimeout(r, 80));
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}