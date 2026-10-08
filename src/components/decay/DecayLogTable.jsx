import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { num } from "@/components/run/runHelpers";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function DecayLogTable({ rows, onSetHowObtained }) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        No decays logged yet.
      </div>
    );
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Decay #</TableHead>
            <TableHead>Attempt</TableHead>
            <TableHead>Card removed</TableHead>
            <TableHead>Rarity change</TableHead>
            <TableHead>Replacement</TableHead>
            <TableHead>How obtained</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{d.decay_number}</TableCell>
              <TableCell>#{num(d.attempt_number)}</TableCell>
              <TableCell>{d.card_removed}</TableCell>
              <TableCell>
                {cap(d.rarity_from)} → {cap(d.rarity_to)}
              </TableCell>
              <TableCell>{d.replacement_card}</TableCell>
              <HowObtainedCell
                decay={d}
                onSetHowObtained={onSetHowObtained}
              />
              <TableCell>
                {d.date ? new Date(d.date).toLocaleString() : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HowObtainedCell({ decay, onSetHowObtained }) {
  const [busy, setBusy] = useState(false);
  if (decay.how_obtained !== "pending") {
    return <span className="capitalize">{decay.how_obtained}</span>;
  }
  const choose = async (value) => {
    setBusy(true);
    try {
      await onSetHowObtained(decay.id, value);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => choose("owned")}
      >
        Owned
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => choose("wildcard")}
      >
        Wildcard
      </Button>
    </div>
  );
}