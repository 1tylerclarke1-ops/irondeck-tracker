// Text styles for every OBS overlay (HUD, death screen, deck intro, deck page).
// Barlow Condensed with solid colours and a dark outline + shadow, so it stays
// readable over busy card art. The IRONDECK logo keeps Cinzel Decorative.

const FONT_TEXT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const FONT_LOGO = '"Cinzel Decorative", serif';
const SIZE = 1.15; // Barlow is narrower than the old font, so it can be a touch bigger

// Load Barlow Condensed once, whichever overlay page uses these styles.
if (typeof document !== "undefined" && !document.getElementById("irondeck-font")) {
  const link = document.createElement("link");
  link.id = "irondeck-font";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap";
  document.head.appendChild(link);
}

// Dark outline behind the letters plus a soft drop shadow.
const OUTLINE =
  "0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 0 #000, 0 3px 6px rgba(0,0,0,0.95)";

const solid = (fontSize, color, fontWeight, extra = {}) => ({
  fontFamily: FONT_TEXT,
  fontWeight,
  fontSize: typeof fontSize === "number" ? Math.round(fontSize * SIZE) : fontSize,
  lineHeight: 1,
  letterSpacing: "1px",
  color,
  textShadow: OUTLINE,
  ...extra,
});

export const goldText = (fontSize) => solid(fontSize, "#FFCF7A", 800);

export const steelText = (fontSize, dark = false) =>
  solid(fontSize, dark ? "#A3ABB7" : "#F1F4F8", 700, { textTransform: "uppercase" });

export const purpleText = (fontSize) => solid(fontSize, "#E4D9FB", 800);

export const irondeckText = (fontSize) => ({
  fontFamily: FONT_LOGO,
  fontWeight: 900,
  fontSize,
  lineHeight: 1,
  background: "linear-gradient(180deg, #FFC896 0%, #C85A28 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1.5px #1A120C",
  filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.8))",
});