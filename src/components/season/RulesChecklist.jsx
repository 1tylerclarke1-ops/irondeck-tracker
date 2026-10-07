import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Loader2 } from "lucide-react";
import { useDeckRules } from "@/lib/useDeckRules";

export default function RulesChecklist({ cards }) {
  const { rules, allPass } = useDeckRules(cards);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Deck rules</h3>
          <span
            className={`text-sm font-medium ${
              allPass ? "text-green-600" : "text-destructive"
            }`}
          >
            {allPass ? "All rules pass" : "Some rules fail"}
          </span>
        </div>
        <ul className="space-y-2">
          {rules.map((r) => {
            const loading = r.pass === null || r.loading;
            const pass = r.pass === true;
            return (
              <li key={r.key} className="flex items-start gap-2 text-sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground" />
                ) : pass ? (
                  <Check className="h-4 w-4 mt-0.5 text-green-600" />
                ) : (
                  <X className="h-4 w-4 mt-0.5 text-destructive" />
                )}
                <span className={pass ? "" : "text-destructive"}>
                  {r.label}
                  {r.detail ? ` (${r.detail})` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}