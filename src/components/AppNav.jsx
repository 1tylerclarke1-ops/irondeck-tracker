import React from "react";
import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Season Setup" },
  { to: "/run-tracker", label: "Run Tracker" },
  { to: "/decay", label: "Decay" },
  { to: "/decay-log", label: "Decay Log" },
];

export default function AppNav() {
  const { pathname } = useLocation();
  return (
    <>
    <p className="text-xs text-muted-foreground mb-2">
      IronDeck: software and concept created and owned by Tyler Dee Clarke, for the sole use of TDC Gaming. © 2026 Tyler Dee Clarke. All rights reserved.
    </p>
    <nav className="flex gap-2 border-b pb-3 mb-6">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            pathname === l.to
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
    </>
  );
}