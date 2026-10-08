import {
  mainRulePass,
  sideRulePass,
  copiesRulePass,
  sideboardAllowedPass,
  mainCount,
  sideCount,
} from "@/lib/deckRules";

export function useDeckRules(cards) {
  const sideAllowed = sideboardAllowedPass(cards);

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
    },
  ];

  const allPass = rules.every((r) => r.pass === true);
  return { rules, allPass };
}