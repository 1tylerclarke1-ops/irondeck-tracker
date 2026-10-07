import { useEffect, useState } from "react";
import {
  mainRulePass,
  sideRulePass,
  copiesRulePass,
  sideboardAllowedPass,
  mainCount,
  sideCount,
} from "@/lib/deckRules";

export function useDeckRules(cards) {
  const [sideAllowed, setSideAllowed] = useState(null);
  const [sideError, setSideError] = useState(null);

  useEffect(() => {
    let active = true;
    if (sideCount(cards) === 0) {
      setSideAllowed(true);
      setSideError(null);
      return;
    }
    setSideAllowed(null);
    sideboardAllowedPass(cards)
      .then((v) => {
        if (active) {
          setSideAllowed(v);
          setSideError(null);
        }
      })
      .catch((e) => {
        if (active) {
          setSideAllowed(false);
          setSideError(e?.message || "Scryfall lookup failed");
        }
      });
    return () => {
      active = false;
    };
  }, [cards]);

  const rules = [
    {
      key: "main",
      label: "Main deck is exactly 60 cards",
      pass: mainRulePass(cards),
      detail: `${mainCount(cards)} cards`,
    },
    {
      key: "side",
      label: "Sideboard is 0 to 5 cards",
      pass: sideRulePass(cards),
      detail: `${sideCount(cards)} cards`,
    },
    {
      key: "copies",
      label: "No more than 4 copies of any card name (except basic lands)",
      pass: copiesRulePass(cards),
    },
    {
      key: "sideAllowed",
      label:
        'Sideboard allowed: a main-deck card references "outside the game"',
      pass: sideAllowed,
      loading: sideAllowed === null,
      error: sideError,
    },
  ];

  const allPass = rules.every((r) => r.pass === true);
  return { rules, allPass };
}