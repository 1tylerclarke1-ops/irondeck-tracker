import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { num } from "@/components/run/runHelpers";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function DecayLogTable({ rows }) {
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
              <TableCell className="capitalize">{d.how_obtained}</TableCell>
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