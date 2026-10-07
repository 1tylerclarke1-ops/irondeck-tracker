import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";

export default function RunResult({
  run,
  onStart,
  starting,
  canStart,
  failingRules,
  rulesLoading,
  decayDue,
}) {
  const died = run?.result === "died";
  const disabled = starting || rulesLoading || !canStart || decayDue;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 text-center">
        {died && (
          <>
            <div className="text-2xl font-bold text-destructive">
              Run death - decay due
            </div>
            <div className="text-muted-foreground">
              {num(run.total_wins)}–{num(run.losses)} (final)
            </div>
          </>
        )}
        {decayDue && (
          <div className="text-sm text-destructive space-y-1">
            <div className="font-medium">Complete the decay first.</div>
            <Link to="/decay" className="underline">
              Go to Decay
            </Link>
          </div>
        )}
        {!canStart && !rulesLoading && failingRules.length > 0 && (
          <div className="text-sm text-destructive space-y-1 text-left">
            <div className="font-medium">
              Fix these deck rules before starting a run:
            </div>
            <ul className="list-disc list-inside">
              {failingRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <Button onClick={onStart} disabled={disabled}>
          {rulesLoading
            ? "Checking deck..."
            : starting
            ? "Starting..."
            : "Start run"}
        </Button>
      </CardContent>
    </Card>
  );
}