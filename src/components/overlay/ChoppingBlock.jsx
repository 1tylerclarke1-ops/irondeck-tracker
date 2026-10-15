import React, { useEffect, useRef } from "react";
import { goldText, steelText, purpleText } from "@/lib/overlayText";

// The chopping block panel for the deck sidebar (fills the 456×786 deck panel).
// mode "block": the condemned card stands on the block, with its sentence pips.
// mode "rot":   plays while the death screen runs: the axe pulls itself out of
//               the stump, rises, swings right-to-left through the card and
//               stays buried; the rot spreads from the axe through the stump
//               and outward from the cut through both halves; the
//               halves crumble and a fungal mass grows in their place.

const MEDIA = "https://media.base44.com/images/public/6ac605d777721f9149c6b225/";
const BLOCK_IMG = MEDIA + "9843f7bd9_block-normal.png";
const STUMP_IMG = MEDIA + "1299fe5b1_stump-normal.png";
const STUMP_ROT_IMG = MEDIA + "006920b1a_stump-rotted.png";
const AXE_IMG = MEDIA + "4a043ee21_axe.png";
const TRAIL_IMG = MEDIA + "043115ed5_slash-trail.png";
const SFX_WRENCH = "https://media.base44.com/files/public/6ac605d777721f9149c6b225/31e8c3da3_axe-wrench.mp3"; // axe wrenching itself out of the stump (knocks at 0.50s and 0.68s)
// Loaded as soon as the overlay opens, so it plays instantly (no download delay).
const wrenchSound = typeof Audio !== "undefined" ? new Audio(SFX_WRENCH) : null;
if (wrenchSound) { wrenchSound.preload = "auto"; wrenchSound.volume = 0.9; }
const ROT_FRAMES_IMG = MEDIA + "1f6e29d17_rot-frames.png";

// The block images are 1024×1536, shown 452 wide at the bottom of the panel.
const STUMP_W = 452;
const STUMP_H = Math.round(STUMP_W * 1.5);
const CARD_W = 250;
const CARD_H = Math.round(CARD_W * 1.396);
const CARD_BOTTOM = 240; // px from the panel bottom: the card stands on the block's top
const ROT_MS = 18500; // rot to 11s, rarity roll, randomiser, then the scavenged card lands
const T_SCAV = 11000;

// Rarity roll (COMMON / UNCOMMON flicker, slowing down) and the randomiser
// (candidate cards flicking through the card outline, slowing to the pick).
const RAR_GAPS = [90, 90, 90, 100, 110, 130, 160, 200, 250, 320, 420];
const RND_GAPS = [70, 70, 70, 75, 80, 90, 100, 115, 135, 160, 190, 230, 280, 340];
const T_RAR = 11600;
const T_RND = 14200;
const times = (start, gaps) => { let t = start; return [start, ...gaps.map((g) => (t += g))]; };
const RAR_T = times(T_RAR, RAR_GAPS);
const RND_T = times(T_RND, RND_GAPS);
const T_LAND = RND_T[RND_T.length - 1];
const RARITY = { common: { label: "COMMON", color: "#d9dde3" }, uncommon: { label: "UNCOMMON", color: "#9fd3ee" } };

// Keyframes that show a layer only during its own steps (held with step-end).
function stepKeys(name, ts, visible, endAt) {
  const k = ts.map((t, i) => pc(t) + " { opacity: " + (visible(i) ? 1 : 0) + " }");
  const tail = endAt ? pc(endAt) + ",100% { opacity: 0 }" : "100% { opacity: 1 }";
  return "@keyframes " + name + " { 0% { opacity: 0 } " + k.join(" ") + " " + tail + " }";
}
const pc = (ms) => (((ms / ROT_MS) * 100).toFixed(2)) + "%";

// The cut runs from upper right to lower left.
const CUT_TOP = "polygon(0 0, 100% 0, 100% 36%, 0 64%)";
const CUT_BOTTOM = "polygon(0 64%, 100% 36%, 100% 100%, 0 100%)";

// Axe image: 1024 wide, grip (handle end) at (85,175). Positioned by its grip.
const AXE_W = 1024;
const GRIP = { x: 85, y: 175 };
const T_IMPACT = 3650;

