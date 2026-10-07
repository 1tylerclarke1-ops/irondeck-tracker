import React, { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, isSameDay, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";
import { postCollection } from "@/lib/scryfall";
import DeckRow from "@/components/overlay/DeckRow";

const RUST = "#a35a3d";

const TOTAL_HEIGHT = 1080;
const PAD_VERTICAL = 32;
const TITLE_BLOCK = 46;
const HEADING_HEIGHT = 24;
const ROW_GAP = 4;
const MAX_ROW = 44;
const MIN_ROW = 16;

function sortDeck(cards) {
  const enriched = cards.map((c) => ({
    ...c,
    _land: c.card_type === "land" ? 1 : 0,
    _mv: c.card_type === "land" ? 999 : Number(c.mana_value) || 0,
  }));
  enriched.sort((a, b) => {
    if (a._land !== b._land) return a._land - b._land;
    if (a._mv !== b._mv) return a._mv - b._mv;
    return (a.name || "").localeCompare(b.name || "");
  });
  return enriched;
}

export default function OverlayDeck() {
  const [season, setSeason] = useState(null);
  const [cards, setCards] = useState([]);
  const [sideCards, setSideCards] = useState([]);
  const [climb, setClimb] = useState(null);
  const [run, setRun] = useState(null);
  const [decays, setDecays] = useState([]);
  const [images, setImages] = useState({});

  const isOutro = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("mode") === "outro";
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = "";
      body.style.background = "";
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const seasons = await base44.entities.Season.filter({ status: "active" });
        if (!active) return;
        const s = seasons && seasons[0];
        if (!s) {
          setSeason(null);
          setCards([]);
          setSideCards([]);
          setClimb(null);
          setRun(null);
          setDecays([]);
          return;
        }
        const [list, climbs, runs, decs] = await Promise.all([
          base44.entities.Card.filter({ season_id: s.id }),
          base44.entities.Climb.list(),
          base44.entities.Run.filter({ season_id: s.id }),
          base44.entities.Decay.filter({ season_id: s.id }),
        ]);
        if (!active) return;
        const sortedClimbs = [...climbs].sort(
          (a, b) => (b.number || 0) - (a.number || 0)
        );
        const sortedRuns = [...runs].sort(
          (a, b) => (b.attempt_number || 0) - (a.attempt_number || 0)
        );
        setSeason(s);
        setClimb(sortedClimbs[0] || null);
        setRun(
          runs.find((r) => r.result === "in_progress") || sortedRuns[0] || null
        );
        setDecays(decs);
        setCards(sortDeck(list.filter((c) => (c.zone || "main") === "main")));
        setSideCards(
          sortDeck(list.filter((c) => (c.zone || "main") === "sideboard"))
        );
      } catch (e) {
        // keep last data on error
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const day = useMemo(() => {
    if (!climb) return null;
    if (climb.status === "active" && climb.start_date)
      return differenceInCalendarDays(new Date(), new Date(climb.start_date)) + 1;
    if (climb.status === "complete") return climb.days_taken || null;
    return null;
  }, [climb]);

  const seasonNumber = season?.season_number ?? null;

  const uniqueNames = useMemo(() => {
    const names = Array.from(
      new Set(
        [...cards, ...sideCards].map((c) => c.name).filter(Boolean)
      )
    );
    names.sort();
    return names;
  }, [cards, sideCards]);
  const namesKey = uniqueNames.join("|");

  useEffect(() => {
    let active = true;
    if (uniqueNames.length === 0) {
      setImages({});
      return;
    }
    const fetchImages = async () => {
      try {
        const data = await postCollection(
          uniqueNames.map((n) => ({ name: n }))
        );
        if (!active) return;
        setImages((prev) => {
          const next = {};
          for (const n of uniqueNames) next[n] = prev[n] ?? null;
          for (const c of data) {
            const url =
              c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal;
            if (url) next[c.name] = url;
          }
          return next;
        });
      } catch (e) {
        // ignore
      }
    };
    fetchImages();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  const todayDecays = useMemo(() => {
    const now = new Date();
    return decays
      .filter((d) => d.date && isSameDay(parseISO(d.date), now))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [decays]);

  const title = `Season ${seasonNumber ?? "—"} · Day ${day ?? "—"}`;

  const hasSide = sideCards.length > 0;
  const total = cards.length + sideCards.length;
  const childCount = total + (hasSide ? 1 : 0);
  const gaps = childCount > 1 ? (childCount - 1) * ROW_GAP : 0;
  const avail = TOTAL_HEIGHT - PAD_VERTICAL - TITLE_BLOCK;
  const rowH =
    total > 0
      ? Math.max(
          MIN_ROW,
          Math.min(MAX_ROW, (avail - (hasSide ? HEADING_HEIGHT : 0) - gaps) / total)
        )
      : MAX_ROW;

  return (
    <div
      style={{
        background: "transparent",
        minHeight: "100vh",
        padding: "16px 24px",
        color: "#fff",
        fontFamily: "sans-serif",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "1.4rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          margin: "0 0 12px",
          color: "#fff",
        }}
      >
        {title}
      </h1>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div
          style={{
            width: 460,
            display: "flex",
            flexDirection: "column",
            gap: ROW_GAP,
          }}
        >
          {cards.map((c) => (
            <DeckRow
              key={c.id}
              card={c}
              imageUrl={images[c.name]}
              loading={images[c.name] === undefined}
              height={rowH}
            />
          ))}
          {hasSide && (
            <>
              <div
                style={{
                  height: HEADING_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "2px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  color: RUST,
                }}
              >
                SIDEBOARD
              </div>
              {sideCards.map((c) => (
                <DeckRow
                  key={c.id}
                  card={c}
                  imageUrl={images[c.name]}
                  loading={images[c.name] === undefined}
                  height={rowH}
                />
              ))}
            </>
          )}
        </div>
      </div>
      {isOutro && <OutroPanel run={run} decays={todayDecays} />}
    </div>
  );
}

function OutroPanel({ run, decays }) {
  const status = run?.round_status;
  const wins = run?.round_wins ?? 0;
  const losses = run?.round_losses ?? 0;
  const resultLabel =
    status === "survived"
      ? "DAY SURVIVED"
      : status === "died"
      ? "RUN DIED"
      : "IN PROGRESS";
  const resultColor =
    status === "survived"
      ? "#2d8a4e"
      : status === "died"
      ? "#c0392b"
      : RUST;

  return (
    <div
      style={{
        marginTop: "14px",
        display: "flex",
        gap: "16px",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "10px 18px",
          borderRadius: "8px",
          background: "rgba(20,23,29,0.82)",
          border: `1px solid ${resultColor}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 200,
        }}
      >
        <span
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: resultColor,
          }}
        >
          TODAY
        </span>
        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>
          {resultLabel}
        </span>
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {wins}–{losses}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          padding: "10px 16px",
          borderRadius: "8px",
          background: "rgba(20,23,29,0.82)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: RUST,
            marginBottom: "6px",
          }}
        >
          CARDS RUSTED TODAY
        </div>
        {decays.length === 0 ? (
          <div
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            No decay today.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 18px",
            }}
          >
            {decays.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.82rem",
                  color: "#fff",
                }}
              >
                <span
                  style={{
                    textDecoration: "line-through",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {d.card_removed}
                </span>
                <span style={{ color: RUST, fontWeight: 800 }}>→</span>
                <span style={{ fontWeight: 700 }}>{d.replacement_card}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}