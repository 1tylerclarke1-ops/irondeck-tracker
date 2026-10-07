import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RoundPanel({
  phase,
  survived,
  onWin,
  onLoss,
  onUndo,
  onStart,
  canUndo,
  busy,
  canStart,
  failingRules,
  rulesLoading,
  decayDue,
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4 text-center">
        {phase === "playing" && (
          <div className="space-y-6">
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
          </div>
        )}

        {phase === "ready" && (
          <div className="space-y-4">
            {survived && (
              <div className="text-xl font-bold text-green-600">Day survived</div>
            )}
            <Button
              size="lg"
              className="h-16 text-lg w-full max-w-xs mx-auto"
              onClick={onStart}
              disabled={busy}
            >
              {busy ? "Starting..." : "Start today's round"}
            </Button>
            {survived && (
              <Button variant="outline" onClick={onUndo} disabled={!canUndo || busy}>
                Undo last result
              </Button>
            )}
          </div>
        )}

        {phase === "died-blocked" && (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-destructive">
              Run death - decay due
            </div>
            <div className="text-sm text-destructive space-y-1">
              <div className="font-medium">Complete the decay first.</div>
              <Link to="/decay" className="underline">
                Go to Decay
              </Link>
            </div>
          </div>
        )}

        {phase === "new-run" && (
          <div className="space-y-4">
            {!canStart && !rulesLoading && failingRules.length > 0 && (
              <div className="text-sm text-destructive space-y-1 text-left">
                <div className="font-medium">
                  Fix these deck rules before starting a round:
                </div>
                <ul className="list-disc list-inside">
                  {failingRules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              size="lg"
              className="h-16 text-lg w-full max-w-xs mx-auto"
              onClick={onStart}
              disabled={busy || rulesLoading || !canStart}
            >
              {rulesLoading
                ? "Checking deck..."
                : busy
                ? "Starting..."
                : "Start today's round"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}