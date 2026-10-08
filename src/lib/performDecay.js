import { base44 } from "@/api/base44Client";
import { fetchRollCards } from "@/lib/decayRoll";
import { fetchCardArtById } from "@/lib/scryfall";
import { num } from "@/components/run/runHelpers";

// Run the full decay flow for a dead run and create a single "death" DecayEvent.
export async function performDecay({ season, cards, run }) {
  if (!season || !run) throw new Error("Missing season or run");

  // 1. Pick a random unique mythic/rare card with copies > 0 (main or sideboard).
  const eligible = cards.filter(
    (c) => num(c.copies) > 0 && (c.rarity === "mythic" || c.rarity === "rare")
  );
  if (eligible.length === 0) throw new Error("No eligible cards to decay");
  const seen = new Set();
  const uniqueCards = [];
  for (const c of eligible) {
    if (!seen.has(c.name)) {
      seen.add(c.name);
      uniqueCards.push(c);
    }
  }
  const chosen = uniqueCards[Math.floor(Math.random() * uniqueCards.length)];

  // 2. Roll uncommon or common 50/50, then fetch replacement + decoys.
  const rollRarity = Math.random() < 0.5 ? "uncommon" : "common";
  const { rollCards, replacement, replacementRule } = await fetchRollCards({
    rarity: rollRarity,
    season,
    deckCards: cards,
    cardType: chosen.card_type,
  });

  // 3. Fetch the removed card's image and every wheel card's art in parallel.
  const fetches = [
    chosen.scryfall_id
      ? fetchCardArtById(chosen.scryfall_id)
      : Promise.resolve(null),
    ...uniqueCards.map((c) =>
      c.scryfall_id ? fetchCardArtById(c.scryfall_id) : Promise.resolve(null)
    ),
  ];
  const results = await Promise.all(fetches);
  const removedImage = results[0]?.normal || "";
  const wheelArt = results.slice(1).map((r) => r?.artCrop || "");

  // 4. Apply the decay to the cards.
  const targetZone = chosen.zone || "main";
  const newCopies = Math.max(num(chosen.copies) - 1, 0);
  await base44.entities.Card.update(chosen.id, { copies: newCopies });
  const now = new Date().toISOString();
  const existing = cards.find(
    (c) => c.name === replacement.name && (c.zone || "main") === targetZone
  );
  let replacementCardId;
  if (existing) {
    replacementCardId = existing.id;
    await base44.entities.Card.update(existing.id, {
      copies: num(existing.copies) + 1,
      is_decay_replacement: true,
      decayed_at: now,
    });
  } else {
    const created = await base44.entities.Card.create({
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
    });
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

  if (sideboardRotted) {
    const toZero = postCards.filter(
      (c) => (c.zone || "main") === "sideboard" && num(c.copies) > 0
    );
    if (toZero.length) {
      await base44.entities.Card.bulkUpdate(
        toZero.map((c) => ({ id: c.id, copies: 0 }))
      );
    }
  }

  // 6. Create the Decay record.
  const decay = await base44.entities.Decay.create({
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
  });

  // 7. Create one DecayEvent with everything, step "death".
  const event = await base44.entities.DecayEvent.create({
    season_id: season.id,
    run_id: run.id,
    decay_id: decay.id,
    step: "death",
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
    updated_at: now,
  });

  return { event, decayId: decay.id };
}