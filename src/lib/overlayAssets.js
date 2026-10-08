// Public asset URLs for the IronDeck deck-intro overlay.
const DPRE =
  "https://base44.app/api/apps/6ac605d777721f9149c6b225/files/mp/public/6ac605d777721f9149c6b225/";

export const INTRO_BG = `${DPRE}b734cc291_deck-intro-bg.jpg`;

export const TILE_FRAME = {
  rot: `${DPRE}afa33370b_tileframe-rot.png`,
  scavenged: `${DPRE}fd83c9b4b_tileframe-scavenged.png`,
  steel: `${DPRE}8d3cc6f6a_tileframe-steel.png`,
};

// Shared page background: the intro artwork darkened for legibility.
export const INTRO_BG_STYLE = `linear-gradient(rgba(13,16,22,0.72), rgba(13,16,22,0.72)), url('${INTRO_BG}') center/cover no-repeat, #0d1016`;