import { base44 } from "@/api/base44Client";
import { demoBorn } from "@/lib/demoDeath";

// Live updates instead of polling: runs load() once now, then again only when
// Base44 says one of `entities` changed (a win, a loss, a rot...). Changes that
// arrive together are merged into one reload. A slow safety check runs every 30s
// (every 5s if live updates aren't available), and again when OBS shows the page.
// Returns a stop function for the effect's cleanup.
export function liveReload(entities, load, { fallbackMs = 30000, mergeMs = 250 } = {}) {
  let stopped = false;
  let running = false;
  let again = false;
  let timer = null;

  const run = async () => {
    if (stopped) return;
    if (running) { again = true; return; }
    running = true;
    try { await load(); } catch { /* keep last data */ }
    running = false;
    if (again) { again = false; run(); }
  };
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(run, mergeMs);
  };

  const stops = [];
  for (const name of entities) {
    try {
      const entity = base44.entities[name];
      if (entity && typeof entity.subscribe === "function") stops.push(entity.subscribe(soon));
    } catch { /* fall back to the safety check */ }
  }
  run();
  const safety = setInterval(run, stops.length ? fallbackMs : 5000);
  // Demo mode (?demo=death): one reload when the pretend death starts.
  if (demoBorn) setTimeout(run, Math.max(0, demoBorn - Date.now() + 150));
  const onShow = () => { if (!document.hidden) run(); };
  document.addEventListener("visibilitychange", onShow);

  return () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(safety);
    document.removeEventListener("visibilitychange", onShow);
    stops.forEach((stop) => { try { stop(); } catch { /* ignore */ } });
  };
}