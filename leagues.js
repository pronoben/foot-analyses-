/* =========================================================
   REGISTRE DES CHAMPIONNATS
   ---------------------------------------------------------
   Chaque championnat est déclaré dans js/leagues/*.js avec
   registerLeague({...}). setLeague(id) recopie ses données dans
   les variables globales utilisées par tout le site
   (TEAMS, STANDINGS, UPCOMING, SAVED_LINEUPS_RAW, PLAYERS…),
   ce qui permet de garder le même code pour tous les championnats.
   ========================================================= */

const LEAGUES = {};
const LEAGUE_ORDER = [];
let CURRENT_LEAGUE = null;

// --- Petits outils pour écrire les données de façon compacte ---

// "Nom:raison|Nom2:raison2" -> [["Nom","raison"], ...]
function parseAbsents(str) {
  if (!str) return [];
  return str.split("|").map(s => {
    const [n, why] = s.split(":");
    return [n.trim(), (why || "Absent").trim()];
  });
}

// Ligne de classement compacte -> objet
const standingRow = ([id, P, W, D, L, GF, GA, pts]) => ({ id, P, W, D, L, GF, GA, pts });

// Ligne de stats joueur compacte -> objet (même calcul que js/players-data.js)
function playerRow([name, team, goals, penalties, total, perMatch, per90]) {
  return {
    name, team, goals, penalties,
    assists: goals != null && total != null ? total - goals : null,
    total,
    matches: total && perMatch ? Math.round(total / perMatch) : null,
    minutes: total && per90 ? Math.round((total * 90) / per90 / 10) * 10 : null,
  };
}

/**
 * Déclare un championnat.
 * Champs : id, name, short, flag, country, apiCode (football-data.org),
 * info {season, label, updatedAfterDay?, updatedOn?}, zones {releg, barrage},
 * teams [{id, name, color, aliases}], standings, upcoming,
 * lineups {ID: {formation, lines, absents}}, lineupsInfo {source, note},
 * players [...], playersInfo {label, sources}
 */
function registerLeague(l) {
  // Les compos ont besoin de la liste des noms d'équipe (pour le mode « en direct »)
  Object.entries(l.lineups || {}).forEach(([id, raw]) => {
    const t = l.teams.find(x => x.id === id);
    raw.names = raw.names || (t ? [t.name, ...(t.aliases || [])] : [id]);
    if (typeof raw.absents === "string") raw.absents = parseAbsents(raw.absents);
  });
  l.upcoming = (l.upcoming || []).map(m => (Array.isArray(m)
    ? { day: m[0], date: m[1], time: m[2], home: m[3], away: m[4] } : m))
    .map(m => ({ ...m, id: m.id || `J${m.day}-${m.home}-${m.away}` }));
  l.standings = (l.standings || []).map(r => (Array.isArray(r) ? standingRow(r) : r));
  l.players = (l.players || []).map(p => (Array.isArray(p) ? playerRow(p) : p));
  l.zones = l.zones || { releg: 3, barrage: 0 };
  LEAGUES[l.id] = l;
  if (!LEAGUE_ORDER.includes(l.id)) LEAGUE_ORDER.push(l.id);
}

// Active un championnat : remplit les variables globales du site
function setLeague(id) {
  const l = LEAGUES[id];
  if (!l) return;
  CURRENT_LEAGUE = l;
  TEAMS = l.teams;
  STANDINGS = l.standings;
  UPCOMING = l.upcoming;
  DATA_INFO = l.info;
  SAVED_LINEUPS_RAW = l.lineups;
  SAVED_LINEUPS_INFO = l.lineupsInfo;
  PLAYERS = l.players;
  PLAYER_STATS_INFO = l.playersInfo;
}
