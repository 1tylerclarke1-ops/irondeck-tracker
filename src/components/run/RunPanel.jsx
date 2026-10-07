import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";

export default function RunPanel({ run, clearedStage, onWin, onLoss, onUndo, canUndo, busy }) {
  const showCleared = Boolean(clearedStage);
  const stage = showCleared ? clearedStage.stage : num(run.stage, 1);
  const stageWins = showCleared ? clearedStage.stage_wins : num(run.stage_wins);
  const stageLosses = showCleared ? clearedStage.stage_losses : num(run.stage_losses);
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
        {showCleared && (
          <div className="text-xl font-bold text-green-600">
            Stage {stage} cleared!
          </div>
        )}
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