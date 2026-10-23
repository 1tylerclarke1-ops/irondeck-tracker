import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { postCollection } from "@/lib/scryfall";
import { irondeckText } from "@/lib/overlayText";
import ManaSymbols from "@/components/overlay/ManaSymbols";

// Season intro: plays on the first day of a season (inside DeckIntroRecap).
// Scenes: last season's title → the month (day results) → the rot spreads →
// the final result → the reset (Arena rank) → [rules] → the new season + deck.
// Everything is laid out on a fixed 1920×1080 stage; DeckIntroRecap scales it.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const CINZEL = '"Cinzel", serif';
const IMAGE_WAIT_MS = 4000;
const START_DELAY = 1100; // let the TDC shield finish docking before scene 1

// Arena constructed rank emblems: one image sheet, 4 columns × 6 rows
// (rows: Bronze, Silver, Gold, Platinum, Diamond, Mythic). Leave "" to use the drawn gem.
const RANK_SPRITE = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/78b084191_rank-emblems.png";
const SPRITE_ROWS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"];
const LEFT_IS_TIER_1 = true; // sheet columns left → right are Tier 1, 2, 3, 4
const at = (t, from) => t >= from;

const solid = (size, color, extra = {}) => ({
  fontFamily: CINZEL,
  fontWeight: 900,
  fontSize: size,
  lineHeight: 1,
  color,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textShadow:
    "0 2px 0 #000, 0 0 6px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.85)",
  whiteSpace: "nowrap",
  ...extra,
});

const GOLD = "#FFD691";
const LILAC = "#D9C6FF";
const CREAM = "#F5E6C4";
const MUTED = "#BFB4A0";