// Rot frames: 11 frames of 256×512 in one strip, shown at 240×480.
const FRAME_W = 240;
const FRAME_H = 480;
const FRAME_TIMES = [3650, 3900, 4200, 4600, 5000, 5500, 6000, 6600, 7200, 7900, 8600];

// Each key can set the easing of the move that starts there (smooth, no robotic steps).
const EASE = { inOut: "cubic-bezier(.45,0,.55,1)", out: "cubic-bezier(.2,.7,.3,1)", in: "cubic-bezier(.55,0,.85,.45)", rise: "cubic-bezier(.15,.55,.3,1)" };
const axeKey = (ms, x, y, r, s, ease) => pc(ms) + " { transform: translate(" + x + "px, " + y + "px) rotate(" + r + "deg) scale(" + s + ")" + (ease ? "; animation-timing-function: " + ease : "") + " }";
const AXE_KEYS = [
  axeKey(0, 24, 362, -5, 0.134), // in the block, where the block image shows it
  axeKey(380, 24, 362, -5, 0.134, EASE.out),
  axeKey(500, 24, 353, -11, 0.134, EASE.inOut), // first wrench (sound: knock 1 at 0.50s)
  axeKey(590, 24, 359, -3, 0.134, EASE.out),
  axeKey(680, 24, 350, -12, 0.134, EASE.inOut), // second wrench (sound: knock 2 at 0.68s)
  axeKey(900, 24, 354, -8, 0.134, EASE.in), // loose... then tears free, speeding up
  axeKey(1500, 60, 250, -30, 0.18, EASE.rise), // free, still rising fast
  axeKey(2700, 226, 190, -117, 0.26, EASE.inOut), // eases into the top of the swing
  pc(3300) + " { transform: translate(226px, 190px) rotate(-122deg) scale(0.26); animation-timing-function: cubic-bezier(.6,0,1,.5) }",
  axeKey(T_IMPACT, 226, 190, 28, 0.26), // the chop: right to left, down through the card
  axeKey(3800, 226, 190, 23, 0.26),
  axeKey(3950, 226, 190, 26, 0.26),
  axeKey(ROT_MS, 226, 190, 26, 0.26), // stays buried
].join("\n");

// Each rot frame cross-fades into the next, so the mass grows smoothly.
const FADE = 450;
const LAYER_KEYS = FRAME_TIMES.map((t, i) => {
  const next = FRAME_TIMES[i + 1];
  const out = next ? pc(next + FADE) + ",100% { opacity: 0 }" : "100% { opacity: 1 }";
  return "@keyframes cbL" + i + " { 0%," + pc(t) + " { opacity: 0 } " + pc(t + FADE) + (next ? "," + pc(next) : "") + " { opacity: 1 } " + out + " }";
}).join("\n");

const SPORES = Array.from({ length: 14 }, (_, i) => ({
  x: 120 + ((i * 53) % 210),
  y: 300 + ((i * 37) % 200),
  d: 4600 + i * 260,
  s: 4 + (i % 3) * 2,
}));

// ---- Spreading rot (canvas) ----
// Reveals a rotted copy of an image through a creeping, uneven edge that grows
// out from a point or a line, with a glowing purple line along the front.
function makeNoise(seed) {
  const h = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; // 0..1
  };
}

