import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";

export default function RunPanel({ run, onWin, onLoss, onContinue, onUndo, canUndo, busy }) {
  const pending = Boolean(run.stage_cleared_pending);
  const stage = num(run.stage, 1);
  const stageWins = num(run.stage_wins);
  const stageLosses = num(run.stage_losses);
  const totalWins = num(run.total_wins);
  return (
    <Card>
      <CardContent className="pt-6 space-y-6 text-center">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            Attempt #{run.attempt_number} · Stage #{stage}
          </div>
          <div className="text-5xl font-bold tabular-nums">
            {stageWins}–{stageLosses}
          </div>
          <div className="text-sm text-muted-foreground">
            Current run: {totalWins} wins
          </div>
        </div>
        {pending ? (
          <div className="space-y-4">
            <div className="text-xl font-bold text-green-600">
              Stage {stage} cleared! 7–{stageLosses}
            </div>
            <Button
              size="lg"
              className="h-20 text-xl w-full"
              onClick={onContinue}
              disabled={busy}
            >
              Continue
            </Button>
          </div>
        ) : (
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
        )}
        <Button variant="outline" onClick={onUndo} disabled={!canUndo || busy}>
          Undo last result
        </Button>
      </CardContent>
    </Card>
  );
}