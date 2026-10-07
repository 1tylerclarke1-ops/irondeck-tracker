import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";

export default function RunResult({ run, onStart, starting }) {
  const died = run?.result === "died";
  return (
    <Card>
      <CardContent className="pt-6 space-y-4 text-center">
        {died && (
          <>
            <div className="text-2xl font-bold text-destructive">
              Run death - decay due
            </div>
            <div className="text-muted-foreground">
              Attempt #{run.attempt_number}: {num(run.total_wins)} wins (final)
            </div>
          </>
        )}
        <Button onClick={onStart} disabled={starting}>
          {starting ? "Starting..." : "Start run"}
        </Button>
      </CardContent>
    </Card>
  );
}