import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { Trash2 } from "lucide-react";

const zoneOf = (c) => c.zone || "main";

export default function DecklistTable({ cards, onChange }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState(1);
  const [saving, setSaving] = useState(false);

  const startEdit = (card) => {
    setEditingId(card.id);
    setEditValue(card.copies);
  };

  const saveEdit = async (card) => {
    setSaving(true);
    try {
      await base44.entities.Card.update(card.id, { copies: Number(editValue) });
      setEditingId(null);
      onChange();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card) => {
    await base44.entities.Card.delete(card.id);
    onChange();
  };

  const renderRows = (list) => {
    if (list.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={5}
            className="text-center text-muted-foreground py-6"
          >
            No cards in this zone.
          </TableCell>
        </TableRow>
      );
    }
    return list.map((card) => (
      <TableRow key={card.id}>
        <TableCell className="font-medium">{card.name}</TableCell>
        <TableCell>
          {editingId === card.id ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 h-8"
              />
              <Button size="sm" onClick={() => saveEdit(card)} disabled={saving}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <span>{card.copies}</span>
          )}
        </TableCell>
        <TableCell className="capitalize">{card.rarity}</TableCell>
        <TableCell className="capitalize">{card.card_type}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            {editingId !== card.id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEdit(card)}
              >
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(card)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  const renderSection = (title, list) => (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Copies</TableHead>
              <TableHead className="w-32">Rarity</TableHead>
              <TableHead className="w-36">Card type</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows(list)}</TableBody>
        </Table>
      </div>
    </div>
  );

  const main = cards.filter((c) => zoneOf(c) === "main");
  const side = cards.filter((c) => zoneOf(c) === "sideboard");

  return (
    <div className="space-y-6">
      {renderSection("Main deck", main)}
      {renderSection("Sideboard", side)}
    </div>
  );
}