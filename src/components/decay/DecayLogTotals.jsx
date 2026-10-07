import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function DecayLogTotals({ decays }) {
  const total = decays.length;
  const byRarity = {};
  for (const d of decays) {
    if (d.how_obtained === "wildcard") {
      byRarity[d.rarity_to] = (byRarity[d.rarity_to] || 0) + 1;
    }
  }
  const rarityEntries = Object.entries(byRarity).sort();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-sm text-muted-foreground">Decays this season</div>
          <div className="text-3xl font-bold">{total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground text-center mb-3">
            Wildcards spent
          </div>
          {rarityEntries.length === 0 ? (
            <div className="text-center text-muted-foreground">None yet</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6">
              {rarityEntries.map(([r, c]) => (
                <div key={r} className="text-center">
                  <div className="text-2xl font-bold">{c}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {cap(r)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}