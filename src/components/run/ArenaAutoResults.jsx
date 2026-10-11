import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";

// Arena auto-results: the IronDeck helper on the PC sends each finished ranked
// match to the ArenaMatch table. While a round is in progress, this applies
// them in order, exactly as if the Win / Loss buttons were pressed.
// Matches that finished before the round started, or while no round is
// playing, are marked "ignored" so they never count later.

const CHECK_MS = 4000;
const SETTING_KEY = "irondeck-auto-results";
const toMs = (v) => (v ? new Date(v).getTime() : 0);

export function useAutoResultsSetting() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SETTING_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const set = (v) => {
    setOn(v);
    try {
      localStorage.setItem(SETTING_KEY, v ? "on" : "off");
    } catch {
      // ignore
    }
  };
  return [on, set];
}

export function useArenaAutoResults({ enabled, run, busy, onWin, onLoss }) {
  const [last, setLast] = useState(null);
  const [tick, setTick] = useState(0);
  const fns = useRef({ onWin, onLoss, run });
  fns.current = { onWin, onLoss, run };

  const runKey = `${run?.id}|${run?.round_wins}|${run?.round_losses}|${run?.round_status}`;

  useEffect(() => {
    if (!enabled || busy || !base44.entities.ArenaMatch) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const pending = await base44.entities.ArenaMatch.filter(
          { applied: false },
          "finished_at",
          10
        );
        if (cancelled) return;
        const m = pending[0];
        if (m) {
          const current = fns.current.run;
          const playing = current?.round_status === "playing";
          const startedAt = toMs(current?.round_started_at || current?.updated_date);
          const counts = playing && toMs(m.finished_at) >= startedAt;
          await base44.entities.ArenaMatch.update(m.id, {
            applied: true,
            outcome: counts ? "counted" : "ignored",
            run_id: counts ? current.id : "",
          });
          setLast({ result: m.result, outcome: counts ? "counted" : "ignored", at: m.finished_at });
          if (counts) {
            if (m.result === "win") await fns.current.onWin();
            else await fns.current.onLoss();
          }
        }
      } catch {
        // try again next tick
      }
      if (!cancelled) setTick((t) => t + 1);
    }, CHECK_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [enabled, busy, runKey, tick]);

  return last;
}

export function ArenaAutoStatus({ on, setOn, last }) {
  const time = last?.at
    ? new Date(last.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <Card>
      <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-medium">Record Arena results automatically</span>
        </label>
        <span className="text-muted-foreground">
          {!on
            ? "Off: use the Win / Loss buttons"
            : last
            ? `Last: ${last.result === "win" ? "WIN" : "LOSS"} at ${time} (${last.outcome})`
            : "Waiting for a ranked match…"}
        </span>
      </CardContent>
    </Card>
  );
}