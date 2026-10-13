import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Test page for Base44 live updates (no polling). Open /overlay/live-test (not
// logged in, like OBS), then record a win in the Run Tracker. Each change should
// appear here within a second or two, without this page asking for anything.
const ENTITIES = ["Run", "DayLog", "Season", "DecayEvent"];

export default function LiveTest() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    const stops = [];
    try {
      for (const name of ENTITIES) {
        const entity = base44.entities[name];
        if (!entity || typeof entity.subscribe !== "function") {
          setStatus(`Live updates not available for ${name}`);
          continue;
        }
        stops.push(
          entity.subscribe((e) => {
            const d = e.data || {};
            const detail =
              name === "Run" ? `round ${d.round_wins ?? "?"}-${d.round_losses ?? "?"} · ${d.round_status || ""}` :
              name === "DayLog" ? `day ${d.day ?? "?"} · ${d.result || ""}` :
              name === "Season" ? `condemned: ${d.condemned_card || "none"}` :
              `step: ${d.step || ""}`;
            setEvents((list) => [{ at: new Date().toLocaleTimeString(), name, type: e.type, detail }, ...list].slice(0, 15));
          })
        );
      }
      setStatus((s) => (s === "Connecting…" ? `Listening to ${ENTITIES.join(", ")}` : s));
    } catch (err) {
      setStatus(`Error: ${err?.message || err}`);
    }
    return () => stops.forEach((stop) => { try { stop(); } catch { /* ignore */ } });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0d0a14", color: "#eee", fontFamily: "sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>IronDeck live-update test</h1>
      <p style={{ color: "#b9a3e3", marginTop: 6 }}>{status}</p>
      <p style={{ color: "#888", fontSize: 14 }}>
        Record a win or loss in the Run Tracker. A line should appear below within a second or two.
      </p>
      {events.length === 0 ? (
        <p style={{ marginTop: 24, color: "#888" }}>No changes received yet.</p>
      ) : (
        <table style={{ marginTop: 16, borderCollapse: "collapse", fontSize: 16 }}>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #2a2238" }}>
                <td style={{ padding: "6px 14px 6px 0", color: "#888" }}>{e.at}</td>
                <td style={{ padding: "6px 14px 6px 0", fontWeight: 700 }}>{e.name}</td>
                <td style={{ padding: "6px 14px 6px 0", color: "#f0c674" }}>{e.type}</td>
                <td style={{ padding: "6px 0" }}>{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}