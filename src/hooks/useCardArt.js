import { useEffect, useState } from "react";

const fetchOne = async (name) => {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

// Fetches Scryfall art (art_crop + normal + artist) for a list of card names.
export default function useCardArt(names) {
  const [art, setArt] = useState({});
  const key = (names || []).join("|");

  useEffect(() => {
    let active = true;
    const list = (names || []).slice();
    if (list.length === 0) {
      setArt({});
      return;
    }
    (async () => {
      const out = {};
      const batch = 8;
      for (let i = 0; i < list.length; i += batch) {
        const slice = list.slice(i, i + batch);
        const results = await Promise.all(slice.map(fetchOne));
        results.forEach((data, idx) => {
          if (!data) return;
          const artCrop =
            data.image_uris?.art_crop ||
            data.card_faces?.[0]?.image_uris?.art_crop ||
            null;
          const normal =
            data.image_uris?.normal ||
            data.card_faces?.[0]?.image_uris?.normal ||
            null;
          out[slice[idx]] = { artCrop, normal, artist: data.artist };
        });
        if (!active) return;
        setArt({ ...out });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return art;
}