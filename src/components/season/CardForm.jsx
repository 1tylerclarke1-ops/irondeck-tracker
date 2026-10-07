import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

const RARITIES = ["mythic", "rare", "uncommon", "common", "basic"];
const CARD_TYPES = [
  "creature",
  "instant",
  "sorcery",
  "enchantment",
  "artifact",
  "planeswalker",
  "land",
];

export default function CardForm({ seasonId, onAdded }) {
  const [name, setName] = useState("");
  const [copies, setCopies] = useState(1);
  const [rarity, setRarity] = useState("common");
  const [cardType, setCardType] = useState("creature");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Card name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await base44.entities.Card.create({
        season_id: seasonId,
        name: name.trim(),
        copies: Number(copies),
        rarity,
        card_type: cardType,
      });
      setName("");
      setCopies(1);
      setRarity("common");
      setCardType("creature");
      onAdded();
    } catch (err) {
      setError(err.message || "Failed to add card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add card</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="card-name">Name</Label>
            <Input
              id="card-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sheoldred, the Apocalypse"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-copies">Copies</Label>
            <Input
              id="card-copies"
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Rarity</Label>
            <Select value={rarity} onValueChange={setRarity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RARITIES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Card type</Label>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-destructive md:col-span-5">{error}</p>
          )}
          <Button type="submit" disabled={saving} className="md:col-span-5">
            {saving ? "Adding..." : "Add card"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}