import { base44 } from "@/api/base44Client";
import { fetchRollCards } from "@/lib/decayRoll";
import { num } from "@/components/run/runHelpers";
import { poolFor } from "@/lib/condemned";

// Direct Scryfall image links (redirect to the image); no lookup needed.
const scryImage = (id, version) =>
  id ? `https://api.scryfall.com/cards/${id}?format=image&version=${version}` : "";

// Run the full decay flow and create a single DecayEvent.
// - condemned: the card on the block (rots first); any rarity.
// - step: "death" for a Death Run (plays the death screen), "missed" for a
//   missed day (shown in the next intro instead).
export async function performDecay({ season, cards, run, condemned, step = "death" }) {
  if (!season || !run) throw new Error("Missing season or run");

  // 1. The condemned card rots. Without one, pick a random card from the wheel's
  //    pool (rares/mythics, or uncommons, then commons, if none are left).
  const { names: poolNames } = poolFor(cards);
  const eligible = cards.filter((c) => num(c.copies) > 0 && poolNames.includes(c.name));
  const seen = new Set();
  const uniqueCards = [];
  for (const c of eligible) {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      uniqueCards.push(c);
    }
  }
  const condemnedCard = condemned
    ? cards.find((c) => c.name === condemned && num(c.copies) > 0) || null
    : null;
  if (!condemnedCard && uniqueCards.length === 0) throw new Error("No cards left to decay");
  const chosen = condemnedCard || uniqueCards[Math.floor(Math.random() * uniqueCards.length)];

  // 2. Roll uncommon or common 50/50, then fetch replacement + decoys.
  const rollRarity = Math.random() < 0.5 ? "uncommon" : "common";
  const { rollCards, replacement, replacementRule } = await fetchRollCards({
    rarity: rollRarity,
    season,
    deckCards: cards,
    cardType: chosen.card_type,
  });

  // 3. Image links for the removed card and the wheel (no extra requests).
  const removedImage = scryImage(chosen.scryfall_id, "normal");
  const wheelArt = uniqueCards.map((c) => scryImage(c.scryfall_id, "art_crop"));

  // 4. Apply the decay to the cards.
  //    (the removal and the replacement are saved at the same time)
  const targetZone = chosen.zone || "main";
  const newCopies = Math.max(num(chosen.copies) - 1, 0);
  const now = new Date().toISOString();
  const existing = cards.find(
    (c) => c.name === replacement.name && (c.zone || "main") === targetZone
  );
  let replacementCardId;
  const removeWrite = base44.entities.Card.update(chosen.id, { copies: newCopies });
  if (existing) {
    replacementCardId = existing.id;
    await Promise.all([
      removeWrite,
      base44.entities.Card.update(existing.id, {
        copies: num(existing.copies) + 1,
        is_decay_replacement: true,
        decayed_at: now,
      }),
    ]);
  } else {
    const [, created] = await Promise.all([removeWrite, base44.entities.Card.create({
      season_id: season.id,
      name: replacement.name,
      copies: 1,
      rarity: replacement.rarity,
      card_type: replacement.card_type,
      zone: targetZone,
      mana_cost: replacement.mana_cost || "",
      colours: replacement.colours || "",
      mana_value: replacement.mana_value ?? null,
      scryfall_id: replacement.scryfall_id || null,
      outside_the_game: Boolean(replacement.outside_the_game),
      is_decay_replacement: true,
      decayed_at: now,
    })]);
    replacementCardId = created?.id || null;
  }

  // 5. Compute post-decay deck state and decide whether the sideboard rots.
  const postCards = cards.map((c) => {
    if (c.id === chosen.id) return { ...c, copies: newCopies };
    if (existing && c.id === existing.id)
      return { ...c, copies: num(existing.copies) + 1 };
    return c;
  });
  if (!existing && replacementCardId) {
    postCards.push({
      id: replacementCardId,
      copies: 1,
      zone: targetZone,
      outside_the_game: Boolean(replacement.outside_the_game),
    });
  }
  const sideHasCopies = postCards.some(
    (c) => (c.zone || "main") === "sideboard" && num(c.copies) > 0
  );
  const mainHasOutside = postCards.some(
    (c) =>
      (c.zone || "main") === "main" &&
      num(c.copies) > 0 &&
      c.outside_the_game === true
  );
  const sideboardRotted = sideHasCopies && !mainHasOutside;

  const toZero = sideboardRotted
    ? postCards.filter((c) => (c.zone || "main") === "sideboard" && num(c.copies) > 0)
    : [];

  // 6. Clear the sideboard (if it rotted) and create the Decay record together.
  const [, decay] = await Promise.all([
    toZero.length
      ? base44.entities.Card.bulkUpdate(toZero.map((c) => ({ id: c.id, copies: 0 })))
      : Promise.resolve(null),
    base44.entities.Decay.create({
    season_id: season.id,
    run_id: run.id,
    attempt_number: run.attempt_number,
    card_removed: chosen.name,
    rarity_from: chosen.rarity,
    rarity_to: replacement.rarity,
    replacement_card: replacement.name,
    how_obtained: "pending",
    zone: targetZone,
    sideboard_rotted: sideboardRotted,
    replacement_rule: replacementRule,
    date: now,
    }),
  ]);

  // 7. Create one DecayEvent with everything, step "death".
  const event = await base44.entities.DecayEvent.create({
    season_id: season.id,
    run_id: run.id,
    decay_id: decay.id,
    step,
    wheel_card_names: uniqueCards.map((c) => c.name),
    wheel_card_ids: uniqueCards.map((c) => c.scryfall_id || ""),
    wheel_card_art: wheelArt,
    chosen_card: chosen.name,
    card_removed: chosen.name,
    card_removed_id: chosen.scryfall_id || "",
    card_removed_image: removedImage,
    replacement_card: replacement.name,
    replacement_card_id: replacement.scryfall_id || "",
    replacement_card_image: replacement.imageUrl || "",
    rarity_roll: rollRarity,
    roll_cards: rollCards,
    zone: targetZone,
    sideboard_rotted: sideboardRotted,
    replacement_rule: replacementRule,
        updated_at: new Date().toISOString(), // the moment the overlays can see it (not when the decay started)
    was_condemned: Boolean(condemnedCard),
  });

  return { event, decayId: decay.id };
}