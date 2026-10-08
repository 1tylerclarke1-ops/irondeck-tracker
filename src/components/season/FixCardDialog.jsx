import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { resolveCards } from "@/lib/resolveCard";
import { scryfallFieldsFor } from "@/components/season/arenaImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CandidateChips from "@/components/season/CandidateChips";

// Opens the Scryfall picker for a card with no scryfall_id and saves only the
// Scryfall-derived fields. Never changes copies or zone. Works when locked.
export default function FixCardDialog({ card, onFixed }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResolved(null);
    try {
      const r = await resolveCards([
        {
          name: card.name,
          set: card.set || null,
          number: card.collector_number || null,
        },
      ]);
      setResolved(r[0]);
    } catch (e) {
      setError(e.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async (scryfallCard) => {
    setSaving(true);
    setError(null);
    try {
      const f = scryfallFieldsFor(scryfallCard);
      await base44.entities.Card.update(card.id, f);
      setOpen(false);
      onFixed();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Fix
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fix &quot;{card.name}&quot;</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : resolved ? (
          <div className="space-y-3">
            {resolved.card && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Matched: </span>
                  <span className="font-medium">{resolved.card.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    ({resolved.confidence}%)
                  </span>
                </div>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => save(resolved.card)}
                >
                  {saving ? "Saving..." : "Save match"}
                </Button>
              </div>
            )}
            {!resolved.card && (
              <p className="text-sm text-muted-foreground">
                No confident match found.
              </p>
            )}
            {resolved.candidates && resolved.candidates.length > 0 && (
              <div className="pt-2">
                <CandidateChips
                  candidates={resolved.candidates}
                  onPick={save}
                  disabled={saving}
                />
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}