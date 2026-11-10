/* =========================================================
   DONNÉES RÉELLES – LIGUE 1 2026-2027
   ---------------------------------------------------------
   Classement : après la 10e journée (matchs du 8 novembre 2026)
     Source : https://en.wikipedia.org/wiki/2026%E2%80%9327_Ligue_1
   Calendrier 11e journée (20-22 novembre 2026)
     Sources : foot-actu.com, footmercato.net, ouest-france.fr
   ⚠️ Les horaires peuvent être modifiés par la LFP (diffusion TV).
   Pour mettre à jour : modifier STANDINGS et UPCOMING ci-dessous
   (ou les remplacer plus tard par un appel à une API).
   ========================================================= */

let DATA_INFO = {
  season: "2026-2027",
  updatedAfterDay: 10,
  updatedOn: "2026-11-08",
};

let TEAMS = [
  { id: "PSG", name: "Paris Saint-Germain", color: "#1e3a8a" },
  { id: "LIL", name: "Lille",               color: "#dc2626" },
  { id: "PFC", name: "Paris FC",            color: "#60a5fa" },
  { id: "OM",  name: "Marseille",           color: "#38bdf8" },
  { id: "OL",  name: "Lyon",                color: "#e5e7eb" },
  { id: "NIC", name: "Nice",                color: "#b91c1c" },
  { id: "ASM", name: "Monaco",              color: "#ef4444" },
  { id: "REN", name: "Rennes",              color: "#991b1b" },
  { id: "BRE", name: "Brest",               color: "#f43f5e" },
  { id: "LOR", name: "Lorient",             color: "#f97316" },
  { id: "RCL", name: "Lens",                color: "#facc15" },
  { id: "TFC", name: "Toulouse",            color: "#a855f7" },
  { id: "RCS", name: "Strasbourg",          color: "#2563eb" },
  { id: "AJA", name: "Auxerre",             color: "#93c5fd" },
  { id: "LMF", name: "Le Mans",             color: "#fb7185" },
  { id: "SCO", name: "Angers",              color: "#a3a3a3" },
  { id: "EST", name: "Troyes",              color: "#3b82f6" },
  { id: "HAC", name: "Le Havre",            color: "#7dd3fc" },
];

// Classement après la 10e journée
// P = joués, W = victoires, D = nuls, L = défaites, GF = buts pour, GA = buts contre
let STANDINGS = [
  { id: "PSG", P: 10, W: 7, D: 2, L: 1, GF: 22, GA: 10, pts: 23 },
  { id: "LIL", P: 10, W: 6, D: 3, L: 1, GF: 14, GA: 7,  pts: 21 },
  { id: "PFC", P: 10, W: 6, D: 2, L: 2, GF: 17, GA: 10, pts: 20 },
  { id: "OM",  P: 10, W: 6, D: 0, L: 4, GF: 22, GA: 14, pts: 18 },
  { id: "OL",  P: 10, W: 5, D: 2, L: 3, GF: 15, GA: 9,  pts: 17 },
  { id: "NIC", P: 10, W: 5, D: 2, L: 3, GF: 15, GA: 12, pts: 17 },
  { id: "ASM", P: 10, W: 4, D: 4, L: 2, GF: 13, GA: 11, pts: 16 },
  { id: "REN", P: 10, W: 5, D: 1, L: 4, GF: 21, GA: 21, pts: 16 },
  { id: "BRE", P: 10, W: 4, D: 3, L: 3, GF: 18, GA: 12, pts: 15 },
  { id: "LOR", P: 10, W: 4, D: 3, L: 3, GF: 9,  GA: 8,  pts: 15 },
  { id: "RCL", P: 10, W: 4, D: 1, L: 5, GF: 17, GA: 15, pts: 13 },
  { id: "TFC", P: 10, W: 3, D: 4, L: 3, GF: 15, GA: 14, pts: 13 },
  { id: "RCS", P: 10, W: 3, D: 1, L: 6, GF: 18, GA: 22, pts: 10 },
  { id: "AJA", P: 10, W: 3, D: 1, L: 6, GF: 13, GA: 24, pts: 10 },
  { id: "LMF", P: 10, W: 1, D: 5, L: 4, GF: 12, GA: 19, pts: 8 },
  { id: "SCO", P: 10, W: 2, D: 2, L: 6, GF: 9,  GA: 19, pts: 8 },
  { id: "EST", P: 10, W: 2, D: 2, L: 6, GF: 7,  GA: 17, pts: 8 },
  { id: "HAC", P: 10, W: 0, D: 2, L: 8, GF: 9,  GA: 22, pts: 2 },
];

// Prochains matchs : 11e journée
let UPCOMING = [
  { day: 11, date: "2026-11-20", time: "20:45", home: "EST", away: "HAC" },
  { day: 11, date: "2026-11-21", time: "17:15", home: "NIC", away: "PSG" },
  { day: 11, date: "2026-11-21", time: "20:45", home: "LIL", away: "OL"  },
  { day: 11, date: "2026-11-21", time: "20:45", home: "ASM", away: "AJA" },
  { day: 11, date: "2026-11-21", time: "20:45", home: "RCS", away: "BRE" },
  { day: 11, date: "2026-11-21", time: "20:45", home: "RCL", away: "TFC" },
  { day: 11, date: "2026-11-22", time: "15:00", home: "PFC", away: "SCO" },
  { day: 11, date: "2026-11-22", time: "17:15", home: "LOR", away: "REN" },
  { day: 11, date: "2026-11-22", time: "20:45", home: "OM",  away: "LMF" },
].map(m => ({ ...m, id: `J${m.day}-${m.home}-${m.away}` }));
