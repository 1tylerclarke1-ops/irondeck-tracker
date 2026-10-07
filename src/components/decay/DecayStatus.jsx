import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function DecayStatus({ message }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="text-xl font-semibold">{message}</div>
      </CardContent>
    </Card>
  );
}