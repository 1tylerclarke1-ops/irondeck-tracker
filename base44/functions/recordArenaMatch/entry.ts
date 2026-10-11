import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// Receives finished ranked matches from the IronDeck Arena helper on Tyler's PC
// and stores them as pending results for the Run Tracker to apply.

export default async function (req: Request): Promise<Response> {
  try {
    const expected = Deno.env.get("IRONDECK_HELPER_KEY");
    if (!expected || req.headers.get("x-irondeck-key") !== expected) {
      return Response.json({ error: "Unauthorised" }, { status: 401 });
    }
    const base44 = createClientFromRequest(req);
    const b = await req.json();
    const matchId = String(b?.matchId || "");
    const result = b?.result === "win" ? "win" : b?.result === "loss" ? "loss" : "";
    if (!matchId || !result) {
      return Response.json({ error: "Need matchId and result (win/loss)" }, { status: 400 });
    }
    const matches = base44.asServiceRole.entities.ArenaMatch;
    const existing = await matches.filter({ match_id: matchId });
    if (existing.length) return Response.json({ ok: true, skipped: true });
    const row = {
      match_id: matchId,
      event_id: String(b?.eventId || ""),
      result,
      finished_at: b?.finishedAt || new Date().toISOString(),
      applied: false,
      outcome: "",
      run_id: "",
    };
    await matches.create(row);
    return Response.json({ ok: true, saved: row });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}