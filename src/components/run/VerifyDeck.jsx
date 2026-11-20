import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { parseArenaText } from "@/components/season/arenaImport";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// The same card in different printings (art/set) counts as one card:
// compare total copies per card name, separately for main deck and sideboard.
const nameKey = (name) =>
  (name || "").toLowerCase().split(/\s+\/\/\/?\s+/)[0].trim();

const compareDeck = (arenaEntries, appCards, expectEmptySideboard = false) => {
  const skipSide = (zone) => expectEmptySideboard && zone === "sideboard";
  const totals = {}; // "zone|name" -> { name, zone, arena, app }
  const add = (zone, name, field, copies) => {
    const key = `${zone}|${nameKey(name)}`;
    if (!totals[key]) totals[key] = { name, zone, arena: 0, app: 0 };
    totals[key][field] += copies;
  };
  for (const c of appCards) {
    const zone = c.zone || "main";
    const copies = Number(c.copies) || 0;
    if (copies > 0 && !skipSide(zone)) add(zone, c.name, "app", copies);
  }
  for (const e of arenaEntries) {
    if (e.zone !== "main" && e.zone !== "sideboard") continue;
    if (skipSide(e.zone)) continue;
    add(e.zone, e.name, "arena", Number(e.copies) || 0);
  }
  const diffs = Object.values(totals).filter((t) => t.arena !== t.app);
  return { match: diffs.length === 0, diffs };
};

export default function VerifyDeck({ deathEvent, cards, onVerified }) {
  const [text, setText] = useState("");
  const [diffs, setDiffs] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!deathEvent || deathEvent.step !== "death") return null;

  const handleVerify = async () => {
    setBusy(true);
    try {
      const entries = parseArenaText(text);
      const { match, diffs } = compareDeck(
        entries,
        cards,
        deathEvent.sideboard_rotted
      );
      if (match) {
        await base44.entities.DecayEvent.update(deathEvent.id, {
          step: "verified",
          updated_at: new Date().toISOString(),
        });
        setResult("match");
        setDiffs(null);
        onVerified?.();
      } else {
        setResult("nomatch");
        setDiffs(diffs);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-purple-500/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-purple-700">Verify Deck</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          A run died. Paste your Arena deck export, then click Verify to confirm
          your deck matches before starting the next round.
        </p>
        {deathEvent.sideboard_rotted && (
          <p className="text-sm font-medium text-purple-700">
            The sideboard rotted: remove all sideboard cards before verifying.
          </p>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={"Deck\n4 Lightning Strike (DMU) 137\n2 Mountain (DMU) 263\n\nSideboard\n2 Negate (DMU) 58"}
          className="font-mono text-sm"
        />
        <Button
          onClick={handleVerify}
          disabled={busy || !text.trim()}
        >
          {busy ? "Verifying..." : "Verify"}
        </Button>
        {result === "match" && (
          <p className="text-sm font-semibold text-green-600">
            Deck verified ✓ — you can start the next round.
          </p>
        )}
        {result === "nomatch" && diffs && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-600">
              Deck doesn't match. Fix these in Arena and re-export:
            </p>
            <ul className="text-sm text-muted-foreground space-y-0.5">
              {diffs.map((d, i) => (
                <li key={i}>
                  {d.zone === "sideboard" ? "SB " : ""}
                  {d.name}: Arena {d.arena}, app {d.app}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}