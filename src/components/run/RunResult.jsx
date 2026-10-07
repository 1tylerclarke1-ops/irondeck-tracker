import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RunResult({ run, onStart, starting }) {
  const cleared = run?.result === "cleared";
  const died = run?.result === "died";
  return (
    <Card>
      <CardContent className="pt-6 space-y-4 text-center">
        {cleared && (
          <div className="text-2xl font-bold text-green-600">Run cleared!</div>
        )}
        {died && (
          <div className="text-2xl font-bold text-destructive">
            Run death - decay due
          </div>
        )}
        {run && (
          <div className="text-muted-foreground">
            Attempt #{run.attempt_number}: {run.wins}–{run.losses}
          </div>
        )}
        <Button onClick={onStart} disabled={starting}>
          {starting ? "Starting..." : "Start run"}
        </Button>
      </CardContent>
    </Card>
  );
}