function RotSpread({ src, w, h, from, delay, dur, look = {}, seed = 1, clock }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !src) return undefined;
    const ctx = cv.getContext("2d");
    const mw = Math.ceil(w / 2), mh = Math.ceil(h / 2); // the mask works at half size
    const noise = makeNoise(seed);
    const map = new Float32Array(mw * mh);
    let max = 0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const px = x * 2, py = y * 2;
        let d;
        if (from.line) {
          const [x1, y1, x2, y2] = from.line;
          const dx = x2 - x1, dy = y2 - y1;
          d = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
        } else {
          d = Math.hypot(px - from.x, py - from.y);
        }
        const v = d + noise(px / 55, py / 55) * 90 + noise(px / 18, py / 18) * 30;
        map[y * mw + x] = v;
        if (v > max) max = v;
      }
    }
    for (let i = 0; i < map.length; i++) map[i] /= max;

    const mk = () => { const c = document.createElement("canvas"); c.width = mw; c.height = mh; return c; };
    const mask = mk(), glow = mk();
    const mctx = mask.getContext("2d"), gctx = glow.getContext("2d");
    const md = mctx.createImageData(mw, mh), gd = gctx.createImageData(mw, mh);
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");

    const img = new Image();
    img.src = src;
    const start = performance.now();
    let raf = 0;
    const draw = (now) => {
      // Follow the axe animation's own clock so the rot starts exactly on impact.
      const anim = clock?.current?.getAnimations?.()[0];
      const el = anim && anim.currentTime != null ? anim.currentTime : now - start;
      const t = Math.min(1, Math.max(0, (el - delay) / dur));
      const front = t * 1.15;
      for (let i = 0; i < map.length; i++) {
        const a = Math.min(1, Math.max(0, (front - map[i]) / 0.05));
        const q = (map[i] - front) / 0.022;
        const g = t > 0 && t < 1 ? Math.exp(-q * q) : 0;
        const k = i * 4;
        md.data[k + 3] = a * 255;
        gd.data[k] = 200; gd.data[k + 1] = 140; gd.data[k + 2] = 255; gd.data[k + 3] = g * 200;
      }
      mctx.putImageData(md, 0, 0);
      gctx.putImageData(gd, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.filter = look.filter || "none";
      ctx.drawImage(img, 0, 0, w, h);
      ctx.filter = "none";
      if (look.tint) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = look.tint;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0, w, h);
      // the glowing front, kept inside the image's shape
      tctx.globalCompositeOperation = "source-over";
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(glow, 0, 0, w, h);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(img, 0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(tmp, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      if (t < 1) raf = requestAnimationFrame(draw);
    };
    img.onload = () => { raf = requestAnimationFrame(draw); };
    return () => cancelAnimationFrame(raf);
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: w, height: h }} />;
}

// One half of the slashed card: rots outward from the cut, then crumbles away.
function Half({ image, clip, seed, anim, clock }) {
  return (
    <div style={{ position: "absolute", inset: 0, clipPath: clip, animation: anim + " " + ROT_MS + "ms ease-in forwards" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 13, overflow: "hidden" }}>
        {image && <img src={image} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />}
        <RotSpread src={image} w={CARD_W} h={CARD_H} delay={3700} dur={2500} seed={seed} clock={clock}
          from={{ line: [CARD_W, CARD_H * 0.36, 0, CARD_H * 0.64] }}
          look={{ filter: "grayscale(1) brightness(.55) sepia(.4) hue-rotate(220deg)", tint: "rgba(70,25,140,.55)" }} />
      </div>
    </div>
  );
}

