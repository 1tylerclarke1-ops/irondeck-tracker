import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";
import {
  parseArenaText,
  lookupCards,
  rarityFor,
  typeFor,
  manaInfoFor,
} from "@/components/season/arenaImport";

export default function ArenaImport({ seasonId, onImported }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const foundCount = rows.filter((r) => r.found).length;
  const notFoundCount = rows.length - foundCount;

  const handlePreview = async () => {
    setError(null);
    const entries = parseArenaText(text);
    if (entries.length === 0) {
      setRows([]);
      setError('No deck entries found. Paste your Arena export starting with a "Deck" line.');
      return;
    }
    setLoading(true);
    try {
      const cards = await lookupCards(entries);
      setRows(
        entries.map((e, i) => {
          const card = cards[i];
          const mi = card
            ? manaInfoFor(card)
            : { mana_cost: "", colours: "", mana_value: null };
          return {
            name: e.name,
            copies: e.copies,
            zone: e.zone,
            rarity: card ? rarityFor(card) : "",
            card_type: card ? typeFor(card) : "",
            mana_cost: mi.mana_cost,
            colours: mi.colours,
            mana_value: mi.mana_value,
            scryfall_id: card ? card.id : null,
            set: card ? card.set : null,
            collector_number: card ? card.collector_number : null,
            found: !!card,
          };
        })
      );
    } catch (err) {
      setError(err.message || "Failed to look up cards.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await base44.entities.Card.deleteMany({ season_id: seasonId });
      const toCreate = rows
        .filter((r) => r.found)
        .map((r) => ({
          season_id: seasonId,
          name: r.name,
          copies: r.copies,
          original_copies: r.copies,
          rarity: r.rarity,
          card_type: r.card_type,
          zone: r.zone,
          mana_cost: r.mana_cost,
          colours: r.colours,
          mana_value: r.mana_value,
          scryfall_id: r.scryfall_id || null,
          set: r.set || null,
          collector_number: r.collector_number || null,
        }));
      if (toCreate.length) await base44.entities.Card.bulkCreate(toCreate);
      setText("");
      setRows([]);
      onImported();
    } catch (err) {
      setError(err.message || "Import failed.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Arena</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="arena-export">Paste Arena export</Label>
          <Textarea
            id="arena-export"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Deck\n4 Sheoldred, the Apocalypse (DMU) 97\n2 Cut Down (DMU) 95\n\nSideboard\n1 Liliana of the Veil (DMU) 97"}
            className="font-mono text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handlePreview} disabled={loading || !text.trim()}>
          {loading ? "Looking up..." : "Preview"}
        </Button>

        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {foundCount} found, {notFoundCount} not found
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Copies</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={!r.found ? "bg-destructive/10" : ""}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.copies}</TableCell>
                      <TableCell className="capitalize">
                        {r.zone || "—"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {r.rarity || "—"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {r.card_type || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Confirm import</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace decklist?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will replace your current decklist with {foundCount} card
                    {foundCount === 1 ? "" : "s"}.
                    {notFoundCount > 0
                      ? ` ${notFoundCount} card${
                          notFoundCount === 1 ? "" : "s"
                        } not found will be skipped.`
                      : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm} disabled={confirming}>
                    {confirming ? "Importing..." : "Replace decklist"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}