function Plate({ children, tone = "gold", style }) {
  const border =
    tone === "rot" ? "rgba(170,130,240,0.7)" : "rgba(226,160,80,0.7)";
  return (
    <div
      style={{
        padding: "14px 34px",
        borderRadius: 12,
        background: "rgba(8,9,13,0.86)",
        border: `2px solid ${border}`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.7)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Fades in/out and rises slightly when `show` flips.
function Rise({ show, children, style, dy = 18, dur = 0.8 }) {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : `translateY(${dy}px)`,
        transition: `opacity ${dur}s ease, transform ${dur + 0.1}s ${EASE}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Heading({ kicker, title, lt }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 95,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <Rise show={at(lt, 0)}>
        <span style={solid(28, "#E8DCC4", { letterSpacing: "0.35em" })}>
          {kicker}
        </span>
      </Rise>
      <Rise show={at(lt, 150)}>
        <span style={irondeckText(84)}>{title}</span>
      </Rise>
    </div>
  );
}

function CardImg({ image, name, h, tone, drained }) {
  const w = Math.round(h * 0.716);
  const ring =
    tone === "rot"
      ? "0 0 0 3px #7c5aa8, 0 0 22px 4px rgba(124,90,168,0.55)"
      : tone === "gold"
      ? "0 0 0 3px #e0a050, 0 0 26px 6px rgba(224,160,80,0.6)"
      : "0 0 0 2px #9aa3ae, 0 0 0 4px #2a2e35";
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        borderRadius: w * 0.05,
        overflow: "hidden",
        background: "#0b0b12",
        boxShadow: `${ring}, 0 14px 34px rgba(0,0,0,0.8)`,
        flexShrink: 0,
      }}
    >
      {image ? (
        <img
          src={image}
          alt={name || ""}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            filter: drained ? "grayscale(1) brightness(0.55) contrast(1.1)" : "none",
            transition: "filter 0.9s ease",
          }}
        />
      ) : (
        <div
          style={{
            ...solid(Math.max(12, h * 0.07), CREAM, { whiteSpace: "normal" }),
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 10,
            lineHeight: 1.2,
          }}
        >
          {name}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(110,70,180,0.45)",
          mixBlendMode: "multiply",
          opacity: drained ? 1 : 0,
          transition: "opacity 0.9s ease",
        }}
      />
    </div>
  );
}

// ---------- Rank helpers ----------
const RANK_COLOURS = {
  Bronze: ["#f0b583", "#7a4520"],
  Silver: ["#f4f7fa", "#7d8794"],
  Gold: ["#ffe591", "#b07a18"],
  Platinum: ["#c8fbf3", "#3a9a92"],
  Diamond: ["#d6e6ff", "#3d6fd6"],
  Mythic: ["#ffcb94", "#d4421c"],
};

export function rankLabel(r) {
  if (!r) return null;
  const cls = r.rank_class || "Unranked";
  if (cls === "Mythic") {
    if (r.leaderboard_place) return `Mythic #${r.leaderboard_place}`;
    if (r.percentile) return `Mythic ${Math.round(r.percentile)}%`;
    return "Mythic";
  }
  return r.tier ? `${cls} ${r.tier}` : cls;
}

// Arena's emblem from the sheet; falls back to a simple drawn gem.
function RankGem({ rank, size = 120 }) {
  const row = SPRITE_ROWS.indexOf(rank?.rank_class);
  if (RANK_SPRITE && row >= 0) {
    const tier = Math.min(4, Math.max(1, Number(rank.tier) || 1));
    const col = row === 5 ? 0 : LEFT_IS_TIER_1 ? tier - 1 : 4 - tier;
    return (
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          backgroundImage: `url(${RANK_SPRITE})`,
          backgroundSize: `${size * 4}px ${size * 6}px`,
          backgroundPosition: `${-col * size}px ${-row * size}px`,
          backgroundRepeat: "no-repeat",
          filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.75))",
        }}
      />
    );
  }
  const [hi, lo] = RANK_COLOURS[rank?.rank_class] || ["#cfd3d8", "#555c66"];
  const id = `g${(rank?.rank_class || "x").toLowerCase()}${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ filter: `drop-shadow(0 0 ${size * 0.12}px ${lo})`, flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
      </defs>
      <polygon points="50,3 97,50 50,97 3,50" fill={`url(#${id})`} stroke="#120d08" strokeWidth="3" />
      <polygon points="50,22 78,50 50,78 22,50" fill="rgba(255,255,255,0.18)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
      <path d="M50 3 L50 22 M97 50 L78 50 M50 97 L50 78 M3 50 L22 50" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
      <polygon points="50,8 70,28 50,24 30,28" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

// ---------- Data ----------
const num = (v) => Number(v) || 0;
const byDate = (a, b) =>
  (a.date || "").localeCompare(b.date || "") ||
  new Date(a.created_date || 0) - new Date(b.created_date || 0);

function pickRanks(snapshots) {
  const list = (snapshots || [])
    .filter((r) => r && r.season_ordinal != null && r.rank_class)
    .sort((a, b) => new Date(a.captured_at || a.created_date || 0) - new Date(b.captured_at || b.created_date || 0));
  if (!list.length) return { finalRank: null, resetRank: null };
  const newest = Math.max(...list.map((r) => num(r.season_ordinal)));
  const older = list.filter((r) => num(r.season_ordinal) < newest);
  const current = list.filter((r) => num(r.season_ordinal) === newest);
  return {
    finalRank: older.length ? older[older.length - 1] : null, // last rank before the reset
    resetRank: current[0] || null, // first rank seen after the reset
  };
}

async function loadSeasonIntro({ season, seasonNumber, allCards }) {
  const E = base44.entities;
  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };
  const prev =
    seasonNumber != null
      ? (await safe(() => E.Season.filter({ season_number: seasonNumber - 1 }), []))[0] || null
      : null;

  let days = [];
  let decays = [];
  let bestRun = 0;
  let mythic = null;
  if (prev) {
    const [logs, ds, runs, climbs] = await Promise.all([
      safe(() => E.DayLog.filter({ season_id: prev.id }), []),
      safe(() => E.Decay.filter({ season_id: prev.id }), []),
      safe(() => E.Run.filter({ season_id: prev.id }), []),
      safe(() => E.Climb.list(), []),
    ]);
    const sortedLogs = [...logs].sort(byDate);
    days = sortedLogs.map((l, i) => ({
      day: l.day ?? i + 1,
      wins: num(l.wins),
      losses: num(l.losses),
      died: l.result === "died",
    }));
    const dayOfDecay = {};
    sortedLogs.forEach((l) => (l.decay_ids || []).forEach((id) => (dayOfDecay[id] = l.day)));
    decays = [...ds].sort(byDate).map((d) => ({
      id: d.id,
      day: dayOfDecay[d.id] ?? null,
      removed: d.card_removed,
      added: d.replacement_card,
    }));
    bestRun = runs.reduce((m, r) => Math.max(m, num(r.total_wins)), 0);
    const from = prev.start_date || "";
    const to = season?.start_date || "9999-12-31";
    const hit = climbs.find((c) => c.mythic_date && c.mythic_date >= from && c.mythic_date < to);
    mythic = hit ? { reached: true, days: hit.days_taken, number: hit.number } : { reached: false };
  }

  const ranks = E.ArenaRank ? await safe(() => E.ArenaRank.list("-created_date", 200), []) : [];
  const { finalRank, resetRank } = pickRanks(ranks);

  const order = { mythic: 0, rare: 1 };
  const atRisk = (allCards || [])
    .filter((c) => ["mythic", "rare"].includes((c.rarity || "").toLowerCase()) && num(c.copies) > 0)
    .sort(
      (a, b) =>
        order[(a.rarity || "").toLowerCase()] - order[(b.rarity || "").toLowerCase()] ||
        (a.name || "").localeCompare(b.name || "")
    );

  return {
    prev: prev
      ? { number: prev.season_number, name: prev.name, colours: prev.colours }
      : null,
    newNumber: seasonNumber,
    deckName: season?.name || "",
    colours: season?.colours || "",
    days,
    decays,
    bestRun,
    totalWins: days.reduce((s, d) => s + d.wins, 0),
    deaths: days.filter((d) => d.died).length,
    survived: days.filter((d) => !d.died).length,
    mythic,
    finalRank,
    resetRank,
    atRisk,
  };
}

