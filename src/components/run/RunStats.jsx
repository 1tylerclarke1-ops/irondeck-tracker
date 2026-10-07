import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RunStats({
  seasonNumber,
  day,
  roundWins,
  roundLosses,
  runWins,
  best,
  showMythic,
  onMythic,
  mythicBusy,
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat label="Season" value={seasonNumber ?? "—"} />
          <Stat label="Day" value={day ?? "—"} />
          <Stat label="Round" value={`${roundWins}–${roundLosses}`} />
          <Stat label="Run wins" value={runWins} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Best: <span className="font-bold text-foreground">{best}</span> wins
          </div>
          {showMythic && (
            <Button variant="secondary" onClick={onMythic} disabled={mythicBusy}>
              {mythicBusy ? "Saving..." : "Mythic reached"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}