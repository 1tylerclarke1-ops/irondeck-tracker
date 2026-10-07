import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

const COLOURS = [
  { code: "W", label: "White" },
  { code: "U", label: "Blue" },
  { code: "B", label: "Black" },
  { code: "R", label: "Red" },
  { code: "G", label: "Green" },
];

export default function SeasonForm({ onCreated }) {
  const [name, setName] = useState("");
  const [colours, setColours] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleColour = (code) => {
    setColours((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || colours.length === 0) {
      setError("Name and at least one colour are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ordered = COLOURS.filter((c) => colours.includes(c.code))
        .map((c) => c.code)
        .join("");
      const allSeasons = await base44.entities.Season.list();
      const maxSeasonNum = allSeasons.reduce(
        (m, s) => Math.max(m, s.season_number || 0),
        0
      );
      await base44.entities.Season.create({
        name: name.trim(),
        colours: ordered,
        status: "active",
        start_date: startDate || null,
        season_number: maxSeasonNum + 1,
      });
      const activeClimbs = await base44.entities.Climb.filter({ status: "active" });
      if (activeClimbs.length === 0) {
        const allClimbs = await base44.entities.Climb.list();
        const maxClimbNum = allClimbs.reduce(
          (m, c) => Math.max(m, c.number || 0),
          0
        );
        await base44.entities.Climb.create({
          number: maxClimbNum + 1,
          start_date: new Date().toISOString().slice(0, 10),
          status: "active",
        });
      }
      setName("");
      setColours([]);
      setStartDate("");
      onCreated();
    } catch (err) {
      setError(err.message || "Failed to create season");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new season</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="season-name">Season name</Label>
            <Input
              id="season-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Season 1"
            />
          </div>
          <div className="space-y-2">
            <Label>Deck colours</Label>
            <div className="flex flex-wrap gap-4">
              {COLOURS.map((c) => (
                <div key={c.code} className="flex items-center gap-2">
                  <Checkbox
                    id={`colour-${c.code}`}
                    checked={colours.includes(c.code)}
                    onCheckedChange={() => toggleColour(c.code)}
                  />
                  <Label htmlFor={`colour-${c.code}`} className="cursor-pointer">
                    {c.code} - {c.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">Start date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create season"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}