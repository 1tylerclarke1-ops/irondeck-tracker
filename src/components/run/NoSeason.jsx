import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function NoSeason() {
  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-2">
        <p className="text-muted-foreground">
          No active season. Create one to start tracking runs.
        </p>
        <Link to="/" className="text-primary underline">
          Go to Season Setup
        </Link>
      </CardContent>
    </Card>
  );
}