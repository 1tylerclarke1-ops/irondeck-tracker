import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { num } from "@/components/run/runHelpers";

export default function BestRun({ runs }) {
  const best = runs.reduce((max, r) => Math.max(max, num(r.total_wins)), 0);
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="text-sm text-muted-foreground">Best-ever run</div>
        <div className="text-3xl font-bold">{best} wins</div>
      </CardContent>
    </Card>
  );
}