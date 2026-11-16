// Couche unique de normalisation : chaque fournisseur est converti dans le
// même format, quel que soit son schéma d'origine.
//
//   Équipe classée  : { position, team, played, points, goalsFor, goalsAgainst }
//   Buteur          : { player, firstName, lastName, team, goals, matches }
//   Match           : { date, status: "finished"|"scheduled"|"live", matchday, home, away, homeGoals, awayGoals }
//   Saison joueur   : { player, team, competitions: [{ name, goals, matches }] }

import { norm } from "./text.js";

const int = v => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const label = team => (team && (team.shortName || team.name)) || "?";

// ---------------------------------------------------------- football-data.org
export function fdStandings(json) {
  const table = (json?.standings || []).find(s => s.type === "TOTAL")?.table || [];
  return table.map(r => ({
    position: int(r.position), team: label(r.team), teamFull: r.team?.name || label(r.team), teamId: r.team?.id,
    played: int(r.playedGames), points: int(r.points), goalsFor: int(r.goalsFor), goalsAgainst: int(r.goalsAgainst),
  }));
}

export function fdScorers(json) {
  return (json?.scorers || []).map(s => ({
    player: s.player?.name || "?", firstName: s.player?.firstName || "", lastName: s.player?.lastName || "",
    team: label(s.team), teamFull: s.team?.name || label(s.team), goals: int(s.goals), matches: int(s.playedMatches),
  }));
}

const FD_STATUS = { FINISHED: "finished", AWARDED: "finished", IN_PLAY: "live", PAUSED: "live", LIVE: "live",
  SCHEDULED: "scheduled", TIMED: "scheduled" };

export function fdMatches(json) {
  return (json?.matches || []).map(m => ({
    date: m.utcDate, status: FD_STATUS[m.status] || "other", timeConfirmed: m.status !== "SCHEDULED",
    matchday: int(m.matchday), home: label(m.homeTeam), away: label(m.awayTeam),
    homeFull: m.homeTeam?.name, awayFull: m.awayTeam?.name,
    homeGoals: int(m.score?.fullTime?.home), awayGoals: int(m.score?.fullTime?.away),
  }));
}

// ---------------------------------------------------------------- API-Football
export function afErrors(json) {
  const errors = json?.errors;
  if (!errors) return null;
  if (Array.isArray(errors)) return errors.length ? { other: errors.join(" ") } : null;
  return Object.keys(errors).length ? errors : null;
}

export function afStandings(json) {
  const groups = json?.response?.[0]?.league?.standings || [];
  return (groups[0] || []).map(r => ({
    position: int(r.rank), team: r.team?.name || "?", teamFull: r.team?.name || "?", teamId: r.team?.id,
    played: int(r.all?.played), points: int(r.points), goalsFor: int(r.all?.goals?.for),
    goalsAgainst: int(r.all?.goals?.against),
  }));
}

export function afTopScorers(json) {
  return (json?.response || []).map(p => {
    const st = p.statistics?.[0] || {};
    return {
      player: p.player?.name || "?", firstName: p.player?.firstname || "", lastName: p.player?.lastname || "",
      team: st.team?.name || "?", teamFull: st.team?.name || "?", goals: int(st.goals?.total),
      matches: int(st.games?.appearences),
    };
  });
}

export function afPlayers(json) {
  return (json?.response || []).map(p => ({
    player: p.player?.name || "?", firstName: p.player?.firstname || "", lastName: p.player?.lastname || "",
    nationality: p.player?.nationality || "",
    competitions: (p.statistics || []).map(s => ({
      name: s.league?.name || "?", team: s.team?.name || "?", goals: int(s.goals?.total) ?? 0,
      matches: int(s.games?.appearences) ?? 0,
    })),
  }));
}