function preload(urls) {
  return Promise.all(
    urls.filter(Boolean).map(
      (src) =>
        new Promise((r) => {
          const img = new Image();
          img.onload = img.onerror = r;
          img.src = src;
        })
    )
  );
}

// ---------- Timeline ----------
export const RULES_MS = 0; // rules explainer added in the next stage

function buildScenes(d, showRules) {
  const s = [];
  if (d.prev) {
    s.push({ key: "title", dur: 2800 });
    s.push({ key: "month", dur: 1300 + 60 * d.days.length + 3200 });
    s.push({ key: "rot", dur: 1300 + 560 * Math.max(1, d.decays.length) + 2600 });
    s.push({ key: "result", dur: 4600 });
    if (d.finalRank && d.resetRank) s.push({ key: "reset", dur: 4600 });
  }
  if (showRules && RULES_MS) s.push({ key: "rules", dur: RULES_MS });
  s.push({ key: "deck", dur: 7600 });
  let t0 = START_DELAY;
  for (const sc of s) {
    sc.start = t0;
    t0 += sc.dur;
  }
  return { scenes: s, total: t0 };
}

function Scene({ lt, dur, last, children }) {
  if (lt < -60 || (!last && lt > dur + 60)) return null;
  const visible = lt >= 0 && (last || lt < dur - 450);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.45s ease",
      }}
    >
      {children}
    </div>
  );
}

// ---------- Scenes ----------
function TitleScene({ lt, d }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
      }}
    >
      <Rise show={at(lt, 0)}>
        <span style={solid(36, "#E8DCC4", { letterSpacing: "0.4em" })}>The story of</span>
      </Rise>
      <div
        style={{
          ...irondeckText(170),
          whiteSpace: "nowrap",
          opacity: at(lt, 350) ? 1 : 0,
          transform: at(lt, 350) ? "scale(1)" : "scale(1.25)",
          filter: at(lt, 350) ? "blur(0px) drop-shadow(0 6px 6px rgba(0,0,0,0.85))" : "blur(12px)",
          transition: `opacity 0.8s ease, transform 1s ${EASE}, filter 0.9s ease`,
        }}
      >
        SEASON {d.prev.number}
      </div>
      {d.prev.name && (
        <Rise show={at(lt, 1100)}>
          <Plate>
            <span style={solid(34, CREAM)}>{d.prev.name}</span>
          </Plate>
        </Rise>
      )}
    </div>
  );
}

