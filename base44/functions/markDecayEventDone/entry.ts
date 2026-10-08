import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const id = body?.id;
    if (!id || typeof id !== "string") {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }
    const ev = await base44.asServiceRole.entities.DecayEvent.get(id);
    if (!ev) return Response.json({ error: "Not found" }, { status: 404 });
    if (ev.step !== "verified") {
      return Response.json({ ok: true, skipped: true, step: ev.step });
    }
    await base44.asServiceRole.entities.DecayEvent.update(id, {
      step: "done",
      updated_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, step: "done" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}