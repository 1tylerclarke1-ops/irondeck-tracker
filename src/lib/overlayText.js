const FONT_CINZEL = '"Cinzel", serif';
const FONT_CINZEL_DEC = '"Cinzel Decorative", serif';

export const goldText = (fontSize) => ({
  fontFamily: FONT_CINZEL,
  fontWeight: 900,
  fontSize,
  lineHeight: 1,
  background: "linear-gradient(180deg, #FFF0CD 0%, #D68C3C 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1.5px #1A120C",
  filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.8))",
});

export const steelText = (fontSize, dark = false) => ({
  fontFamily: FONT_CINZEL,
  fontWeight: 700,
  fontSize,
  lineHeight: 1,
  textTransform: "uppercase",
  letterSpacing: "1px",
  background: dark
    ? "linear-gradient(180deg, #787E88 0%, #5A606A 100%)"
    : "linear-gradient(180deg, #ECF0F6 0%, #8C94A0 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1.5px #1A120C",
  filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.8))",
});

export const irondeckText = (fontSize) => ({
  fontFamily: FONT_CINZEL_DEC,
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

export const purpleText = (fontSize) => ({
  fontFamily: FONT_CINZEL,
  fontWeight: 900,
  fontSize,
  lineHeight: 1,
  background: "linear-gradient(180deg, #E8E0F8 0%, #B8A8D8 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "1px #2A2040",
  filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.8))",
});