export default function ChoppingBlock({ mode, name, image, day, sentence, recapture, newName, newImage, rarity, rollCards, playSound }) {
  const rot = mode === "rot";
  // Sound: the axe wrenching loose, timed to the start of the execution (skipped after an OBS refresh mid-way).
  useEffect(() => {
    if (!rot || !playSound || !wrenchSound) return;
    wrenchSound.currentTime = 0;
    wrenchSound.play().catch(() => {});
  }, [rot]);
  const wait = mode === "wait"; // the first 2s of a Death Run: the card waits on the block
  const axeRef = useRef(null);
  const rar = RARITY[rarity] || null;
  // The randomiser's sequence: candidate images (repeated), ending on the scavenged card.
  const pool = (rollCards || []).map((c) => c.image_url).filter((u) => u && u !== newImage);
  const rollSeq = newImage
    ? [...RND_T.slice(0, -1).map((_, i) => pool.length ? pool[i % pool.length] : newImage), newImage]
    : [];
  const chosen = rarity === "uncommon" ? 1 : 0;
  const n = RAR_T.length - 1; // the last step shows the rolled rarity
  const rollKeys = [
    stepKeys("cbR0", RAR_T, (k) => (k + n + chosen) % 2 === 0, T_RND),
    stepKeys("cbR1", RAR_T, (k) => (k + n + chosen) % 2 === 1, T_RND),
    ...rollSeq.map((_, i) => stepKeys("cbC" + i, RND_T, (k) => k === i || (i === rollSeq.length - 1 && k >= i), i === rollSeq.length - 1 ? null : ROT_MS)),
  ].join("\n");
  const last = !rot && day === sentence;
  const blockImg = { position: "absolute", left: 0, bottom: 0, width: "100%", height: "auto", maxWidth: "none" };

  const shakeShakes = [...Array(8)].map((_, i) => pc(2750 + i * 110) + " { transform: translate(" + (i % 2 ? 3 : -3) + "px, " + (i % 2 ? -1 : 1) + "px) }").join(" ");
  const styleContent = [
    "@keyframes cbGlow { 0%,100% { box-shadow: 0 0 26px 4px rgba(150,80,255,.5) } 50% { box-shadow: 0 0 46px 12px rgba(150,80,255,.85) } }",
    "@keyframes cbBlockOut { 0% { opacity: 1 } " + pc(100) + ",100% { opacity: 0 } }",
    "@keyframes cbStumpIn { 0% { opacity: 0 } " + pc(100) + ",100% { opacity: 1 } }",
    "@keyframes cbAxe { " + AXE_KEYS + " }",
    "@keyframes cbShake { 0%," + pc(2700) + "," + pc(T_IMPACT) + ",100% { transform: none } " + shakeShakes + " }",
    "@keyframes cbTrail { 0%," + pc(3450) + " { opacity: 0; transform: translate(40px,-40px) } " + pc(3650) + " { opacity: 1; transform: none } " + pc(4300) + ",100% { opacity: 0; transform: translate(-10px,10px) } }",
    "@keyframes cbTop { 0%," + pc(T_IMPACT) + " { transform: none; opacity: 1; filter: none } " + pc(3900) + "," + pc(6000) + " { transform: translate(-8px,-12px) rotate(-3deg); opacity: 1; filter: none } " + pc(9000) + " { transform: perspective(500px) translate(4px,40px) rotateX(50deg) rotateY(-14deg) rotateZ(-8deg) scale(.75); opacity: .9; filter: brightness(.7) } " + pc(T_SCAV) + " { transform: perspective(500px) translate(6px,60px) rotateX(62deg) rotateY(-20deg) rotateZ(-12deg) scale(.62); opacity: .85; filter: brightness(.6) } " + pc(T_SCAV + 700) + ",100% { transform: perspective(500px) translate(6px,60px) rotateX(62deg) rotateY(-20deg) rotateZ(-12deg) scale(.62); opacity: 0; filter: brightness(.6) } }",
    "@keyframes cbBottom { 0%," + pc(T_IMPACT) + " { transform: none; opacity: 1; filter: none } " + pc(3900) + "," + pc(6000) + " { transform: translate(8px,10px) rotate(2deg); opacity: 1; filter: none } " + pc(9000) + " { transform: perspective(500px) translate(-4px,-20px) rotateX(-50deg) rotateY(14deg) rotateZ(8deg) scale(.75); opacity: .9; filter: brightness(.7) } " + pc(T_SCAV) + " { transform: perspective(500px) translate(-6px,-30px) rotateX(-62deg) rotateY(20deg) rotateZ(12deg) scale(.62); opacity: .85; filter: brightness(.6) } " + pc(T_SCAV + 700) + ",100% { transform: perspective(500px) translate(-6px,-30px) rotateX(-62deg) rotateY(20deg) rotateZ(12deg) scale(.62); opacity: 0; filter: brightness(.6) } }",
    LAYER_KEYS,
    "@keyframes cbMass { 0%," + pc(T_IMPACT) + " { transform: scale(.8); filter: none } " + pc(8600) + "," + pc(T_SCAV) + " { transform: scale(1); filter: none } " + pc(T_SCAV + 1000) + ",100% { transform: scale(.94); filter: brightness(.45) } }",
    "@keyframes cbGold { 0%,100% { box-shadow: 0 0 26px 6px rgba(255,170,60,.55) } 50% { box-shadow: 0 0 50px 16px rgba(255,190,90,.95) } }",
    "@keyframes cbHdrOut { 0%," + pc(T_SCAV) + " { opacity: 1 } " + pc(T_SCAV + 500) + ",100% { opacity: 0 } }",
    "@keyframes cbHdrIn { 0%," + pc(T_LAND + 150) + " { opacity: 0 } " + pc(T_LAND + 650) + ",100% { opacity: 1 } }",
    "@keyframes cbSlot { 0%," + pc(T_SCAV + 300) + " { opacity: 0 } " + pc(T_RAR) + "," + pc(T_LAND) + " { opacity: 1 } " + pc(T_LAND + 300) + ",100% { opacity: 0 } }",
    "@keyframes cbStamp { 0%," + pc(RAR_T[RAR_T.length - 1]) + " { transform: scale(1) } " + pc(RAR_T[RAR_T.length - 1] + 120) + " { transform: scale(1.25) } " + pc(RAR_T[RAR_T.length - 1] + 400) + ",100% { transform: scale(1) } }",
    "@keyframes cbLand { 0%," + pc(T_LAND) + " { transform: scale(1) } " + pc(T_LAND + 150) + " { transform: scale(1.08) } " + pc(T_LAND + 500) + "," + pc(T_LAND + 600) + " { transform: scale(1); opacity: 1 } " + pc(T_LAND + 750) + ",100% { transform: scale(1.1); opacity: 0 } }", // then it flies out to the middle of the game (death screen)
    "@keyframes cbBurst { 0%," + pc(T_LAND) + " { opacity: 0; transform: scale(.6) } " + pc(T_LAND + 120) + " { opacity: 1 } " + pc(T_LAND + 900) + ",100% { opacity: 0; transform: scale(1.8) } }",
    "@keyframes cbH1 { 0%," + pc(T_SCAV + 500) + " { opacity: 0 } " + pc(T_SCAV + 900) + "," + pc(T_RND - 200) + " { opacity: 1 } " + pc(T_RND) + ",100% { opacity: 0 } }",
    "@keyframes cbH2 { 0%," + pc(T_RND) + " { opacity: 0 } " + pc(T_RND + 300) + "," + pc(T_LAND) + " { opacity: 1 } " + pc(T_LAND + 150) + ",100% { opacity: 0 } }",
    rollKeys,
    "@keyframes cbSpore { 0% { opacity: 0; transform: translateY(0) } 20% { opacity: 1 } 100% { opacity: 0; transform: translateY(-160px) } }",
  ].join("\n");

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", borderRadius: 12,
      fontFamily: "'Barlow Condensed', sans-serif", textAlign: "center" }}>
      <style>{styleContent}</style>
      {/* Decode the execution's images while the card waits, so nothing blinks when the axe starts. */}
      {!rot && (
        <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 2, height: 2, overflow: "hidden", opacity: 0.01, pointerEvents: "none" }}>
          {[AXE_IMG, STUMP_IMG, STUMP_ROT_IMG, TRAIL_IMG, ROT_FRAMES_IMG, image].filter(Boolean).map((u) => (
            <img key={u} src={u} alt="" style={{ width: 2, height: 2 }} />
          ))}
        </div>
      )}

      {/* The block with the axe in it. In a Death Run the axe leaves (bare stump), then the stump rots. */}
      <img src={BLOCK_IMG} alt="" style={{ ...blockImg, animation: rot ? "cbBlockOut " + ROT_MS + "ms linear both" : "none" }} />
      {rot && <img src={STUMP_IMG} alt="" style={{ ...blockImg, animation: "cbStumpIn " + ROT_MS + "ms linear both" }} />}
      {rot && (
        <div style={{ position: "absolute", left: 0, bottom: 0, width: STUMP_W, height: STUMP_H }}>
          <RotSpread src={STUMP_ROT_IMG} w={STUMP_W} h={STUMP_H} delay={3700} dur={2800} seed={3} clock={axeRef}
            from={{ x: 250, y: 416 }} />
        </div>
      )}

      {/* Heading, name and sentence */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 3,
        animation: rot && newName ? "cbHdrOut " + ROT_MS + "ms linear both" : "none" }}>
        <div style={{ ...(rot || wait ? purpleText(32) : goldText(32)), letterSpacing: 3, whiteSpace: "nowrap" }}>
          {rot ? "THE BLADE FALLS" : wait ? "DEATH RUN" : "ON THE CHOPPING BLOCK"}
        </div>
        {!rot && !wait && recapture && <div style={{ ...purpleText(22), letterSpacing: 3 }}>THE EXECUTIONER REMEMBERS</div>}
        <div style={{ ...goldText(30), lineHeight: 1, maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(name || "").toUpperCase()}</div>
        {rot || wait ? (
          <div style={{ ...steelText(24) }}>{wait ? "THE BLADE IS RAISED…" : "THE CONDEMNED CARD ROTS"}</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ ...(last ? purpleText(24) : steelText(24)) }}>
              {last ? "ONE DAY FROM FREEDOM" : "DAY " + day + " OF " + sentence}
            </div>
            {Array.from({ length: sentence }).map((_, i) => (
              <div key={i} style={{ width: 30, height: 12, borderRadius: 6, border: "2px solid #c9a8ff",
                background: i < day - 1 ? "#c9a8ff" : i === day - 1 ? "rgba(201,168,255,.45)" : "transparent" }} />
            ))}
          </div>
        )}
      </div>

      {rot && newImage && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 3,
            animation: "cbH1 " + ROT_MS + "ms linear both" }}>
            <div style={{ ...goldText(32), letterSpacing: 3 }}>THE RARITY ROLL</div>
            <div style={{ ...steelText(24) }}>COMMON OR UNCOMMON?</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 3,
            animation: "cbH2 " + ROT_MS + "ms linear both" }}>
            <div style={{ ...goldText(32), letterSpacing: 3 }}>SCAVENGING…</div>
            {rar && <div style={{ ...steelText(24), color: rar.color }}>{"AN " + rar.label + " RISES FROM THE ROT"}</div>}
          </div>
        </>
      )}

      {rot && newName && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 3,
          animation: "cbHdrIn " + ROT_MS + "ms linear both" }}>
          <div style={{ ...goldText(32), letterSpacing: 3, whiteSpace: "nowrap" }}>SCAVENGED</div>
          <div style={{ ...goldText(30), lineHeight: 1, maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{newName.toUpperCase()}</div>
          <div style={{ ...steelText(24) }}>{rar ? "AN " + rar.label + " JOINS THE DECK" : "JOINS THE DECK"}</div>
        </div>
      )}

      {/* The condemned card, standing on the block */}
      <div style={{ position: "absolute", left: "50%", bottom: CARD_BOTTOM, width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2,
        animation: rot ? "cbShake " + ROT_MS + "ms linear both" : "none" }}>
        {!rot && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 13, overflow: "hidden", animation: "cbGlow 2.4s ease-in-out infinite" }}>
            {image && <img src={image} alt={name} style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />}
          </div>
        )}
        {rot && <Half image={image} clip={CUT_TOP} seed={1} anim="cbTop" clock={axeRef} />}
        {rot && <Half image={image} clip={CUT_BOTTOM} seed={2} anim="cbBottom" clock={axeRef} />}
      </div>

      {/* The executioner's axe. Drawn (invisibly) while the card waits, so it is ready the
          instant the execution starts: no blank moment while the browser draws its glow. */}
      {(rot || wait) && (
        <div ref={axeRef} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0", zIndex: 1,
          opacity: rot ? 1 : 0.01, transform: "translate(24px, 362px) rotate(-5deg) scale(0.134)",
          animation: rot ? "cbAxe " + ROT_MS + "ms linear both" : "none" }}>
          <img src={AXE_IMG} alt="" style={{ position: "absolute", left: -GRIP.x, top: -GRIP.y, width: AXE_W, height: "auto", maxWidth: "none",
            filter: "drop-shadow(0 0 30px rgba(150,80,255,.8)) drop-shadow(0 20px 30px #000)" }} />
        </div>
      )}
      {rot && (
        <>
          {/* The slash trail, right to left */}
          <img src={TRAIL_IMG} alt="" style={{ position: "absolute", left: 110, top: 110, width: 270, height: "auto", maxWidth: "none",
            mixBlendMode: "screen", animation: "cbTrail " + ROT_MS + "ms ease-out both" }} />
          {/* The fungal mass grows from the cut, in front of the axe, with the curled card inside it */}
          <div style={{ position: "absolute", left: 226 - FRAME_W / 2, top: 80, width: FRAME_W, height: FRAME_H,
            transformOrigin: "50% 100%", animation: "cbMass " + ROT_MS + "ms ease-out both" }}>
            {FRAME_TIMES.map((_, i) => (
              <div key={i} style={{ position: "absolute", inset: 0, opacity: 0,
                backgroundImage: "url(" + ROT_FRAMES_IMG + ")", backgroundSize: (FRAME_W * FRAME_TIMES.length) + "px " + FRAME_H + "px",
                backgroundPosition: "-" + (i * FRAME_W) + "px 0", backgroundRepeat: "no-repeat",
                animation: "cbL" + i + " " + ROT_MS + "ms linear both" }} />
            ))}
          </div>
          {SPORES.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: p.x, top: p.y, width: p.s, height: p.s, borderRadius: "50%",
              background: "#d4baff", boxShadow: "0 0 8px 2px rgba(150,90,255,.9)", opacity: 0,
              animation: "cbSpore 3s ease-out " + p.d + "ms infinite" }} />
          ))}
          {/* The scavenge: rarity roll, then the randomiser, inside the card's outline */}
          {newImage && (
            <div style={{ position: "absolute", left: "50%", bottom: CARD_BOTTOM, width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, zIndex: 2,
              animation: "cbLand " + ROT_MS + "ms ease-out both" }}>
              {/* the empty outline, glowing */}
              <div style={{ position: "absolute", inset: 0, borderRadius: 13, border: "3px solid #FFD38A", background: "rgba(10,6,18,.78)",
                boxShadow: "0 0 30px 6px rgba(255,170,60,.55), inset 0 0 30px rgba(150,80,255,.5)", animation: "cbSlot " + ROT_MS + "ms linear both" }} />
              {/* rarity roll */}
              {["common", "uncommon"].map((r, i) => (
                <div key={r} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0,
                  animation: "cbR" + i + " " + ROT_MS + "ms step-end both" }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 44, letterSpacing: 3,
                    color: RARITY[r].color, textShadow: "0 0 3px #000, 0 0 18px rgba(255,255,255,.35)",
                    animation: "cbStamp " + ROT_MS + "ms ease-out both" }}>{RARITY[r].label}</div>
                </div>
              ))}
              {/* randomiser: candidate cards flick through, slowing to the pick */}
              {rollSeq.map((src, i) => (
                <div key={i} style={{ position: "absolute", inset: 0, borderRadius: 13, overflow: "hidden", opacity: 0,
                  animation: "cbC" + i + " " + ROT_MS + "ms step-end both" }}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", maxWidth: "none", display: "block" }} />
                </div>
              ))}
              {/* the landing: gold burst and glow */}
              <div style={{ position: "absolute", inset: -40, borderRadius: "50%", pointerEvents: "none",
                background: "radial-gradient(closest-side, rgba(255,236,200,.9), rgba(255,160,60,.5) 45%, transparent 75%)",
                mixBlendMode: "screen", animation: "cbBurst " + ROT_MS + "ms ease-out both" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: 13, pointerEvents: "none",
                animation: "cbGold 2.4s ease-in-out " + T_LAND + "ms infinite" }} />
            </div>
          )}
        </>
      )}

      {/* Preload the Death Run images so they're ready the instant it starts */}
      {!rot && [STUMP_IMG, STUMP_ROT_IMG, AXE_IMG, TRAIL_IMG, ROT_FRAMES_IMG].map((src) => (
        <img key={src} src={src} alt="" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      ))}

      {!rot && !wait && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, ...steelText(24), textShadow: "0 0 3px #000, 0 2px 6px #000, 0 0 14px #000" }}>
          LOSE TODAY, AND IT ROTS.
        </div>
      )}
    </div>
  );
}