import React, { useEffect, useState } from "react";
import OverlayFrame, { GAME, BAND_H, SIDE_W } from "@/pages/OverlayFrame";
import OverlayDeck from "@/pages/OverlayDeck";
import Overlay from "@/pages/Overlay";

// IronDeck stream layout: ONE OBS browser source for the Game scene.
//
//   ┌──────────┬──────────────────────────────┐
//   │  LOGO    │  HUD (season/day, wins,      │  <- top band, full width
//   │          │  losses, run/best, rank)     │
//   ├──────────┼──────────────────────────────┤
//   │ DECK     │                              │
//   │ SIDEBAR  │   GAME WINDOW (transparent)  │  <- Arena shows through
//   │          │                              │
//   └──────────┴──────────────────────────────┘
//
// Designed at 1920 x 1080 and scaled to fit the source's size, so the
// proportions hold at any resolution. Layers (bottom to top):
//   0  frame: background, band, game-window border, logo
//   1  deck sidebar
//   2  HUD
// The Arena game source sits UNDER this source in OBS; the death screen sits above it.

const DESIGN_W = 1920;
const DESIGN_H = 1080;

function useFitScale() {
  const calc = () => {
    const w = window.innerWidth || DESIGN_W;
    const h = window.innerHeight || DESIGN_H;
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    return { scale, x: (w - DESIGN_W * scale) / 2, y: (h - DESIGN_H * scale) / 2 };
  };
  const [fit, setFit] = useState(calc);
  useEffect(() => {
    const on = () => setFit(calc());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return fit;
}

export default function OverlayLayout() {
  const { scale, x, y } = useFitScale();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    return () => {
      html.style.background = "";
      body.style.background = "";
      body.style.overflow = "";
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "transparent" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          overflow: "hidden",
        }}
      >
        {/* 0: frame, band, logo (game window left transparent) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <OverlayFrame />
        </div>

        {/* 1: deck sidebar, under the logo, down to the bottom */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SIDE_W,
            height: DESIGN_H,
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          <OverlayDeck />
        </div>

        {/* 2: HUD, in the top band to the right of the logo */}
        <div
          style={{
            position: "absolute",
            left: GAME.x,
            top: 0,
            width: GAME.w,
            height: BAND_H,
            zIndex: 2,
          }}
        >
          <Overlay embedded />
        </div>
      </div>
    </div>
  );
}