export function afFixtures(json) {
  const status = s => (["FT", "AET", "PEN", "AWD", "WO"].includes(s) ? "finished"
    : ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(s) ? "live" : "scheduled");
  return (json?.response || []).map(f => ({
    date: f.fixture?.date, status: status(f.fixture?.status?.short), timeConfirmed: f.fixture?.status?.short !== "TBD",
    matchday: int(String(f.league?.round || "").match(/\d+/)?.[0]), home: f.teams?.home?.name, away: f.teams?.away?.name,
    homeFull: f.teams?.home?.name, awayFull: f.teams?.away?.name, homeGoals: int(f.goals?.home), awayGoals: int(f.goals?.away),
    competition: f.league?.name,
  }));
}

// ----------------------------------------------------------------- TheSportsDB
export function tsdbTable(json) {
  return (json?.table || []).map(r => ({
    position: int(r.intRank), team: r.strTeam, teamFull: r.strTeam, played: int(r.intPlayed),
    points: int(r.intPoints), goalsFor: int(r.intGoalsFor), goalsAgainst: int(r.intGoalsAgainst),
    updated: r.dateUpdated || null,
  }));
}

// ------------------------------------------------------------------ OpenLigaDB
export function olTable(json) {
  return (Array.isArray(json) ? json : []).map((r, i) => ({
    position: i + 1, team: r.shortName || r.teamName, teamFull: r.teamName, played: int(r.matches),
    points: int(r.points), goalsFor: int(r.goals), goalsAgainst: int(r.opponentGoals),
  }));
}

export function olScorers(json) {
  return (Array.isArray(json) ? json : []).map(g => ({
    player: g.goalGetterName, firstName: "", lastName: String(g.goalGetterName || "").split(" ").pop(),
    team: null, teamFull: null, goals: int(g.goalCount), matches: null,
  }));
}

// ------------------------------------------------------------------ Wikipédia
export function wikiSummary(json) {
  if (!json || json.type === "disambiguation" || !json.extract) return null;
  return {
    title: json.title, description: json.description || "", extract: String(json.extract),
    url: json.content_urls?.desktop?.page || null, updated: json.timestamp || null,
  };
}

// ---------------------------------------------- rapprochement entre fournisseurs
const GENERIC = new Set(["fc", "cf", "ac", "as", "sc", "ssc", "afc", "rc", "ogc", "club", "de", "del", "la", "le",
  "les", "football", "olympique", "sporting", "stade", "ss", "us", "vfb", "vfl", "tsg", "sv", "1", "bc", "calcio",
  "cd", "ud", "rcd", "ca", "osc", "hsc", "aj", "ea", "fk", "the", "racing"]);
const SYNONYMS = { munchen: "munich", koln: "cologne", monchengladbach: "gladbach", internazionale: "inter",
  barca: "barcelona", milano: "milan" };

export function distinctive(name) {
  return new Set(norm(name).split(" ").map(w => SYNONYMS[w] || w).filter(w => w && !GENERIC.has(w)));
}

/** Trouve la même équipe chez un autre fournisseur (noms écrits différemment). */
export function matchTeam(name, rows) {
  const target = distinctive(name);
  const scored = [];
  for (const row of rows) {
    const other = new Set([...distinctive(row.teamFull || ""), ...distinctive(row.team || "")]);
    const inter = [...target].filter(w => other.has(w)).length;
    if (!target.size || !other.size || !inter) continue;
    const union = new Set([...target, ...other]).size;
    scored.push({ jaccard: inter / union, overlap: inter / Math.min(target.size, other.size), row });
  }
  scored.sort((a, b) => b.jaccard - a.jaccard);
  // Seuil strict : « Paris FC » ne doit pas être pris pour le PSG, ni l'AC Milan pour l'Inter.
  if (!scored.length || scored[0].jaccard <= 0.5) return null;
  if (scored.length > 1 && scored[0].jaccard === scored[1].jaccard) return null;
  return scored[0].row;
}

/** Même joueur ? Tous les mots de la recherche doivent figurer dans son nom. */
export function nameMatches(query, player) {
  const words = norm(query).split(" ").filter(w => w.length > 1);
  const full = new Set(norm([player.player, player.firstName, player.lastName].join(" ")).split(" "));
  return words.length > 0 && words.every(w => full.has(w));
}

export function sameTeam(a, b) {
  if (!a || !b) return false;
  return Boolean(matchTeam(a, [{ team: b, teamFull: b }]));
}
