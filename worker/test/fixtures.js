// Données simulées au format réel de chaque fournisseur.

const team = (id, name, shortName) => ({ id, name, shortName, tla: shortName.slice(0, 3).toUpperCase() });
export const PSG = team(524, "Paris Saint-Germain FC", "PSG");
export const LILLE = team(521, "Lille OSC", "Lille");
export const PFC = team(1045, "Paris FC", "Paris FC");
export const OM = team(516, "Olympique de Marseille", "Marseille");
export const LENS = team(546, "Racing Club de Lens", "RC Lens");
export const CHELSEA = team(61, "Chelsea FC", "Chelsea");
export const ARSENAL = team(57, "Arsenal FC", "Arsenal");
export const BAYERN = team(5, "FC Bayern München", "Bayern");
export const BVB = team(4, "Borussia Dortmund", "Dortmund");

const row = (position, t, points, playedGames, goalsFor = 20, goalsAgainst = 10) =>
  ({ position, team: t, playedGames, points, goalsFor, goalsAgainst });
const standings = rows => ({ season: { currentMatchday: 11 }, standings: [{ type: "TOTAL", table: rows }] });
const scorer = (name, firstName, lastName, t, goals, playedMatches) =>
  ({ player: { name, firstName, lastName }, team: t, goals, playedMatches });

export const FD = {
  "/competitions/FL1/standings": standings([row(1, PSG, 23, 10, 22, 10), row(2, LILLE, 21, 10), row(3, PFC, 20, 10),
    row(4, OM, 18, 10), row(5, LENS, 17, 10)]),
  "/competitions/PL/standings": standings([row(1, ARSENAL, 27, 11), row(2, CHELSEA, 24, 11)]),
  "/competitions/PD/standings": standings([row(1, team(81, "FC Barcelona", "Barça"), 33, 13)]),
  "/competitions/SA/standings": standings([row(1, team(110, "SS Lazio", "Lazio"), 29, 12)]),
  "/competitions/BL1/standings": standings([row(1, BAYERN, 21, 9), row(2, BVB, 21, 9)]),
  "/competitions/PL/scorers?limit=100": { scorers: [
    scorer("Erling Haaland", "Erling", "Haaland", team(65, "Manchester City FC", "Man City"), 12, 11),
    scorer("João Pedro", "João Pedro", "Junqueira de Jesus", CHELSEA, 7, 11)] },
  "/competitions/CL/scorers?limit=100": { scorers: [scorer("João Pedro", "João Pedro", "Junqueira de Jesus", CHELSEA, 3, 4)] },
  "/competitions/BL1/scorers?limit=100": { scorers: [scorer("Niclas Füllkrug", "Niclas", "Füllkrug", BVB, 9, 9)] },
  "/competitions/FL1/scorers?limit=100": { scorers: [scorer("Mason Greenwood", "Mason", "Greenwood", OM, 8, 10)] },
};
export const FD_MATCHES_FL1 = { matches: [
  { utcDate: "2026-11-09T20:45:00Z", status: "FINISHED", matchday: 11, homeTeam: PSG, awayTeam: LENS, score: { fullTime: { home: 3, away: 1 } } },
  { utcDate: "2026-11-22T20:00:00Z", status: "TIMED", matchday: 12, homeTeam: OM, awayTeam: PSG, score: { fullTime: { home: null, away: null } } },
  { utcDate: "2026-11-29T16:00:00Z", status: "SCHEDULED", matchday: 13, homeTeam: PSG, awayTeam: LILLE, score: { fullTime: { home: null, away: null } } },
] };
export const TSDB_FL1 = { table: [
  { intRank: "1", strTeam: "Paris Saint-Germain", intPlayed: "10", intPoints: "23", dateUpdated: "2026-11-10 05:01:02" },
  { intRank: "2", strTeam: "Lille", intPlayed: "10", intPoints: "21", dateUpdated: "2026-11-10 05:01:02" },
  { intRank: "3", strTeam: "Paris FC", intPlayed: "10", intPoints: "20", dateUpdated: "2026-11-10 05:01:02" },
  { intRank: "4", strTeam: "Marseille", intPlayed: "10", intPoints: "18", dateUpdated: "2026-11-10 05:01:02" },
  { intRank: "5", strTeam: "Lens", intPlayed: "10", intPoints: "17", dateUpdated: "2026-11-10 05:01:02" },
] };
export const OL_TABLE = [{ teamName: "FC Bayern München", shortName: "Bayern", points: 21, matches: 9 },
  { teamName: "Borussia Dortmund", shortName: "Dortmund", points: 21, matches: 9 }];
export const OL_GOALS = [{ goalGetterName: "N. Füllkrug", goalCount: 9 }];

// API-Football : saison en cours refusée par l'offre gratuite (réponse réelle du fournisseur).
export const AF_PLAN_ERROR = { errors: { plan: "Free plans do not have access to this season, try from 2022 to 2024." }, response: [] };
export const AF_PLAYERS_CHELSEA = { errors: [], response: [{
  player: { name: "João Pedro", firstname: "João Pedro", lastname: "Junqueira de Jesus", nationality: "Brazil" },
  statistics: [
    { team: { name: "Chelsea" }, league: { name: "Premier League" }, games: { appearences: 11 }, goals: { total: 7 } },
    { team: { name: "Chelsea" }, league: { name: "UEFA Champions League" }, games: { appearences: 4 }, goals: { total: 3 } },
    { team: { name: "Chelsea" }, league: { name: "League Cup" }, games: { appearences: 2 }, goals: { total: 1 } },
  ],
}] };

export const WIKI_SEARCH = { query: { search: [{ title: "Kylian Mbappé" }, { title: "Ethan Mbappé" }] } };
export const WIKI_SUMMARY = {
  type: "standard", title: "Kylian Mbappé", description: "footballeur international français",
  extract: "Kylian Mbappé, né le 20 décembre 1998 à Paris, est un footballeur international français qui évolue au poste d'attaquant. Il est formé à l'AS Monaco.",
  content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Kylian_Mbapp%C3%A9" } }, timestamp: "2026-11-12T08:00:00Z",
};

export const AF_STANDINGS_PL = { errors: [], response: [{ league: { standings: [[
  { rank: 1, team: { name: "Arsenal" }, points: 27, all: { played: 11, goals: { for: 20, against: 10 } } },
  { rank: 2, team: { name: "Chelsea" }, points: 24, all: { played: 11, goals: { for: 20, against: 10 } } },
]] } }] };
