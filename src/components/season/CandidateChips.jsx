import React, { useState } from "react";
import { fetchCardExact } from "@/lib/resolveCard";

// Renders up to 3 "Did you mean" candidate chips. Clicking a chip fetches the
// full Scryfall card by exact name and calls onPick(card).
export default function CandidateChips({ candidates, onPick, disabled }) {
  const [busyIdx, setBusyIdx] = useState(null);

  const handleClick = async (i, name) => {
    setBusyIdx(i);
    try {
      const card = await fetchCardExact(name);
      if (card) onPick(card);
    } finally {
      setBusyIdx(null);
    }
  };

  if (!candidates || candidates.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No matches found.</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Did you mean:</span>
      {candidates.map((c, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled || busyIdx !== null}
          onClick={() => handleClick(i, c.name)}
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          {c.image && (
            <img
              src={c.image}
              alt=""
              className="h-5 w-5 rounded object-cover"
            />
          )}
          {c.name}
        </button>
      ))}
    </div>
  );
}