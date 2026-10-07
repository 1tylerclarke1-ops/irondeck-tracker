import React from "react";
import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Season Setup" },
  { to: "/run-tracker", label: "Run Tracker" },
  { to: "/decay", label: "Decay" },
];

export default function AppNav() {
  const { pathname } = useLocation();
  return (
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
  );
}