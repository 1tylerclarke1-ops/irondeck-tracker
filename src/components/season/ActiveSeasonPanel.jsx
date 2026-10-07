import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActiveSeasonPanel({ season, onEnd, ending }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{season.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <span>
            <strong className="text-muted-foreground">Colours:</strong> {season.colours}
          </span>
          <span>
            <strong className="text-muted-foreground">Status:</strong>{" "}
            <span className="capitalize">{season.status}</span>
          </span>
          {season.start_date && (
            <span>
              <strong className="text-muted-foreground">Start:</strong> {season.start_date}
            </span>
          )}
        </div>
        <Button variant="destructive" onClick={onEnd} disabled={ending}>
          {ending ? "Ending..." : "End Season"}
        </Button>
      </CardContent>
    </Card>
  );
}