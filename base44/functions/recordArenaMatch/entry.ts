import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// Receives finished ranked matches from the IronDeck Arena helper on Tyler's PC
// and stores them as pending results for the Run Tracker to apply.
// It also moves the rank on by Arena's step rules (Arena only logs the real rank
// at login / when the profile is opened). The next real rank corrects any drift.

const RANK_ORDER = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
// [steps per win, steps per loss]; 6 steps per tier; tier 4 is the lowest.
const STEP_RULES: Record<string, Record<string, [number, number]>> = {
  Ladder: { Bronze: [2, 0], Silver: [2, 1], Gold: [2, 1], Platinum: [1, 1], Diamond: [1, 1] },
  Traditional_Ladder: { Bronze: [2, 0], Silver: [2, 2], Gold: [2, 2], Platinum: [2, 2], Diamond: [2, 2] },
};
const toMs = (v: unknown) => {
  if (!v) return 0;
  const s = String(v);
  return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`).getTime();
};

function nextRank(last: any, result: string, eventId: string) {
  const rules = STEP_RULES[eventId];
  const cls = String(last?.rank_class || "");
  if (!rules || !rules[cls]) return null; // Mythic or unknown: can't estimate
  const [up, down] = rules[cls];
  let ci = RANK_ORDER.indexOf(cls);
  let tier = Number(last.level) || 4;
  let step = Number(last.step) || 0;
  if (result === "win") {
    step += up;
    if (step >= 6) {
      step = 0;
      if (tier > 1) tier -= 1;
      else {
        ci += 1;
        tier = 4;
      }
    }
  } else {
    step -= down;
    if (step < 0) {
      if (tier < 4) {
        tier += 1;
        step += 6;
      } else step = 0; // can't drop out of a rank
    }
  }
  const rankClass = RANK_ORDER[ci];
  const mythic = rankClass === "Mythic";
  return {
    season_ordinal: last.season_ordinal,
    rank_class: rankClass,
    level: mythic ? null : tier,
    tier: mythic ? null : tier,
    step: mythic ? 0 : step,
    matches_won: (Number(last.matches_won) || 0) + (result === "win" ? 1 : 0),
    matches_lost: (Number(last.matches_lost) || 0) + (result === "loss" ? 1 : 0),
    percentile: null,
    leaderboard_place: null,
  };
}

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

    // Move the rank on (only for a match newer than the last rank reading)
    let rank = null;
    try {
      const ranks = base44.asServiceRole.entities.ArenaRank;
      const last = (await ranks.list("-created_date", 1))[0];
      if (last && toMs(row.finished_at) > toMs(last.captured_at)) {
        const next = nextRank(last, result, row.event_id);
        if (next) {
          rank = { ...next, captured_at: new Date(toMs(row.finished_at)).toISOString() };
          await ranks.create(rank);
        }
      }
    } catch {
      // rank estimate is optional
    }
    return Response.json({ ok: true, saved: row, rank });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}