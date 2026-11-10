/* =========================================================
   LIGUE 1 – enregistrement dans le registre des championnats
   Les données elles-mêmes sont dans js/data.js,
   js/lineups-data.js et js/players-data.js.
   ========================================================= */

// Surnoms reconnus par le chatbot
const LIGUE1_ALIASES = {
  PSG: ["psg", "paris sg", "paris saint germain", "parisiens", "paris"],
  OM: ["om", "olympique de marseille", "marseillais"],
  OL: ["ol", "olympique lyonnais", "lyonnais"],
  LIL: ["losc", "lillois"],
  ASM: ["asm", "monegasques"],
  RCL: ["rcl", "lensois", "sang et or"],
  RCS: ["rcsa", "strasbourgeois"],
  SCO: ["sco", "angevins"],
  NIC: ["ogcn", "nicois"],
  REN: ["srfc", "rennais"],
  TFC: ["tfc", "toulousains", "tef"],
  AJA: ["aja", "auxerrois"],
  PFC: ["pfc"],
  HAC: ["hac", "havrais", "havre"],
  EST: ["estac", "troyens"],
  LOR: ["fcl", "merlus", "lorientais"],
  LMF: ["manceaux", "lmfc"],
  BRE: ["sb29", "brestois"],
};

registerLeague({
  id: "L1",
  name: "Ligue 1",
  short: "Ligue 1",
  flag: "🇫🇷",
  country: "France",
  apiCode: "FL1",
  zones: { releg: 2, barrage: 1 },
  info: { ...DATA_INFO, label: `après la ${DATA_INFO.updatedAfterDay}e journée (08/11/2026)` },
  teams: TEAMS.map(t => ({ ...t, aliases: LIGUE1_ALIASES[t.id] || [] })),
  standings: STANDINGS,
  upcoming: UPCOMING,
  lineups: SAVED_LINEUPS_RAW,
  lineupsInfo: SAVED_LINEUPS_INFO,
  players: PLAYERS,
  playersInfo: PLAYER_STATS_INFO,
});
