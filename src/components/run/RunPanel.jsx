import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RunPanel({ run, onWin, onLoss, onUndo, canUndo, busy }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6 text-center">
        <div>
          <div className="text-sm text-muted-foreground">
            Attempt #{run.attempt_number}
          </div>
          <div className="text-5xl font-bold tabular-nums">
            {run.wins}–{run.losses}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button size="lg" className="h-20 text-xl" onClick={onWin} disabled={busy}>
            Win
          </Button>
          <Button
            size="lg"
            variant="destructive"
            className="h-20 text-xl"
            onClick={onLoss}
            disabled={busy}
          >
            Loss
          </Button>
        </div>
        <Button variant="outline" onClick={onUndo} disabled={!canUndo || busy}>
          Undo last result
        </Button>
      </CardContent>
    </Card>
  );
}