function MonthScene({ lt, d }) {
  const n = d.days.length;
  const perRow = n <= 12 ? Math.max(n, 1) : Math.ceil(n / 2); // two balanced rows
  const tileW = Math.floor(Math.min(130, (1740 - 12 * (perRow - 1)) / perRow));
  const tileH = Math.round(tileW * 1.22);
  const rowsH = (n > 12 ? 2 : 1) * tileH + (n > 12 ? 12 : 0);
  const statsAt = 900 + n * 60 + 300;
  const stats = [
    ["Days played", n],
    ["Survived", d.survived],
    ["Death runs", d.deaths],
    ["Total wins", d.totalWins],
    ["Best run", d.bestRun],
  ];
  return (
    <>
      <Heading kicker={`Season ${d.prev.number}`} title="THE MONTH" lt={lt} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 330,
          transform: "translateX(-50%)",
          display: "grid",
          gridTemplateColumns: `repeat(${perRow}, ${tileW}px)`,
          gap: 12,
        }}
      >
        {d.days.map((day, i) => {
          const show = at(lt, 900 + i * 60);
          const died = day.died;
          return (
            <div
              key={i}
              style={{
                width: tileW,
                height: tileH,
                borderRadius: 10,
                background: died ? "rgba(32,18,52,0.9)" : "rgba(40,27,10,0.9)",
                border: `2px solid ${died ? "rgba(170,130,240,0.85)" : "rgba(226,160,80,0.85)"}`,
                boxShadow: died
                  ? "0 0 16px rgba(150,100,230,0.35)"
                  : "0 0 16px rgba(230,160,70,0.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0 10px",
                opacity: show ? 1 : 0,
                transform: show ? "translateY(0) scale(1)" : "translateY(16px) scale(0.92)",
                transition: `opacity 0.4s ease, transform 0.5s ${EASE}`,
              }}
            >
              <span style={solid(Math.round(tileW * 0.15), MUTED)}>Day {day.day}</span>
              <span style={solid(Math.round(tileW * 0.34), died ? LILAC : GOLD)}>
                {day.wins}–{day.losses}
              </span>
              <span style={solid(Math.round(tileW * 0.12), died ? LILAC : GOLD, { letterSpacing: "0.12em" })}>
                {died ? "Death" : "Survived"}
              </span>
            </div>
          );
        })}
        {!n && (
          <Plate>
            <span style={solid(30, CREAM)}>No days were recorded</span>
          </Plate>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 330 + rowsH + 70,
          display: "flex",
          justifyContent: "center",
          gap: 26,
        }}
      >
        {stats.map(([label, value], i) => (
          <Rise key={label} show={at(lt, statsAt + i * 150)}>
            <Plate tone={label === "Death runs" ? "rot" : "gold"} style={{ minWidth: 230, textAlign: "center", padding: "16px 22px" }}>
              <div style={solid(19, MUTED, { letterSpacing: "0.22em" })}>{label}</div>
              <div style={{ ...solid(52, label === "Death runs" ? LILAC : GOLD), marginTop: 12 }}>
                {value}
              </div>
            </Plate>
          </Rise>
        ))}
      </div>
    </>
  );
}

