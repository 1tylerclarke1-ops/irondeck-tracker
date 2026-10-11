import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// Receives rank snapshots from the IronDeck Arena helper on Tyler's PC.
// Arena's log "constructedLevel" is the tier number shown in Arena (4 = lowest, 1 = highest).

export default async function (req: Request): Promise<Response> {
  try {
    const expected = Deno.env.get("IRONDECK_HELPER_KEY");
    if (!expected || req.headers.get("x-irondeck-key") !== expected) {
      return Response.json({ error: "Unauthorised" }, { status: 401 });
    }
    const base44 = createClientFromRequest(req);
    const b = await req.json();
    const rankClass = String(b?.constructedClass || "");
    const ordinal = Number(b?.constructedSeasonOrdinal);
    if (!rankClass || !Number.isFinite(ordinal)) {
      return Response.json({ error: "No constructed rank in body" }, { status: 400 });
    }
    const level = Number(b?.constructedLevel) || null;
    const row = {
      season_ordinal: ordinal,
      rank_class: rankClass,
      level,
      tier: rankClass === "Mythic" ? null : level,
      step: Number(b?.constructedStep) || 0,
      matches_won: Number(b?.constructedMatchesWon) || 0,
      matches_lost: Number(b?.constructedMatchesLost) || 0,
      percentile: b?.constructedPercentile != null ? Number(b.constructedPercentile) : null,
      leaderboard_place: b?.constructedLeaderboardPlace ? Number(b.constructedLeaderboardPlace) : null,
      captured_at: new Date().toISOString(),
    };
    const ranks = base44.asServiceRole.entities.ArenaRank;
    const last = (await ranks.list("-created_date", 1))[0];
    const unchanged =
      last &&
      last.season_ordinal === row.season_ordinal &&
      last.rank_class === row.rank_class &&
      last.level === row.level &&
      last.step === row.step &&
      (last.leaderboard_place ?? null) === row.leaderboard_place;
    if (unchanged) return Response.json({ ok: true, skipped: true });
    await ranks.create(row);
    return Response.json({ ok: true, saved: row });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}