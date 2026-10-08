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

const findAppCard = (appList, arenaName, zone) => {
  const n = (arenaName || "").toLowerCase().trim();
  return appList.find((c) => {
    if ((c.zone || "main") !== zone) return false;
    const full = (c.name || "").toLowerCase().trim();
    const front = full.split(" // ")[0];
    return n === full || n === front;
  });
};

const compareDeck = (arenaEntries, appCards) => {
  const appActive = appCards.filter((c) => (Number(c.copies) || 0) > 0);
  const arenaSum = {};
  const unmatched = [];
  for (const e of arenaEntries) {
    if (e.zone !== "main" && e.zone !== "sideboard") continue;
    const appCard = findAppCard(appActive, e.name, e.zone);
    if (appCard) {
      arenaSum[appCard.id] = (arenaSum[appCard.id] || 0) + e.copies;
    } else {
      unmatched.push({ name: e.name, copies: e.copies, zone: e.zone });
    }
  }
  const diffs = [];
  for (const c of appActive) {
    const arenaCp = arenaSum[c.id] || 0;
    const appCp = Number(c.copies) || 0;
    if (arenaCp !== appCp) {
      diffs.push({
        name: c.name,
        arena: arenaCp,
        app: appCp,
        zone: c.zone || "main",
      });
    }
  }
  for (const u of unmatched) {
    diffs.push({ name: u.name, arena: u.copies, app: 0, zone: u.zone });
  }
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
      const { match, diffs } = compareDeck(entries, cards);
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