function DownArrow({ show }) {
  return (
    <svg
      width="40"
      height="34"
      viewBox="0 0 40 34"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 0.4s ease",
        filter: "drop-shadow(0 0 8px rgba(255,140,40,0.95))",
      }}
    >
      <path
        d="M20 3 L20 26 M8 16 L20 29 L32 16"
        stroke="#ff9a36"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RotScene({ lt, d, images }) {
  const n = d.decays.length;
  const twoRows = n > 12;
  const cols = twoRows ? Math.ceil(n / 2) : Math.max(n, 1);
  const gap = 22;
  const maxW = (1740 - gap * (cols - 1)) / cols;
  const cardH = Math.round(Math.min(twoRows ? 120 : 230, maxW / 0.716));
  const rows = twoRows ? [d.decays.slice(0, cols), d.decays.slice(cols)] : [d.decays];
  return (
    <>
      <Heading
        kicker={`Season ${d.prev.number} · ${n} ${n === 1 ? "card" : "cards"} rotted`}
        title="THE ROT SPREADS"
        lt={lt}
      />
      {!n ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 480, display: "flex", justifyContent: "center" }}>
          <Rise show={at(lt, 700)}>
            <Plate>
              <span style={solid(40, GOLD)}>Not a single card rotted</span>
            </Plate>
          </Rise>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: twoRows ? 300 : 330,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {rows.map((row, r) => (
            <div key={r} style={{ display: "flex", gap }}>
              {row.map((dc, j) => {
                const i = r * cols + j;
                const t0 = 900 + i * 560;
                return (
                  <Rise key={dc.id || i} show={at(lt, t0)} dy={20} dur={0.6}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span style={solid(Math.max(13, cardH * 0.08), MUTED)}>
                        {dc.day != null ? `Day ${dc.day}` : "  "}
                      </span>
                      <CardImg image={images[dc.removed]} name={dc.removed} h={cardH} tone="rot" drained={at(lt, t0 + 350)} />
                      <DownArrow show={at(lt, t0 + 250)} />
                      <div
                        style={{
                          opacity: at(lt, t0 + 420) ? 1 : 0,
                          transform: at(lt, t0 + 420) ? "translateY(0)" : "translateY(-14px)",
                          transition: `opacity 0.5s ease, transform 0.6s ${EASE}`,
                        }}
                      >
                        <CardImg image={images[dc.added]} name={dc.added} h={cardH} tone="gold" />
                      </div>
                    </div>
                  </Rise>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BigStat({ label, children, show, tone = "gold" }) {
  return (
    <Rise show={show} dy={26}>
      <Plate
        tone={tone}
        style={{
          width: 470,
          height: 290,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 20,
        }}
      >
        <div style={solid(24, MUTED, { letterSpacing: "0.25em" })}>{label}</div>
        {children}
      </Plate>
    </Rise>
  );
}

function ResultScene({ lt, d }) {
  const m = d.mythic;
  return (
    <>
      <Heading kicker={`Season ${d.prev.number}`} title="THE FINAL RESULT" lt={lt} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 400,
          display: "flex",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <BigStat label="Best run" show={at(lt, 600)}>
          <div style={solid(96, GOLD)}>{d.bestRun}</div>
          <div style={solid(28, CREAM)}>{d.bestRun === 1 ? "win" : "wins"}</div>
        </BigStat>
        <BigStat label="Mythic" show={at(lt, 1200)} tone={m?.reached ? "gold" : "rot"}>
          <div style={solid(m?.reached ? 64 : 50, m?.reached ? GOLD : LILAC)}>
            {m?.reached ? "Reached" : "Not reached"}
          </div>
          <div style={solid(28, CREAM)}>
            {m?.reached
              ? m.days
                ? `in ${m.days} ${m.days === 1 ? "day" : "days"}`
                : "this season"
              : "The climb goes on"}
          </div>
        </BigStat>
        <BigStat label="Final rank" show={at(lt, 1800)}>
          {d.finalRank ? (
            <>
              <RankGem rank={d.finalRank} size={150} />
              <div style={solid(40, CREAM)}>{rankLabel(d.finalRank)}</div>
            </>
          ) : (
            <div style={solid(34, MUTED)}>Not recorded</div>
          )}
        </BigStat>
      </div>
    </>
  );
}

function BigArrow({ draw }) {
  return (
    <svg width="220" height="90" viewBox="0 0 220 90" style={{ filter: "drop-shadow(0 0 14px rgba(255,140,40,0.95))" }}>
      <path
        d="M10 45 L196 45 M168 16 L202 45 L168 74"
        stroke="#ff9a36"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={draw ? 0 : 100}
        style={{ transition: `stroke-dashoffset 0.8s ${EASE}` }}
      />
    </svg>
  );
}

function RankBlock({ label, rank, show, tone }) {
  return (
    <Rise show={show} dy={24}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: 520 }}>
        <span style={solid(26, tone === "rot" ? LILAC : GOLD, { letterSpacing: "0.3em" })}>{label}</span>
        <RankGem rank={rank} size={260} />
        <Plate tone={tone}>
          <span style={solid(50, CREAM)}>{rankLabel(rank)}</span>
        </Plate>
      </div>
    </Rise>
  );
}

function ResetScene({ lt, d }) {
  return (
    <>
      <Heading kicker="The Arena season resets" title="THE RESET" lt={lt} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 300,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <RankBlock label="Finished" rank={d.finalRank} show={at(lt, 500)} tone="gold" />
        <BigArrow draw={at(lt, 1300)} />
        <RankBlock label="Reset to" rank={d.resetRank} show={at(lt, 1900)} tone="rot" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 900, display: "flex", justifyContent: "center" }}>
        <Rise show={at(lt, 2700)}>
          <span style={solid(30, "#E8DCC4", { letterSpacing: "0.2em" })}>
            Every climb starts from the reset
          </span>
        </Rise>
      </div>
    </>
  );
}

function colourCost(colours) {
  return (colours || "")
    .toUpperCase()
    .replace(/[^WUBRG]/g, "")
    .split("")
    .map((c) => `{${c}}`)
    .join("");
}

function DeckScene({ lt, d, cardImages }) {
  const cards = d.atRisk;
  const n = cards.length;
  const cardH = n > 14 ? 260 : 300;
  const cardW = cardH * 0.716;
  const step = n > 1 ? Math.min(150, (1560 - cardW) / (n - 1)) : 0;
  const totalW = cardW + step * Math.max(n - 1, 0);
  const mid = (n - 1) / 2;
  const tilt = n > 1 ? Math.min(4, 36 / n) : 0;
  const fanAt = 2100;
  const cost = colourCost(d.colours);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Rise show={at(lt, 0)}>
          <span style={solid(30, "#E8DCC4", { letterSpacing: "0.4em" })}>A new season begins</span>
        </Rise>
        <div
          style={{
            ...irondeckText(120),
            whiteSpace: "nowrap",
            opacity: at(lt, 300) ? 1 : 0,
            transform: at(lt, 300) ? "scale(1)" : "scale(1.25)",
            filter: at(lt, 300) ? "blur(0px) drop-shadow(0 6px 6px rgba(0,0,0,0.85))" : "blur(12px)",
            transition: `opacity 0.8s ease, transform 1s ${EASE}, filter 0.9s ease`,
          }}
        >
          {d.newNumber != null ? `SEASON ${d.newNumber}` : "NEW SEASON"}
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", gap: 28, alignItems: "stretch" }}>
        <Rise show={at(lt, 1100)}>
          <Plate style={{ height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 26, padding: "16px 36px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={solid(20, MUTED, { letterSpacing: "0.25em" })}>The new deck</span>
              <span style={solid(46, GOLD)}>{d.deckName || "Unnamed deck"}</span>
            </div>
            {cost && (
              <div style={{ transform: "scale(2.4)", transformOrigin: "left center", width: 20 * (cost.length / 3) * 2.4 }}>
                <ManaSymbols cost={cost} />
              </div>
            )}
          </Plate>
        </Rise>
        {d.resetRank && (
          <Rise show={at(lt, 1500)}>
            <Plate tone="rot" style={{ height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: "16px 30px" }}>
              <RankGem rank={d.resetRank} size={92} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={solid(20, MUTED, { letterSpacing: "0.25em" })}>Starting rank</span>
                <span style={solid(40, CREAM)}>{rankLabel(d.resetRank)}</span>
              </div>
            </Plate>
          </Rise>
        )}
      </div>

      {n > 0 && (
        <>
          <div style={{ position: "absolute", left: (1920 - totalW) / 2, top: 520, width: totalW, height: cardH + 60 }}>
            {cards.map((c, i) => {
              const show = at(lt, fanAt + i * 70);
              const rot = (i - mid) * tilt;
              const lift = Math.abs(i - mid) * Math.abs(i - mid) * (n > 1 ? 18 / (mid * mid || 1) : 0);
              const img = c.scryfall_id ? cardImages[c.scryfall_id]?.normal : null;
              return (
                <div
                  key={c.id || i}
                  style={{
                    position: "absolute",
                    left: i * step,
                    top: lift,
                    transform: show ? `rotate(${rot}deg) translateY(0)` : `rotate(${rot}deg) translateY(60px)`,
                    transformOrigin: "50% 120%",
                    opacity: show ? 1 : 0,
                    transition: `opacity 0.45s ease, transform 0.6s ${EASE}`,
                  }}
                >
                  <CardImg image={img} name={c.name} h={cardH} tone={(c.rarity || "").toLowerCase() === "mythic" ? "gold" : "steel"} />
                  {num(c.copies) > 1 && (
                    <div
                      style={{
                        position: "absolute",
                        right: -8,
                        bottom: -8,
                        ...solid(22, "#1a120c", { textShadow: "none" }),
                        background: "linear-gradient(180deg,#FFF0CD,#D68C3C)",
                        borderRadius: 999,
                        padding: "6px 10px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
                      }}
                    >
                      ×{num(c.copies)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 960, display: "flex", justifyContent: "center" }}>
            <Rise show={at(lt, fanAt + n * 70 + 300)}>
              <Plate tone="rot">
                <span style={solid(30, LILAC)}>
                  At risk · {n} {n === 1 ? "rare or mythic" : "rares & mythics"} the rot can take
                </span>
              </Plate>
            </Rise>
          </div>
        </>
      )}
    </>
  );
}

// ---------- Main ----------
export default function SeasonIntro({ t, season, seasonNumber, allCards, cardImages, showRules, onReady }) {
  const [data, setData] = useState(null);
  const [nameImages, setNameImages] = useState({});
  const readyRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const d = await loadSeasonIntro({ season, seasonNumber, allCards });
      if (!active) return;
      // Rotted/scavenged card images by name.
      const names = Array.from(new Set(d.decays.flatMap((x) => [x.removed, x.added]).filter(Boolean)));
      const map = {};
      if (names.length) {
        try {
          const res = await postCollection(names.map((n) => ({ name: n })));
          for (const c of res) {
            const url = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || null;
            if (!url) continue;
            if (c.name) map[c.name] = url;
            const front = c.card_faces?.[0]?.name;
            if (front) map[front] = url;
          }
          names.forEach((n) => {
            if (map[n]) return;
            const k = Object.keys(map).find((x) => x.toLowerCase() === n.toLowerCase());
            if (k) map[n] = map[k];
          });
          // Not found by full name (e.g. double-faced cards like "Campus Composer // Aqueous Aria")?
          // 1) try the front face's name, 2) use the card's Scryfall id from the deck records.
          const missing = names.filter((n) => !map[n]);
          if (missing.length) {
            const front = (n) => n.split(" // ")[0].trim();
            const res2 = await postCollection(missing.map((n) => ({ name: front(n) }))).catch(() => []);
            for (const c of res2) {
              const url = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || null;
              if (!url) continue;
              const keys = [c.name, c.card_faces?.[0]?.name].filter(Boolean).map((x) => x.toLowerCase());
              missing.forEach((n) => {
                if (!map[n] && keys.includes(front(n).toLowerCase())) map[n] = url;
              });
            }
            for (const n of missing.filter((x) => !map[x])) {
              const rows = await base44.entities.Card.filter({ name: n }).catch(() => []);
              const r = (rows || []).find((c) => c.scryfall_id);
              if (r) map[n] = `https://api.scryfall.com/cards/${r.scryfall_id}?format=image&version=normal`;
            }
          }
        } catch {
          // best effort
        }
      }
      const deckUrls = d.atRisk.map((c) => (c.scryfall_id ? cardImages?.[c.scryfall_id]?.normal : null));
      await Promise.race([
        preload([...Object.values(map), ...deckUrls, RANK_SPRITE]),
        new Promise((r) => setTimeout(r, IMAGE_WAIT_MS)),
      ]);
      if (!active) return;
      setNameImages(map);
      setData(d);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.id, seasonNumber]);

  const timeline = useMemo(() => (data ? buildScenes(data, showRules) : null), [data, showRules]);

  useEffect(() => {
    if (timeline && !readyRef.current) {
      readyRef.current = true;
      onReady?.(timeline.total);
    }
  }, [timeline, onReady]);

  if (!data || !timeline) return null;
  return (
    <>
      {timeline.scenes.map((sc, i) => {
        const lt = t - sc.start;
        let body = null;
        if (sc.key === "title") body = <TitleScene lt={lt} d={data} />;
        if (sc.key === "month") body = <MonthScene lt={lt} d={data} />;
        if (sc.key === "rot") body = <RotScene lt={lt} d={data} images={nameImages} />;
        if (sc.key === "result") body = <ResultScene lt={lt} d={data} />;
        if (sc.key === "reset") body = <ResetScene lt={lt} d={data} />;
        if (sc.key === "deck") body = <DeckScene lt={lt} d={data} cardImages={cardImages || {}} />;
        return (
          <Scene key={sc.key} lt={lt} dur={sc.dur} last={i === timeline.scenes.length - 1}>
            {body}
          </Scene>
        );
      })}
    </>
  );
}