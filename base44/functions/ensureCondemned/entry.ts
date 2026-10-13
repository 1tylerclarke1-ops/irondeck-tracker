import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// Makes sure today's condemned card exists. Called by the Overlay Intro when it
// finds no card on the block (e.g. the round was started before the wheel).
// Same rules as src/lib/condemned.js: keep the current card if it's still in the
// deck; otherwise pick a random rare/mythic; sentence 3 days, then 2, then 1.
const SENTENCES = [3, 2, 1];
const n = (v: unknown) => Number(v) || 0;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const seasons = await db.Season.filter({ status: "active" });
    const season = seasons && seasons[0];
    if (!season) return Response.json({ error: "No active season" }, { status: 404 });

    const cards = await db.Card.filter({ season_id: season.id });
    const names = [...new Set(
      (cards || [])
        .filter((c: any) => n(c.copies) > 0 && (c.rarity === "rare" || c.rarity === "mythic"))
        .map((c: any) => c.name),
    )];
    if (season.condemned_card && names.includes(season.condemned_card)) {
      return Response.json({ ok: true, kept: true, ...pick(season) });
    }
    if (names.length === 0) return Response.json({ ok: false, reason: "No rares or mythics left" });

    const name = names[Math.floor(Math.random() * names.length)];
    let pardons: Record<string, number> = {};
    try { pardons = JSON.parse(season.pardon_counts || "{}") || {}; } catch { pardons = {}; }
    const capture = n(pardons[name]) + 1;
    const update = {
      condemned_card: name,
      condemned_since: new Date().toISOString(),
      block_days: 0,
      block_sentence: SENTENCES[Math.min(capture, SENTENCES.length) - 1],
      block_capture: capture,
    };
    await db.Season.update(season.id, update);
    return Response.json({ ok: true, kept: false, ...update });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

function pick(s: any) {
  return {
    condemned_card: s.condemned_card,
    condemned_since: s.condemned_since,
    block_days: s.block_days,
    block_sentence: s.block_sentence,
    block_capture: s.block_capture,
  };
}