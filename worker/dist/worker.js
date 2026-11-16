// Fichier généré automatiquement depuis worker/src (npm run build). À coller tel quel dans l'éditeur Cloudflare. Ne pas modifier à la main.

// src/text.js
function norm(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`´\-_/.,;:!?()[\]«»"]/g, " ").replace(/\s+/g, " ").trim();
}
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hasPhrase(text, phrase) {
  if (!phrase) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}($|[^a-z0-9])`).test(text);
}
function removePhrase(text, phrase) {
  return text.replace(new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}(?=$|[^a-z0-9])`, "g"), " ");
}
var TIME_ZONE = "Europe/Paris";
function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  const date = d.toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `${date} \xE0 ${time}`;
}
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  return d.toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}
function currentSeasonStart(now = /* @__PURE__ */ new Date()) {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}
function seasonLabel(start) {
  return `${start}-${start + 1}`;
}
function ordinal(n) {
  return n === 1 ? "1er" : `${n}e`;
}
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function displayName(raw, normalizedName) {
  const wanted = normalizedName.split(" ");
  const words = String(raw ?? "").match(/[^\s,;:!?«»"()]+/g) || [];
  for (let i = 0; i + wanted.length <= words.length; i++) {
    const slice = words.slice(i, i + wanted.length);
    if (slice.map(norm).join(" ") === normalizedName) return slice.join(" ");
  }
  return normalizedName.replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/intent.js
var LEAGUES = {
  FL1: { name: "Ligue 1", apiFootball: 61, tsdb: "4334", aliases: ["ligue 1", "ligue1", "l1", "championnat de france", "championnat francais"] },
  PL: { name: "Premier League", apiFootball: 39, tsdb: "4328", aliases: ["premier league", "epl", "championnat anglais", "championnat d angleterre"] },
  PD: { name: "Liga", apiFootball: 140, tsdb: "4335", aliases: ["liga", "la liga", "laliga", "championnat espagnol", "championnat d espagne"] },
  SA: { name: "Serie A", apiFootball: 135, tsdb: "4332", aliases: ["serie a", "calcio", "championnat italien", "championnat d italie"] },
  BL1: { name: "Bundesliga", apiFootball: 78, tsdb: "4331", openliga: "bl1", aliases: ["bundesliga", "championnat allemand", "championnat d allemagne"] }
};
var CHAMPIONS_LEAGUE = { code: "CL", name: "Ligue des champions", apiFootball: 2 };
var CL_ALIASES = ["ligue des champions", "champions league", "ldc", "c1", "ucl"];
var ALL_COMP_ALIASES = [
  "toutes competitions confondues",
  "toutes competitions",
  "toutes les competitions",
  "toutes compets",
  "tout compris",
  "au total",
  "all competitions"
];
var UNSUPPORTED = {
  "coupe de france": "la Coupe de France",
  "fa cup": "la FA Cup",
  "carabao": "la Carabao Cup",
  "league cup": "la League Cup",
  "copa del rey": "la Copa del Rey",
  "coupe du roi": "la Coupe du Roi",
  "coppa italia": "la Coppa Italia",
  "dfb pokal": "la DFB-Pokal",
  "europa league": "la Ligue Europa",
  "ligue europa": "la Ligue Europa",
  "c3": "la Ligue Europa",
  "conference league": "la Ligue Conf\xE9rence",
  "ligue conference": "la Ligue Conf\xE9rence",
  "c4": "la Ligue Conf\xE9rence",
  "coupe du monde": "la Coupe du monde",
  "mondial des clubs": "la Coupe du monde des clubs",
  "equipe de france": "les matchs en s\xE9lection",
  "selection nationale": "les matchs en s\xE9lection"
};
var TEAM_NICKNAMES = {
  "psg": ["FL1", "paris saint germain"],
  "paris sg": ["FL1", "paris saint germain"],
  "paris saint germain": ["FL1", "paris saint germain"],
  "om": ["FL1", "marseille"],
  "ol": ["FL1", "lyon"],
  "losc": ["FL1", "lille"],
  "asse": ["FL1", "etienne"],
  "barca": ["PD", "barcelona"],
  "barcelone": ["PD", "barcelona"],
  "real madrid": ["PD", "real madrid"],
  "real": ["PD", "real madrid"],
  "atletico": ["PD", "atletico"],
  "atleti": ["PD", "atletico"],
  "seville": ["PD", "sevilla"],
  "man city": ["PL", "manchester city"],
  "manchester city": ["PL", "manchester city"],
  "man united": ["PL", "manchester united"],
  "man utd": ["PL", "manchester united"],
  "manchester united": ["PL", "manchester united"],
  "spurs": ["PL", "tottenham"],
  "bayern": ["BL1", "bayern"],
  "bayern munich": ["BL1", "bayern"],
  "bvb": ["BL1", "dortmund"],
  "dortmund": ["BL1", "dortmund"],
  "leverkusen": ["BL1", "leverkusen"],
  "leipzig": ["BL1", "leipzig"],
  "juve": ["SA", "juventus"],
  "juventus": ["SA", "juventus"],
  "inter": ["SA", "inter"],
  "inter milan": ["SA", "inter"],
  "ac milan": ["SA", "milan"],
  "milan": ["SA", "milan"],
  "naples": ["SA", "napoli"],
  "napoli": ["SA", "napoli"],
  "as rome": ["SA", "roma"],
  "rome": ["SA", "roma"],
  "lazio": ["SA", "lazio"]
};
var STOPWORDS = new Set(`
a ai as au aux avec avait avoir c ca ce ces cet cette ceux chez combien comme d dans de des du deja depuis
donc donne donner dit dis elle en encore est et etre eu il ils j je jusqu l la le les leur lui m ma mais me
mes moi mon n ne ni nombre nous on ont ou par pas pendant peux peut plus pour pourrais quand que quel quelle
quelles quels qui sa sans se ses si son sont sur t ta te tes toi ton tous tout toute toutes tu un une vos
votre vous y svp stp merci bonjour salut hello please what how many goals goal scored has have is the in of
for this season much but buts marque marques marquee marquees inscrit inscrits score scores saison saisons
cours actuelle actuel annee competition competitions confondues compets total verifie verifier verifiez
sources source deux moins recentes recente recent fiable fiables championnat match matchs joue joues jouer
joueur joueurs attaquant milieu defenseur gardien club actuellement maintenant aujourd hui dernier derniere
prochain prochaine classe classement disputes dispute rencontres rencontre apparitions titularisations
`.split(/\s+/).filter(Boolean));
var SECRET_PATTERNS = [
  /\bcles? (api|secretes?|d acces|d api|privees?|anthropic|groq|turnstile|football data|api football|du serveur|de l api|du site|du worker)\b/,
  /\bapi ?keys?\b/,
  /\b(token|tokens|jeton|jetons)\b/,
  /\bmots? de passe\b/,
  /\bpasswords?\b/,
  /\b(code|valeur|information|donnee)s? secret/,
  /\bsecrets? (du|de l|des|de la) (serveur|site|api|application|worker)\b/,
  /(^| )env( |$)/,
  /\bvariables? d environnement\b/,
  /\benvironment variables?\b/,
  /\bsystem prompt\b/,
  /\bprompt systeme\b/,
  /\btes (instructions|consignes|regles internes)\b/,
  /\b(ignore|oublie)\w* (les|tes|toutes|vos|previous|all|your)\b/,
  /\b(football data key|api football key|turnstile secret key|anthropic api key)\b/
];
var PREDICTION = [
  " pronostic",
  " prono ",
  "qui va gagner",
  " va gagner",
  " gagnera ",
  " prediction",
  " predire ",
  " parier ",
  " pari ",
  " paris sportif"
];
var RULE_WORDS = [
  "regle",
  "regles",
  "hors jeu",
  "penalty",
  "penalties",
  "carton rouge",
  "carton jaune",
  "duree d un match",
  "combien de temps dure",
  "combien de joueurs",
  "but valable",
  "arbitre",
  "ifab",
  "loi du jeu",
  "lois du jeu",
  "mi temps",
  "remplacant",
  "remplacants"
];
var INFO_WORDS = [
  "qui est",
  "c est qui",
  "c est quoi",
  "presente moi",
  "presente",
  "parle moi de",
  "informations sur",
  "infos sur",
  "histoire de",
  "histoire du",
  "fondation",
  "fonde",
  "stade de",
  "palmares"
];
function detectIntent(t) {
  const padded = ` ${t} `;
  if (SECRET_PATTERNS.some((re) => re.test(t))) return "secret";
  if (PREDICTION.some((w) => padded.includes(w))) return "prediction";
  if ([
    "meilleur buteur",
    "meilleurs buteurs",
    "top buteur",
    "top buteurs",
    "classement des buteurs",
    "top scorer",
    "top scorers",
    "qui a marque le plus"
  ].some((p) => hasPhrase(t, p))) return "top_scorers";
  if (["calendrier", "prochains matchs", "programme de", "fixtures"].some((p) => hasPhrase(t, p))) return "schedule";
  if ([
    "prochain match",
    "prochaine rencontre",
    "joue quand",
    "quand joue",
    "a quelle heure",
    "quelle heure",
    "quelle date",
    "next match",
    "coup d envoi"
  ].some((p) => hasPhrase(t, p))) return "next_match";
  if ([
    "dernier match",
    "dernier resultat",
    "derniere rencontre",
    "resultat du match",
    "score du match",
    "last match",
    "resultat de",
    "score de"
  ].some((p) => hasPhrase(t, p))) return "last_match";
  if (RULE_WORDS.some((p) => hasPhrase(t, p))) return "rules";
  if (/\bbuts?\b|\bgoals?\b/.test(t)) return "goals";
  if (/\b(combien de|nombre de) (matchs|matches|rencontres|apparitions)\b/.test(t)) return "appearances";
  if ([
    "classement",
    "premier du",
    "leader",
    "en tete",
    "position",
    "quelle place",
    "combien de points",
    "standings"
  ].some((p) => hasPhrase(t, p))) return "standings";
  if (INFO_WORDS.some((p) => hasPhrase(t, p))) return "info";
  if (hasPhrase(t, "score") || hasPhrase(t, "resultat")) return "last_match";
  return null;
}
function parseSeason(t, now = /* @__PURE__ */ new Date()) {
  const current = currentSeasonStart(now);
  if ([
    "cette saison",
    "saison en cours",
    "saison actuelle",
    "cette annee",
    "en ce moment",
    "actuellement",
    "this season"
  ].some((p) => hasPhrase(t, p))) return { season: "current", label: seasonLabel(current) };
  let m = t.match(/(?<!\d)(20\d{2}) (20\d{2}|\d{2})(?!\d)/);
  if (m) {
    const start = Number(m[1]);
    return { season: start === current ? "current" : "other", label: seasonLabel(start), start };
  }
  m = t.match(/(?<!\d)(\d{2}) (\d{2})(?!\d)/);
  if (m && Number(m[2]) === (Number(m[1]) + 1) % 100) {
    const start = 2e3 + Number(m[1]);
    return { season: start === current ? "current" : "other", label: seasonLabel(start), start };
  }
  m = t.match(/(?<!\d)(20\d{2})(?!\d)/);
  if (m) {
    const year = Number(m[1]);
    if (year === current || year === current + 1) return { season: "current", label: seasonLabel(current) };
    return { season: "other", label: String(year), start: year };
  }
  return { season: null, label: null };
}
function parseQuestion(text, now = /* @__PURE__ */ new Date()) {
  const t = norm(text);
  const q = { raw: text, text: t, intent: detectIntent(t), league: null, competition: null, unsupported: null };
  for (const [phrase, label2] of Object.entries(UNSUPPORTED)) {
    if (hasPhrase(t, phrase)) {
      q.unsupported = label2;
      break;
    }
  }
  if (ALL_COMP_ALIASES.some((a) => hasPhrase(t, a))) q.competition = "ALL";
  else if (CL_ALIASES.some((a) => hasPhrase(t, a))) q.competition = "CL";
  for (const [code, league] of Object.entries(LEAGUES)) {
    if (league.aliases.some((a) => hasPhrase(t, a))) {
      q.league = code;
      if (!q.competition) q.competition = "LEAGUE";
      break;
    }
  }
  Object.assign(q, parseSeason(t, now));
  return q;
}
function residualName(t, teamWords = []) {
  let text = ` ${t} `;
  const removable = [
    ...Object.values(LEAGUES).flatMap((l) => l.aliases),
    ...CL_ALIASES,
    ...ALL_COMP_ALIASES,
    ...Object.keys(UNSUPPORTED),
    ...teamWords
  ].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const phrase of removable) text = removePhrase(text, phrase);
  const words = text.split(/\s+/).filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w) && w.length > 1);
  return words.slice(0, 4).join(" ") || null;
}

// src/normalize.js
var int = (v) => v === null || v === void 0 || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
var label = (team) => team && (team.shortName || team.name) || "?";
function fdStandings(json2) {
  const table = (json2?.standings || []).find((s) => s.type === "TOTAL")?.table || [];
  return table.map((r) => ({
    position: int(r.position),
    team: label(r.team),
    teamFull: r.team?.name || label(r.team),
    teamId: r.team?.id,
    played: int(r.playedGames),
    points: int(r.points),
    goalsFor: int(r.goalsFor),
    goalsAgainst: int(r.goalsAgainst)
  }));
}
function fdScorers(json2) {
  return (json2?.scorers || []).map((s) => ({
    player: s.player?.name || "?",
    firstName: s.player?.firstName || "",
    lastName: s.player?.lastName || "",
    team: label(s.team),
    teamFull: s.team?.name || label(s.team),
    goals: int(s.goals),
    matches: int(s.playedMatches)
  }));
}
var FD_STATUS = {
  FINISHED: "finished",
  AWARDED: "finished",
  IN_PLAY: "live",
  PAUSED: "live",
  LIVE: "live",
  SCHEDULED: "scheduled",
  TIMED: "scheduled"
};
function fdMatches(json2) {
  return (json2?.matches || []).map((m) => ({
    date: m.utcDate,
    status: FD_STATUS[m.status] || "other",
    timeConfirmed: m.status !== "SCHEDULED",
    matchday: int(m.matchday),
    home: label(m.homeTeam),
    away: label(m.awayTeam),
    homeFull: m.homeTeam?.name,
    awayFull: m.awayTeam?.name,
    homeGoals: int(m.score?.fullTime?.home),
    awayGoals: int(m.score?.fullTime?.away)
  }));
}
function afErrors(json2) {
  const errors = json2?.errors;
  if (!errors) return null;
  if (Array.isArray(errors)) return errors.length ? { other: errors.join(" ") } : null;
  return Object.keys(errors).length ? errors : null;
}
function afStandings(json2) {
  const groups = json2?.response?.[0]?.league?.standings || [];
  return (groups[0] || []).map((r) => ({
    position: int(r.rank),
    team: r.team?.name || "?",
    teamFull: r.team?.name || "?",
    teamId: r.team?.id,
    played: int(r.all?.played),
    points: int(r.points),
    goalsFor: int(r.all?.goals?.for),
    goalsAgainst: int(r.all?.goals?.against)
  }));
}
function afTopScorers(json2) {
  return (json2?.response || []).map((p) => {
    const st = p.statistics?.[0] || {};
    return {
      player: p.player?.name || "?",
      firstName: p.player?.firstname || "",
      lastName: p.player?.lastname || "",
      team: st.team?.name || "?",
      teamFull: st.team?.name || "?",
      goals: int(st.goals?.total),
      matches: int(st.games?.appearences)
    };
  });
}
function afPlayers(json2) {
  return (json2?.response || []).map((p) => ({
    player: p.player?.name || "?",
    firstName: p.player?.firstname || "",
    lastName: p.player?.lastname || "",
    nationality: p.player?.nationality || "",
    competitions: (p.statistics || []).map((s) => ({
      name: s.league?.name || "?",
      team: s.team?.name || "?",
      goals: int(s.goals?.total) ?? 0,
      matches: int(s.games?.appearences) ?? 0
    }))
  }));
}
function tsdbTable(json2) {
  return (json2?.table || []).map((r) => ({
    position: int(r.intRank),
    team: r.strTeam,
    teamFull: r.strTeam,
    played: int(r.intPlayed),
    points: int(r.intPoints),
    goalsFor: int(r.intGoalsFor),
    goalsAgainst: int(r.intGoalsAgainst),
    updated: r.dateUpdated || null
  }));
}
function olTable(json2) {
  return (Array.isArray(json2) ? json2 : []).map((r, i) => ({
    position: i + 1,
    team: r.shortName || r.teamName,
    teamFull: r.teamName,
    played: int(r.matches),
    points: int(r.points),
    goalsFor: int(r.goals),
    goalsAgainst: int(r.opponentGoals)
  }));
}
function olScorers(json2) {
  return (Array.isArray(json2) ? json2 : []).map((g) => ({
    player: g.goalGetterName,
    firstName: "",
    lastName: String(g.goalGetterName || "").split(" ").pop(),
    team: null,
    teamFull: null,
    goals: int(g.goalCount),
    matches: null
  }));
}
function wikiSummary(json2) {
  if (!json2 || json2.type === "disambiguation" || !json2.extract) return null;
  return {
    title: json2.title,
    description: json2.description || "",
    extract: String(json2.extract),
    url: json2.content_urls?.desktop?.page || null,
    updated: json2.timestamp || null
  };
}
var GENERIC = /* @__PURE__ */ new Set([
  "fc",
  "cf",
  "ac",
  "as",
  "sc",
  "ssc",
  "afc",
  "rc",
  "ogc",
  "club",
  "de",
  "del",
  "la",
  "le",
  "les",
  "football",
  "olympique",
  "sporting",
  "stade",
  "ss",
  "us",
  "vfb",
  "vfl",
  "tsg",
  "sv",
  "1",
  "bc",
  "calcio",
  "cd",
  "ud",
  "rcd",
  "ca",
  "osc",
  "hsc",
  "aj",
  "ea",
  "fk",
  "the",
  "racing"
]);
var SYNONYMS = {
  munchen: "munich",
  koln: "cologne",
  monchengladbach: "gladbach",
  internazionale: "inter",
  barca: "barcelona",
  milano: "milan"
};
function distinctive(name) {
  return new Set(norm(name).split(" ").map((w) => SYNONYMS[w] || w).filter((w) => w && !GENERIC.has(w)));
}
function matchTeam(name, rows) {
  const target = distinctive(name);
  const scored = [];
  for (const row of rows) {
    const other = /* @__PURE__ */ new Set([...distinctive(row.teamFull || ""), ...distinctive(row.team || "")]);
    const inter = [...target].filter((w) => other.has(w)).length;
    if (!target.size || !other.size || !inter) continue;
    const union = (/* @__PURE__ */ new Set([...target, ...other])).size;
    scored.push({ jaccard: inter / union, overlap: inter / Math.min(target.size, other.size), row });
  }
  scored.sort((a, b) => b.jaccard - a.jaccard);
  if (!scored.length || scored[0].jaccard <= 0.5) return null;
  if (scored.length > 1 && scored[0].jaccard === scored[1].jaccard) return null;
  return scored[0].row;
}
function nameMatches(query, player) {
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  const full = new Set(norm([player.player, player.firstName, player.lastName].join(" ")).split(" "));
  return words.length > 0 && words.every((w) => full.has(w));
}

// src/providers.js
var QuotaError = class extends Error {
  constructor(provider, retryAfter) {
    super(`quota ${provider}`);
    this.provider = provider;
    this.retryAfter = retryAfter;
  }
};
var UnavailableError = class extends Error {
  constructor(provider, reason) {
    super(`${provider} : ${reason}`);
    this.provider = provider;
    this.reason = reason;
  }
};
var LIMITS = {
  "API-Football": { perMinute: 8, perDay: 90 },
  // offre gratuite : 100/jour
  "football-data.org": { perMinute: 9, perDay: 1e4 },
  // offre gratuite : 10/minute
  "TheSportsDB": { perMinute: 25, perDay: 2e4 },
  // clé publique : 30/minute
  "OpenLigaDB": { perMinute: 30, perDay: 2e4 },
  // pas de limite publiée
  "Wikip\xE9dia": { perMinute: 30, perDay: 5e3 }
};
var TTL = {
  live: 60,
  // score en direct / dernier résultat
  standings: 600,
  // classement
  schedule: 600,
  // calendrier
  playerStats: 21600,
  // statistiques de joueur : 6 h
  teamIds: 259200,
  // identifiants d'équipes : 3 jours
  wiki: 259200
  // informations générales : 3 jours
};
var STALE_MAX_SEC = 172800;
var USER_AGENT = "FootAnalyse/1.0 (https://pronoben.github.io/foot-analyses-/)";
var inflight = /* @__PURE__ */ new Map();
var Providers = class {
  constructor(env, store, fetchImpl = (...a) => fetch(...a), now = () => /* @__PURE__ */ new Date()) {
    this.env = env;
    this.store = store;
    this.fetch = fetchImpl;
    this.now = now;
    this.season = currentSeasonStart(now());
  }
  hasApiFootball() {
    return Boolean(this.env.API_FOOTBALL_KEY);
  }
  hasFootballData() {
    return Boolean(this.env.FOOTBALL_DATA_KEY);
  }
  async quota(provider) {
    const limits = LIMITS[provider];
    const minute = await this.store.hit(`quota:${provider}:m`, limits.perMinute, 60);
    if (!minute.allowed) throw new QuotaError(provider, minute.retryAfter);
    const day = await this.store.hit(`quota:${provider}:d`, limits.perDay, 86400);
    if (!day.allowed) throw new QuotaError(provider, day.retryAfter);
  }
  async getJSON(provider, url, headers = {}) {
    await this.quota(provider);
    let res;
    try {
      res = await this.fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers } });
    } catch {
      throw new UnavailableError(provider, "fournisseur injoignable");
    }
    if (res.status === 429) throw new QuotaError(provider, 60);
    if (res.status === 401 || res.status === 403) {
      throw new UnavailableError(provider, "acc\xE8s refus\xE9 (cl\xE9 absente, invalide ou donn\xE9e hors offre gratuite)");
    }
    if (!res.ok) throw new UnavailableError(provider, `erreur ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new UnavailableError(provider, "r\xE9ponse illisible");
    }
  }
  /** Cache partagé ; si le fournisseur échoue, on sert une copie récente marquée « stale ». */
  async cached(key, ttl, fetcher) {
    const entry = await this.store.get(key);
    const nowSec2 = Math.floor(this.now().getTime() / 1e3);
    if (entry && entry.expiresAt > nowSec2) return { ...entry.value, stale: false };
    try {
      let pending = inflight.get(key);
      if (!pending) {
        pending = (async () => {
          const value2 = await fetcher();
          await this.store.put(key, value2, ttl);
          return value2;
        })();
        inflight.set(key, pending);
        pending.finally(() => inflight.delete(key)).catch(() => {
        });
      }
      const value = await pending;
      return { ...value, stale: false };
    } catch (error) {
      if (entry && nowSec2 - entry.storedAt < STALE_MAX_SEC) {
        return { ...entry.value, stale: true, staleReason: error.reason || "quota gratuit atteint" };
      }
      throw error;
    }
  }
  result(provider, title, url, data) {
    return { provider, title, url, retrievedAt: this.now().toISOString(), data };
  }
  // ------------------------------------------------------------ football-data
  async fd(path, ttl, normalizer, title) {
    if (!this.hasFootballData()) throw new UnavailableError("football-data.org", "cl\xE9 FOOTBALL_DATA_KEY non configur\xE9e");
    return this.cached(`fd:${path}`, ttl, async () => {
      const json2 = await this.getJSON(
        "football-data.org",
        `https://api.football-data.org/v4${path}`,
        { "X-Auth-Token": this.env.FOOTBALL_DATA_KEY }
      );
      return this.result("football-data.org", title, "https://www.football-data.org/", normalizer(json2));
    });
  }
  fdStandings(code) {
    return this.fd(
      `/competitions/${code}/standings`,
      TTL.standings,
      fdStandings,
      `classement ${LEAGUES[code].name}`
    );
  }
  fdScorers(code) {
    const name = code === "CL" ? CHAMPIONS_LEAGUE.name : LEAGUES[code].name;
    return this.fd(
      `/competitions/${code}/scorers?limit=100`,
      TTL.playerStats,
      fdScorers,
      `buteurs ${name}`
    );
  }
  fdMatches(code) {
    const day = 864e5;
    const now = this.now().getTime();
    const from = new Date(now - 21 * day).toISOString().slice(0, 10);
    const to = new Date(now + 35 * day).toISOString().slice(0, 10);
    return this.fd(
      `/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`,
      TTL.live,
      fdMatches,
      `matchs ${LEAGUES[code].name}`
    );
  }
  // -------------------------------------------------------------- API-Football
  async af(path, ttl, normalizer, title) {
    if (!this.hasApiFootball()) throw new UnavailableError("API-Football", "cl\xE9 API_FOOTBALL_KEY non configur\xE9e");
    const down = await this.store.get("af:down");
    const nowSec2 = Math.floor(this.now().getTime() / 1e3);
    if (down && down.expiresAt > nowSec2) {
      const cachedCopy = await this.store.get(`af:${path}`);
      if (cachedCopy && nowSec2 - cachedCopy.storedAt < 172800) return { ...cachedCopy.value, stale: false };
      throw new UnavailableError("API-Football", down.value.reason);
    }
    return this.cached(`af:${path}`, ttl, async () => {
      const json2 = await this.getJSON(
        "API-Football",
        `https://v3.football.api-sports.io${path}`,
        { "x-apisports-key": this.env.API_FOOTBALL_KEY }
      );
      const errors = afErrors(json2);
      if (errors) {
        if (errors.requests || errors.rateLimit) throw new QuotaError("API-Football", 3600);
        const remember = async (reason) => {
          await this.store.put("af:down", { reason }, 21600);
          return new UnavailableError("API-Football", reason);
        };
        if (errors.plan) throw await remember("saison non incluse dans l'offre gratuite");
        if (errors.token) throw await remember("cl\xE9 invalide");
        if (errors.access) throw await remember("compte suspendu ou acc\xE8s refus\xE9");
        throw new UnavailableError("API-Football", "requ\xEAte refus\xE9e par le fournisseur");
      }
      return this.result("API-Football", title, "https://www.api-football.com/", normalizer(json2));
    });
  }
  afStandings(code) {
    return this.af(
      `/standings?league=${LEAGUES[code].apiFootball}&season=${this.season}`,
      TTL.standings,
      afStandings,
      `classement ${LEAGUES[code].name}`
    );
  }
  afTopScorers(code) {
    return this.af(
      `/players/topscorers?league=${LEAGUES[code].apiFootball}&season=${this.season}`,
      TTL.playerStats,
      afTopScorers,
      `meilleurs buteurs ${LEAGUES[code].name}`
    );
  }
  afPlayers(code, search) {
    const q = encodeURIComponent(search.slice(0, 40));
    return this.af(
      `/players?league=${LEAGUES[code].apiFootball}&season=${this.season}&search=${q}`,
      TTL.playerStats,
      afPlayers,
      `statistiques du joueur (${seasonLabel(this.season)})`
    );
  }
  // --------------------------------------------------------------- TheSportsDB
  tsdbTable(code) {
    const query = `l=${LEAGUES[code].tsdb}&s=${seasonLabel(this.season)}`;
    const url = `https://www.thesportsdb.com/api/v1/json/123/lookuptable.php?${query}`;
    return this.cached(`tsdb:${query}`, TTL.standings, async () => {
      const json2 = await this.getJSON("TheSportsDB", url);
      return this.result("TheSportsDB", `classement ${LEAGUES[code].name} (5 premiers)`, url, tsdbTable(json2));
    });
  }
  // ---------------------------------------------------------------- OpenLigaDB
  olTable() {
    const url = `https://api.openligadb.de/getbltable/bl1/${this.season}`;
    return this.cached(`ol:table:${this.season}`, TTL.standings, async () => this.result("OpenLigaDB", "classement Bundesliga", url, olTable(await this.getJSON("OpenLigaDB", url))));
  }
  olScorers() {
    const url = `https://api.openligadb.de/getgoalgetters/bl1/${this.season}`;
    return this.cached(`ol:goals:${this.season}`, TTL.playerStats, async () => this.result("OpenLigaDB", "buteurs Bundesliga", url, olScorers(await this.getJSON("OpenLigaDB", url))));
  }
  // ----------------------------------------------------------------- Wikipédia
  async wiki(query) {
    const q = query.slice(0, 80);
    return this.cached(`wiki:${q.toLowerCase()}`, TTL.wiki, async () => {
      const search = await this.getJSON(
        "Wikip\xE9dia",
        `https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=${encodeURIComponent(q)}`
      );
      const hits = search?.query?.search || [];
      if (!hits.length) throw new UnavailableError("Wikip\xE9dia", "aucune page trouv\xE9e");
      const title = hits[0].title;
      const json2 = await this.getJSON(
        "Wikip\xE9dia",
        `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`
      );
      const summary = wikiSummary(json2);
      if (!summary) throw new UnavailableError("Wikip\xE9dia", "page ambigu\xEB ou vide");
      return this.result("Wikip\xE9dia", `page \xAB ${summary.title} \xBB`, summary.url, {
        ...summary,
        alternatives: hits.slice(1).map((h) => h.title)
      });
    });
  }
};

// src/verify.js
var NO_SOURCE_MESSAGE = "Je ne peux pas confirmer cette information avec une source fiable pour le moment. Je pr\xE9f\xE8re ne pas donner de chiffre plut\xF4t que d'en inventer un.";
var LABELS = {
  multiple: "V\xE9rifi\xE9 par plusieurs sources",
  single: "Source unique \u2014 v\xE9rification compl\xE9mentaire recommand\xE9e",
  conflict: "Sources en d\xE9saccord \u2014 valeurs diff\xE9rentes affich\xE9es"
};
var OLD_DATA_HOURS = 24;
var Evidence = class {
  constructor(now = () => /* @__PURE__ */ new Date()) {
    this.now = now;
    this.sources = [];
    this.facts = [];
    this.warnings = [];
    this.conflict = false;
  }
  /** Enregistre une source réellement consultée et renvoie son identifiant. */
  source(result) {
    const existing = this.sources.find((s) => s.provider === result.provider && s.title === result.title && s.url === result.url);
    if (existing) return existing.id;
    const id = `source-${this.sources.length + 1}`;
    this.sources.push({
      id,
      provider: result.provider,
      title: result.title,
      url: result.url,
      retrievedAt: result.retrievedAt,
      stale: Boolean(result.stale)
    });
    if (result.stale) {
      this.warn(`${result.provider} indisponible (${result.staleReason}) : donn\xE9e issue du cache du ${formatDateTime(result.retrievedAt)}.`);
    }
    return id;
  }
  fact(claim, sourceIds, { conflict = false } = {}) {
    this.facts.push({ claim, sourceIds: [...new Set(sourceIds)], conflict });
    if (conflict) this.conflict = true;
  }
  warn(text) {
    if (!this.warnings.includes(text)) this.warnings.push(text);
  }
  providersOf(fact) {
    return new Set(fact.sourceIds.map((id) => this.sources.find((s) => s.id === id)?.provider).filter(Boolean));
  }
};
function finalize(evidence, { answer, extra = {} }) {
  const valid = new Set(evidence.sources.map((s) => s.id));
  const facts = evidence.facts.filter((f) => f.sourceIds.length && f.sourceIds.every((id) => valid.has(id)));
  if (!facts.length) return unverifiable(evidence.warnings);
  const used = new Set(facts.flatMap((f) => f.sourceIds));
  const sources = evidence.sources.filter((s) => used.has(s.id));
  let level = "single";
  if (evidence.conflict || facts.some((f) => f.conflict)) level = "conflict";
  else if (facts.every((f) => evidence.providersOf(f).size >= 2)) level = "multiple";
  const warnings = [...evidence.warnings];
  const nowMs = evidence.now().getTime();
  for (const s of sources) {
    const ageH = (nowMs - new Date(s.retrievedAt).getTime()) / 36e5;
    if (ageH > OLD_DATA_HOURS && !s.stale) {
      warnings.push(`Donn\xE9e ${s.provider} r\xE9cup\xE9r\xE9e le ${formatDateTime(s.retrievedAt)} : elle peut ne plus \xEAtre \xE0 jour.`);
    }
  }
  const verifiedAt = sources.map((s) => s.retrievedAt).sort()[0];
  return {
    status: "verified",
    answer,
    verifiedAt,
    verification: { level, label: LABELS[level] },
    facts: facts.map(({ claim, sourceIds, conflict }) => ({ claim, sourceIds, ...conflict ? { conflict: true } : {} })),
    sources: sources.map(({ id, provider, title, url, retrievedAt }) => ({ id, provider, title, url, retrievedAt })),
    warnings,
    ...extra
  };
}
function unverifiable(warnings = [], reason = null) {
  return {
    status: "unverifiable",
    answer: reason ? `${reason} ${NO_SOURCE_MESSAGE}` : NO_SOURCE_MESSAGE,
    verifiedAt: null,
    facts: [],
    sources: [],
    warnings
  };
}
function simple(status, answer, extra = {}) {
  return { status, answer, verifiedAt: null, facts: [], sources: [], warnings: [], ...extra };
}
function clarification(reason, questions) {
  return simple("clarification", `Avant de chercher, j'ai besoin de pr\xE9cisions : ${reason}`, { questions });
}
var KEY_LIKE = [
  /gsk_[A-Za-z0-9]{16,}/g,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /\b0x4AAA[0-9A-Za-z_-]{10,}\b/g,
  /\b[a-f0-9]{32}\b/g
];
function redact(value, env) {
  let text = JSON.stringify(value);
  for (const name of ["API_FOOTBALL_KEY", "FOOTBALL_DATA_KEY", "TURNSTILE_SECRET_KEY"]) {
    const secret = env?.[name];
    if (secret && secret.length >= 8) text = text.split(secret).join("[masqu\xE9]");
  }
  for (const re of KEY_LIKE) text = text.replace(re, "[masqu\xE9]");
  return JSON.parse(text);
}

// src/rules.js
var IFAB_SOURCE = {
  provider: "IFAB (source officielle)",
  title: "Lois du Jeu 2026/27 (publication officielle)",
  url: "https://downloads.theifab.com/downloads/laws-of-the-game-202627-double-pages?l=en"
};
var RULES = [
  {
    keys: ["hors jeu", "offside"],
    law: "Loi 11",
    claim: "\xCAtre en position de hors-jeu n'est pas une faute en soi : un joueur l'est si une partie de sa t\xEAte, de son corps ou de ses pieds se trouve dans la moiti\xE9 adverse (ligne m\xE9diane exclue) et plus pr\xE8s de la ligne de but adverse que le ballon et l'avant-dernier adversaire. Il n'est sanctionn\xE9 que s'il participe activement au jeu quand un co\xE9quipier joue le ballon, et il n'y a pas de hors-jeu sur un coup de pied de but, une rentr\xE9e de touche ou un corner."
  },
  {
    keys: ["duree", "combien de temps", "mi temps", "45 minutes", "90 minutes"],
    law: "Loi 7",
    claim: "Un match se joue en deux p\xE9riodes \xE9gales de 45 minutes ; la pause de la mi-temps ne d\xE9passe pas 15 minutes."
  },
  {
    keys: ["combien de joueurs", "nombre de joueurs", "11 joueurs", "onze joueurs"],
    law: "Loi 3",
    claim: "Chaque \xE9quipe compte au maximum 11 joueurs sur le terrain, dont un gardien ; un match ne peut pas commencer ou se poursuivre si une \xE9quipe a moins de 7 joueurs."
  },
  {
    keys: ["penalty", "penalties", "point de penalty", "tir au but"],
    law: "Loi 14",
    claim: "Le penalty est tir\xE9 depuis le point de r\xE9paration, \xE0 11 m de la ligne de but ; le gardien doit rester sur sa ligne de but, entre les poteaux, jusqu'\xE0 ce que le ballon soit frapp\xE9."
  },
  {
    keys: ["carton rouge", "carton jaune", "cartons", "exclusion", "avertissement"],
    law: "Loi 12",
    claim: "Un joueur qui re\xE7oit un second avertissement (carton jaune) dans le m\xEAme match est exclu (carton rouge) ; un joueur exclu ne peut pas \xEAtre remplac\xE9."
  },
  {
    keys: ["but valable", "but valide", "but compte", "ligne de but", "quand y a t il but"],
    law: "Loi 10",
    claim: "Un but est marqu\xE9 quand le ballon a enti\xE8rement franchi la ligne de but, entre les poteaux et sous la barre transversale, sans faute pr\xE9alable de l'\xE9quipe qui marque."
  },
  {
    keys: ["remplacement", "remplacements", "remplacant", "remplacants"],
    law: "Loi 3",
    claim: "Le nombre de rempla\xE7ants autoris\xE9s est fix\xE9 par le r\xE8glement de chaque comp\xE9tition, dans les limites pr\xE9vues par les Lois du Jeu."
  }
];
function findRules(text) {
  return RULES.filter((rule) => rule.keys.some((k) => hasPhrase(text, k)));
}
var RULE_TOPICS = "hors-jeu, dur\xE9e d'un match, nombre de joueurs, penalty, cartons, but valable, remplacements";

// src/ai.js
var DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
var SYSTEM = "Tu reformules des faits de football en fran\xE7ais. \xC9cris UNE ou DEUX phrases courtes (40 mots maximum), claires et neutres. Utilise uniquement les faits fournis : n'ajoute aucun chiffre, nom, date, opinion ni lien.";
var numbers = (text) => new Set(String(text).match(/\d+(?:[.,]\d+)?/g) || []);
function validSentence(sentence, factsText) {
  if (!sentence || sentence.length > 320 || /https?:|www\.|\[|\]/i.test(sentence)) return false;
  const allowed = numbers(factsText);
  return [...numbers(sentence)].every((n) => allowed.has(n));
}
async function rephrase(env, store, facts, template) {
  if (!env.AI || env.AI_DISABLED === "true") return { text: template, mode: "mod\xE8le" };
  const daily = Number(env.AI_DAILY_CALLS || 150);
  const budget = await store.hit("quota:workers-ai:d", daily, 86400);
  if (!budget.allowed) return { text: template, mode: "quota" };
  const factsText = facts.map((f) => `- ${f.claim}`).join("\n").slice(0, 3e3);
  try {
    const out = await env.AI.run(env.AI_MODEL || DEFAULT_MODEL, {
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Faits v\xE9rifi\xE9s :
${factsText}` }],
      max_tokens: 120,
      temperature: 0
    });
    const raw = out?.response ?? out?.choices?.[0]?.message?.content ?? "";
    const sentence = String(raw).replace(/\s+/g, " ").trim().replace(/^"|"$/g, "");
    if (validSentence(sentence, factsText)) return { text: sentence, mode: "ia" };
    return { text: template, mode: "mod\xE8le" };
  } catch {
    return { text: template, mode: "quota" };
  }
}

// src/engine.js
var CLARIFY_PREFIX = "Avant de chercher, j'ai besoin de pr\xE9cisions";
var MAX_QUESTION_CHARS = 500;
var SECRET_REFUSAL = "Je ne communique aucune cl\xE9, aucun mot de passe ni aucune information interne. Pose-moi une question sur le football.";
function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) {
    throw new RangeError("Conversation invalide ou trop longue.");
  }
  const clean = [];
  for (const m of messages.slice(-8)) {
    if (!m || typeof m !== "object" || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
      throw new RangeError("Message invalide.");
    }
    const content = m.content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 2e3);
    if (content) clean.push({ role: m.role, content });
  }
  const last = clean[clean.length - 1];
  if (!last || last.role !== "user") throw new RangeError("Le dernier message doit venir de l'utilisateur.");
  if (last.content.length > MAX_QUESTION_CHARS) {
    throw new RangeError(`Question trop longue (${MAX_QUESTION_CHARS} caract\xE8res maximum).`);
  }
  return clean;
}
function questionWithContext(clean) {
  const parts = [clean[clean.length - 1].content];
  let i = clean.length - 2;
  while (i >= 1 && clean[i].role === "assistant" && clean[i].content.startsWith(CLARIFY_PREFIX) && clean[i - 1].role === "user" && parts.length < 4) {
    parts.unshift(clean[i - 1].content);
    i -= 2;
  }
  return parts.join(" ; ");
}
var Engine = class {
  constructor(env, store, { fetchImpl, now } = {}) {
    this.env = env;
    this.store = store;
    this.now = now || (() => /* @__PURE__ */ new Date());
    this.p = new Providers(env, store, fetchImpl, this.now);
    this.season = seasonLabel(this.p.season);
  }
  async answer(messages) {
    const clean = validateMessages(messages);
    const latest = parseQuestion(clean[clean.length - 1].content, this.now());
    if (latest.intent === "secret") return simple("refused", SECRET_REFUSAL);
    const q = parseQuestion(questionWithContext(clean), this.now());
    if (q.intent === "secret") return simple("refused", SECRET_REFUSAL);
    try {
      switch (q.intent) {
        case "prediction":
          return simple("not_supported", "Les pronostics ne font pas partie de cette premi\xE8re version : ils ne sont pas v\xE9rifiables. L'onglet \xAB Pronostics \xBB du site donne une estimation statistique, pr\xE9sent\xE9e comme telle.");
        case "rules":
          return await this.rules(q);
        case "info":
          return await this.info(q);
        case "standings":
          return await this.standings(q);
        case "top_scorers":
          return await this.topScorers(q);
        case "goals":
          return await this.playerStat(q, "goals");
        case "appearances":
          return await this.playerStat(q, "matches");
        case "next_match":
          return await this.matches(q, "next");
        case "last_match":
          return await this.matches(q, "last");
        case "schedule":
          return await this.matches(q, "schedule");
        default:
          return this.help();
      }
    } catch (error) {
      if (error instanceof QuotaError) {
        const minutes = Math.max(1, Math.ceil((error.retryAfter || 60) / 60));
        return simple("quota", `Le quota gratuit de ${error.provider} est atteint. R\xE9essaie dans environ ${minutes} minute${minutes > 1 ? "s" : ""}. Aucune donn\xE9e non v\xE9rifi\xE9e n'est affich\xE9e et aucun service payant n'est utilis\xE9.`, { retryAfter: error.retryAfter || 60 });
      }
      if (error instanceof UnavailableError) {
        return unverifiable([`${error.provider} : ${error.reason}.`]);
      }
      throw error;
    }
  }
  help() {
    return clarification("je r\xE9ponds pour l'instant \xE0 des questions simples (saison en cours, 5 grands championnats).", [
      "\xAB Quel est le classement actuel de la Ligue 1 ? \xBB",
      "\xAB Meilleur buteur de Premier League \xBB",
      "\xAB Combien de buts Jo\xE3o Pedro de Chelsea a-t-il marqu\xE9s cette saison, toutes comp\xE9titions confondues ? \xBB",
      "\xAB Prochain match du PSG \xBB, \xAB Calendrier de l'OM \xBB, \xAB Dernier r\xE9sultat du Bayern \xBB",
      "\xAB Qui est Kylian Mbapp\xE9 ? \xBB, \xAB C'est quoi le hors-jeu ? \xBB"
    ]);
  }
  async finish(evidence, template, extra = {}) {
    const usable = evidence.facts.filter((f) => f.sourceIds.length);
    const { text, mode } = await rephrase(this.env, this.store, usable, template);
    if (mode === "quota") evidence.warn("Allocation gratuite de l'IA atteinte : r\xE9ponse r\xE9dig\xE9e automatiquement \xE0 partir des faits.");
    return finalize(evidence, { answer: text, extra: { phrasing: mode, ...extra } });
  }
  // ------------------------------------------------------------ données de base
  async tryAll(fetchers) {
    const ok = [], failed = [];
    for (const fetcher of fetchers) {
      try {
        ok.push(await fetcher());
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
        failed.push(error);
      }
    }
    return { ok, failed };
  }
  /** Aucune donnée : si un quota gratuit en est la cause, on le dit clairement. */
  noData(ev, failed, reason = null) {
    const quota = failed.find((e) => e instanceof QuotaError);
    if (quota) throw quota;
    return unverifiable(ev.warnings, reason);
  }
  primaryStandings(code) {
    const fetchers = [];
    if (this.p.hasApiFootball()) fetchers.push(() => this.p.afStandings(code));
    fetchers.push(() => this.p.fdStandings(code));
    return this.tryAll(fetchers);
  }
  async findTeams(q) {
    let hint = null, search = null;
    for (const nick of Object.keys(TEAM_NICKNAMES).sort((a, b) => b.length - a.length)) {
      if (hasPhrase(q.text, nick)) {
        [hint, search] = TEAM_NICKNAMES[nick];
        break;
      }
    }
    if (q.league) hint = q.league;
    const found = [];
    const leagues = hint ? [hint] : Object.keys(LEAGUES);
    for (const code of leagues) {
      const { ok, failed } = await this.primaryStandings(code);
      if (!ok.length) {
        if (failed.some((e) => e instanceof QuotaError)) throw failed.find((e) => e instanceof QuotaError);
        continue;
      }
      const rows = ok.find((r) => r.data.length)?.data || [];
      for (const row of rows) {
        const names = [norm(row.teamFull), norm(row.team)].filter(Boolean);
        if (search) {
          if (names.some((n) => hasPhrase(n, search))) found.push({ code, row });
          continue;
        }
        const words = [...new Set(names.flatMap((n) => [...distinctive(n)]))];
        if (names.some((n) => hasPhrase(q.text, n)) || words.some((w) => w.length >= 4 && hasPhrase(q.text, w))) {
          found.push({ code, row });
        }
      }
      if (found.length && !hint) break;
    }
    const unique = [];
    for (const f of found) if (!unique.some((u) => u.row.teamFull === f.row.teamFull)) unique.push(f);
    return unique;
  }
  teamWords(q, teams) {
    const words = Object.keys(TEAM_NICKNAMES).filter((n) => hasPhrase(q.text, n));
    for (const { row } of teams) words.push(norm(row.teamFull), norm(row.team), ...distinctive(row.teamFull));
    return words;
  }
  // ------------------------------------------------------------ règles
  async rules(q) {
    const rules = findRules(q.text);
    if (!rules.length) {
      return clarification(
        `je connais pour l'instant les r\xE8gles de base (${RULE_TOPICS}).`,
        ["Sur quelle r\xE8gle porte ta question ?"]
      );
    }
    const ev = new Evidence(this.now);
    const id = ev.source({ ...IFAB_SOURCE, retrievedAt: this.now().toISOString() });
    for (const rule of rules.slice(0, 2)) ev.fact(`${rule.law} : ${rule.claim}`, [id]);
    ev.warn("Synth\xE8se courte des Lois du Jeu ; les comp\xE9titions peuvent pr\xE9ciser certains points dans leur r\xE8glement.");
    return finalize(ev, { answer: rules[0].claim, extra: { phrasing: "mod\xE8le" } });
  }
  // ------------------------------------------------------------ informations générales
  async info(q) {
    const teams = await this.findTeams(q).catch(() => []);
    const subject = teams.length === 1 ? teams[0].row.teamFull : residualName(q.text, this.teamWords(q, teams));
    if (!subject) return clarification("le sujet n'est pas pr\xE9cis\xE9.", ["De quel joueur ou de quelle \xE9quipe parles-tu ?"]);
    let page;
    try {
      page = await this.p.wiki(teams.length === 1 ? `${subject} club de football` : `${subject} footballeur`);
    } catch (error) {
      if (error instanceof UnavailableError && /ambigu/.test(error.reason)) {
        return clarification("plusieurs pages correspondent \xE0 ce nom.", ["Pr\xE9cise le nom complet, le club ou la nationalit\xE9."]);
      }
      throw error;
    }
    const tokens = norm(subject).split(" ").filter((w) => w.length > 2);
    if (!tokens.every((t) => norm(page.data.title).includes(t) || norm(page.data.extract).includes(t))) {
      return unverifiable([], `Je n'ai pas trouv\xE9 de page fiable correspondant exactement \xE0 \xAB ${displayName(q.raw, norm(subject))} \xBB.`);
    }
    const ev = new Evidence(this.now);
    const id = ev.source(page);
    const first = page.data.extract.split(/(?<=\.)\s/).slice(0, 2).join(" ").slice(0, 400);
    ev.fact(first, [id]);
    ev.warn(`Informations g\xE9n\xE9rales (page Wikip\xE9dia mise \xE0 jour le ${formatDateTime(page.data.updated || page.retrievedAt)}) : elles ne remplacent pas les statistiques r\xE9centes.`);
    if (page.data.alternatives?.length) ev.warn(`Autres pages possibles : ${page.data.alternatives.join(", ")}.`);
    return this.finish(ev, first);
  }
  // ------------------------------------------------------------ classement
  async standings(q) {
    const wantsTeam = Object.keys(TEAM_NICKNAMES).some((n) => hasPhrase(q.text, n)) || ["place", "position", "classe", "rang", "points"].some((w) => hasPhrase(q.text, w)) || !q.league;
    const teams = wantsTeam ? await this.findTeams(q) : [];
    if (!q.league && !teams.length) {
      return clarification("le championnat n'est pas pr\xE9cis\xE9.", ["Quel championnat : Ligue 1, Premier League, Liga, Serie A ou Bundesliga ?"]);
    }
    if (teams.length > 1) {
      return clarification("plusieurs \xE9quipes correspondent.", [`De quelle \xE9quipe parles-tu : ${teams.map((t) => t.row.team).join(", ")} ?`]);
    }
    const code = teams[0]?.code || q.league;
    const league = LEAGUES[code].name;
    const ev = new Evidence(this.now);
    const { ok, failed } = await this.primaryStandings(code);
    const secondary = await this.tryAll([() => this.p.tsdbTable(code), ...code === "BL1" ? [() => this.p.olTable()] : []]);
    for (const e of [...failed, ...secondary.failed]) ev.warn(`${e.provider} indisponible : ${e.reason || "quota gratuit atteint"}.`);
    const all = [...ok, ...secondary.ok].filter((r) => r.data.length);
    if (!all.length) return this.noData(ev, [...failed, ...secondary.failed]);
    const primary = all[0];
    const others = all.slice(1);
    if (!ok.length) ev.warn("Fournisseur principal indisponible : r\xE9ponse construite avec une source secondaire.");
    const rows = teams.length ? [primary.data.find((r) => matchTeam(teams[0].row.teamFull, [r])) || null].filter(Boolean) : primary.data.slice(0, 5);
    if (!rows.length) return unverifiable(ev.warnings, `L'\xE9quipe n'appara\xEEt pas dans le classement fourni par ${primary.provider}.`);
    for (const row of rows) this.compareRow(ev, row, primary, others);
    const top = rows[0];
    const template = teams.length ? `${top.team} est ${ordinal(top.position)} de ${league} avec ${top.points} points apr\xE8s ${top.played} matchs.` : `${top.team} est en t\xEAte de ${league} avec ${top.points} points apr\xE8s ${top.played} matchs.`;
    ev.warn(`Saison ${this.season}.`);
    return this.finish(ev, template);
  }
  compareRow(ev, row, primary, others) {
    const pid = ev.source(primary);
    const agree = [pid], disagree = [];
    for (const other of others) {
      const match = matchTeam(row.teamFull, other.data);
      if (!match) continue;
      const oid = ev.source(other);
      if (match.points === row.points && match.played === row.played) agree.push(oid);
      else disagree.push({ oid, match, provider: other.provider, updated: match.updated });
    }
    const base = `${ordinal(row.position)} : ${row.team} \u2014 ${row.points} pts en ${row.played} matchs`;
    if (!disagree.length) return ev.fact(base, agree);
    const variants = disagree.map((d) => `${d.match.points} pts en ${d.match.played} matchs selon ${d.provider}` + (d.updated ? ` (mise \xE0 jour du ${d.updated})` : ""));
    ev.fact(
      `${row.team} : ${row.points} pts en ${row.played} matchs selon ${primary.provider} ; ${variants.join(" ; ")}`,
      [...agree, ...disagree.map((d) => d.oid)],
      { conflict: true }
    );
    ev.warn(`D\xE9saccord entre les sources pour ${row.team} : valeurs affich\xE9es c\xF4te \xE0 c\xF4te, probablement un d\xE9calage de mise \xE0 jour.`);
  }
  // ------------------------------------------------------------ meilleurs buteurs
  async topScorers(q) {
    if (!q.league) {
      return clarification("le championnat n'est pas pr\xE9cis\xE9.", ["Pour quel championnat : Ligue 1, Premier League, Liga, Serie A ou Bundesliga ?"]);
    }
    const fetchers = [];
    if (this.p.hasApiFootball()) fetchers.push(() => this.p.afTopScorers(q.league));
    fetchers.push(() => this.p.fdScorers(q.league));
    if (q.league === "BL1") fetchers.push(() => this.p.olScorers());
    const { ok, failed } = await this.tryAll(fetchers);
    const ev = new Evidence(this.now);
    for (const e of failed) ev.warn(`${e.provider} indisponible : ${e.reason || "quota gratuit atteint"}.`);
    const lists = ok.filter((r) => r.data.length);
    if (!lists.length) return this.noData(ev, failed);
    const primary = lists[0];
    for (const s of primary.data.slice(0, 3)) {
      const pid = ev.source(primary);
      const agree = [pid], diff = [];
      for (const other of lists.slice(1)) {
        const m = other.data.find((o) => norm(o.lastName || o.player).split(" ").pop() === norm(s.lastName || s.player).split(" ").pop());
        if (!m) continue;
        const oid = ev.source(other);
        if (m.goals === s.goals) agree.push(oid);
        else diff.push(`${m.goals} selon ${other.provider}`);
      }
      const who = s.team ? `${s.player} (${s.team})` : s.player;
      if (diff.length) {
        ev.fact(`${who} : ${s.goals} buts selon ${primary.provider} ; ${diff.join(" ; ")}`, agree, { conflict: true });
      } else {
        ev.fact(`${who} \u2014 ${s.goals} buts${s.matches ? ` en ${s.matches} matchs` : ""}`, agree);
      }
    }
    const best = primary.data[0];
    ev.warn(`Saison ${this.season}, ${LEAGUES[q.league].name} uniquement.`);
    return this.finish(ev, `${best.player}${best.team ? ` (${best.team})` : ""} est le meilleur buteur de ${LEAGUES[q.league].name} avec ${best.goals} buts.`);
  }
  // ------------------------------------------------------------ statistiques d'un joueur
  async playerStat(q, stat) {
    const teams = await this.findTeams(q);
    const player = residualName(q.text, this.teamWords(q, teams));
    if (!player) {
      if (teams.length && stat === "goals") return this.standings(q);
      return clarification("la question ne cite pas de joueur.", ["De quel joueur parles-tu ?"]);
    }
    const name = displayName(q.raw, player);
    const missing = [];
    if (!teams.length) {
      missing.push(`De quel \xAB ${name} \xBB parles-tu (nom complet, nationalit\xE9 ou poste) ?`, "Dans quel club joue-t-il ?");
    } else if (teams.length > 1) {
      missing.push(`Dans quel club joue-t-il : ${teams.map((t) => t.row.team).join(", ")} ?`);
    }
    if (!q.season) missing.push(`Pour quelle saison ? (seule la saison en cours, ${this.season}, est disponible gratuitement)`);
    if (!q.competition && !q.unsupported) missing.push("En championnat seulement, en Ligue des champions, ou toutes comp\xE9titions confondues ?");
    if (missing.length) {
      return clarification("plusieurs joueurs peuvent porter ce nom et le chiffre d\xE9pend du club, de la saison et des comp\xE9titions.", missing);
    }
    if (q.season === "other") {
      return unverifiable([], `Les sources gratuites configur\xE9es ne couvrent que la saison en cours (${this.season}), pas ${q.label}.`);
    }
    if (q.unsupported && q.competition !== "ALL") {
      return unverifiable([], `Les sources gratuites configur\xE9es ne couvrent pas ${q.unsupported}.`);
    }
    const { code, row: club } = teams[0];
    const scope = q.competition || "LEAGUE";
    const ev = new Evidence(this.now);
    const values = /* @__PURE__ */ new Map();
    const add = (comp, provider, value, sourceId) => {
      if (!values.has(comp)) values.set(comp, []);
      values.get(comp).push({ provider, value, sourceId });
    };
    const leagueName = LEAGUES[code].name;
    const failures = [];
    if (this.p.hasApiFootball()) {
      try {
        const res = await this.p.afPlayers(code, player);
        const hits = res.data.filter((p) => nameMatches(player, p));
        if (hits.length > 1) {
          return clarification("plusieurs joueurs correspondent.", [`Lequel : ${hits.map((h) => `${h.player} (${h.nationality})`).join(", ")} ?`]);
        }
        if (hits.length) {
          const sid = ev.source(res);
          for (const c of hits[0].competitions.filter((c2) => matchTeam(club.teamFull, [{ team: c2.team, teamFull: c2.team }]))) {
            const key = /champions league/i.test(c.name) ? CHAMPIONS_LEAGUE.name : matchTeam(leagueName, [{ team: c.name }]) ? leagueName : c.name;
            add(key, res.provider, c[stat], sid);
          }
        }
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
        failures.push(error);
        ev.warn(`API-Football indisponible : ${error.reason || "quota gratuit atteint"}.`);
      }
    }
    const fdComps = scope === "CL" ? ["CL"] : scope === "ALL" ? [code, "CL"] : [code];
    for (const comp of fdComps) {
      try {
        const res = await this.p.fdScorers(comp);
        const hits = res.data.filter((p) => nameMatches(player, p) && matchTeam(club.teamFull, [{ team: p.team, teamFull: p.teamFull }]));
        if (hits.length === 1) add(comp === "CL" ? CHAMPIONS_LEAGUE.name : leagueName, res.provider, hits[0][stat], ev.source(res));
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
        failures.push(error);
        ev.warn(`football-data.org indisponible pour ${comp === "CL" ? CHAMPIONS_LEAGUE.name : leagueName} : ${error.reason || "quota gratuit atteint"}.`);
      }
    }
    if (code === "BL1" && stat === "goals" && scope !== "CL") {
      try {
        const res = await this.p.olScorers();
        const last = norm(player).split(" ").pop();
        const hits = res.data.filter((g) => norm(g.player).split(" ").pop() === last);
        if (hits.length === 1) add(leagueName, res.provider, hits[0].goals, ev.source(res));
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
      }
    }
    const wanted = scope === "LEAGUE" ? [leagueName] : scope === "CL" ? [CHAMPIONS_LEAGUE.name] : [...values.keys()];
    const unit = stat === "goals" ? "buts" : "matchs jou\xE9s";
    let total = 0, counted = 0;
    for (const comp of wanted) {
      const list = values.get(comp);
      if (!list?.length) continue;
      const distinct = [...new Set(list.map((v) => v.value))];
      if (distinct.length === 1) {
        ev.fact(`${comp} : ${distinct[0]} ${unit} (${name}, ${club.team}, ${this.season})`, list.map((v) => v.sourceId));
        total += distinct[0];
        counted++;
      } else {
        ev.fact(`${comp} : ${list.map((v) => `${v.value} ${unit} selon ${v.provider}`).join(" ; ")}`, list.map((v) => v.sourceId), { conflict: true });
        ev.warn(`D\xE9saccord entre les sources pour ${comp} : valeurs affich\xE9es c\xF4te \xE0 c\xF4te.`);
        counted = -Infinity;
      }
    }
    if (!ev.facts.length) {
      return this.noData(ev, failures, `Je n'ai trouv\xE9 \xAB ${name} \xBB (${club.team}) dans aucune donn\xE9e v\xE9rifiable pour ${this.season}.`);
    }
    if (scope === "ALL") {
      const covered = [...values.keys()].join(", ");
      ev.warn(`Total calcul\xE9 sur les comp\xE9titions couvertes par les sources gratuites (${covered}) : coupes nationales ou autres comp\xE9titions absentes peuvent manquer.`);
    }
    const template = counted > 0 ? scope === "ALL" ? `${name} (${club.team}) compte au moins ${total} ${unit} cette saison dans les comp\xE9titions couvertes.` : `${name} (${club.team}) compte ${total} ${unit} en ${wanted[0]} cette saison.` : `Les sources ne concordent pas sur le nombre de ${unit} de ${name} : voir le d\xE9tail ci-dessous.`;
    return this.finish(ev, template);
  }
  // ------------------------------------------------------------ matchs
  async matches(q, kind) {
    const teams = await this.findTeams(q);
    if (!teams.length) return clarification("l'\xE9quipe n'est pas pr\xE9cis\xE9e.", ["De quelle \xE9quipe parles-tu ?"]);
    const distinctLeagues = new Set(teams.map((t) => t.code));
    let team = teams[0], opponent = null;
    if (teams.length === 2 && distinctLeagues.size === 1) opponent = teams[1];
    else if (teams.length > 1) {
      return clarification("plusieurs \xE9quipes correspondent.", [`De quelle \xE9quipe parles-tu : ${teams.map((t) => t.row.team).join(", ")} ?`]);
    }
    const res = await this.p.fdMatches(team.code);
    const involves = (m, t) => [m.homeFull, m.home, m.awayFull, m.away].some((n) => n && matchTeam(t.row.teamFull, [{ team: n, teamFull: n }]));
    let list = res.data.filter((m) => involves(m, team) && (!opponent || involves(m, opponent)));
    const ev = new Evidence(this.now);
    const sid = ev.source(res);
    const label2 = (m) => `${m.home} \u2013 ${m.away}`;
    if (kind === "last") {
      list = list.filter((m2) => m2.status === "finished").sort((a, b) => a.date.localeCompare(b.date));
      const m = list[list.length - 1];
      if (!m) return unverifiable([], `Aucun match termin\xE9 trouv\xE9 pour ${team.row.team} sur les 3 derni\xE8res semaines.`);
      ev.fact(`${formatDate(m.date)}${m.matchday ? `, journ\xE9e ${m.matchday}` : ""} : ${m.home} ${m.homeGoals} \u2013 ${m.awayGoals} ${m.away}`, [sid]);
      ev.warn("Offre gratuite de football-data.org : les scores sont transmis avec un l\xE9ger diff\xE9r\xE9.");
      return this.finish(ev, `Dernier match de ${team.row.team} : ${m.home} ${m.homeGoals} \u2013 ${m.awayGoals} ${m.away} le ${formatDate(m.date)}.`);
    }
    list = list.filter((m) => m.status === "scheduled" || m.status === "live").sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) return unverifiable([], `Aucun match \xE0 venir trouv\xE9 pour ${team.row.team} dans les 5 prochaines semaines.`);
    const when = (m) => `${formatDate(m.date)} \xE0 ${m.timeConfirmed ? formatTime(m.date) : "horaire \xE0 confirmer"} (heure de Paris)`;
    const shown = kind === "schedule" ? list.slice(0, 5) : list.slice(0, 1);
    for (const m of shown) ev.fact(`${when(m)}${m.matchday ? `, journ\xE9e ${m.matchday}` : ""} : ${label2(m)}`, [sid]);
    ev.warn(`${LEAGUES[team.code].name} uniquement : les matchs de coupe ne sont pas couverts. Horaires susceptibles d'\xE9voluer.`);
    const m0 = shown[0];
    const template = kind === "schedule" ? `Prochains matchs de ${team.row.team} en ${LEAGUES[team.code].name} : ${shown.length} rencontre${shown.length > 1 ? "s" : ""} programm\xE9e${shown.length > 1 ? "s" : ""}, la premi\xE8re le ${formatDate(m0.date)} (${label2(m0)}).` : `Prochain match de ${team.row.team} : ${label2(m0)} le ${when(m0)}.`;
    return this.finish(ev, template);
  }
};

// src/store.js
var nowSec = () => Math.floor(Date.now() / 1e3);
var MemoryStore = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.counters = /* @__PURE__ */ new Map();
  }
  async get(key) {
    return this.cache.get(key) || null;
  }
  async put(key, value, ttlSec) {
    const storedAt = nowSec();
    this.cache.set(key, { value, storedAt, expiresAt: storedAt + ttlSec });
  }
  async hit(bucket, limit, windowSec, increment = true) {
    const window = Math.floor(nowSec() / windowSec);
    const key = `${bucket}:${window}`;
    const count = (this.counters.get(key) || 0) + (increment ? 1 : 0);
    if (increment) this.counters.set(key, count);
    const retryAfter = (window + 1) * windowSec - nowSec();
    return { allowed: count <= limit, count, retryAfter };
  }
};
var SCHEMA = [
  "CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, stored_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL)"
];
var D1Store = class {
  constructor(db) {
    this.db = db;
    this.ready = null;
  }
  init() {
    if (!this.ready) {
      this.ready = this.db.batch(SCHEMA.map((sql) => this.db.prepare(sql))).catch((err) => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }
  async get(key) {
    await this.init();
    const row = await this.db.prepare("SELECT v, stored_at, expires_at FROM cache WHERE k = ?").bind(key).first();
    if (!row) return null;
    return { value: JSON.parse(row.v), storedAt: row.stored_at, expiresAt: row.expires_at };
  }
  async put(key, value, ttlSec) {
    await this.init();
    const storedAt = nowSec();
    const text = JSON.stringify(value);
    if (text.length > 9e5) return;
    await this.db.prepare("INSERT INTO cache (k, v, stored_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, stored_at = excluded.stored_at, expires_at = excluded.expires_at").bind(key, text, storedAt, storedAt + ttlSec).run();
    if (Math.random() < 0.02) {
      await this.db.prepare("DELETE FROM cache WHERE expires_at < ?").bind(storedAt - 172800).run();
      await this.db.prepare("DELETE FROM counters WHERE reset_at < ?").bind(storedAt).run();
    }
  }
  async hit(bucket, limit, windowSec, increment = true) {
    await this.init();
    const now = nowSec();
    const window = Math.floor(now / windowSec);
    const key = `${bucket}:${window}`;
    const resetAt = (window + 1) * windowSec;
    let count;
    if (increment) {
      const row = await this.db.prepare("INSERT INTO counters (k, n, reset_at) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n").bind(key, resetAt).first();
      count = row ? row.n : 1;
    } else {
      const row = await this.db.prepare("SELECT n FROM counters WHERE k = ?").bind(key).first();
      count = row ? row.n : 0;
    }
    return { allowed: count <= limit, count, retryAfter: resetAt - now };
  }
};

// src/index.js
var MAX_BODY_BYTES = 16e3;
var ANSWER_TTL = {
  next_match: 60,
  last_match: 60,
  schedule: 600,
  standings: 600,
  top_scorers: 3600,
  goals: 3600,
  appearances: 3600,
  info: 86400,
  rules: 86400
};
var memoryStore = null;
function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "https://pronoben.github.io").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean));
}
function corsHeaders(request, env) {
  const origin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin"
  };
  if (origin && allowedOrigins(env).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}
function json(request, env, status, payload) {
  return new Response(JSON.stringify(redact(payload, env)), { status, headers: corsHeaders(request, env) });
}
function getStore(env) {
  if (env.DB) return new D1Store(env.DB);
  if (env.ALLOW_MEMORY_STORE === "true") return memoryStore ||= new MemoryStore();
  return null;
}
async function verifyTurnstile(env, token, ip, fetchImpl) {
  if (env.TURNSTILE_DISABLED === "true") return { ok: true };
  if (!env.TURNSTILE_SECRET_KEY) return { ok: false, status: 503, error: "Protection anti-abus (Turnstile) non configur\xE9e sur le serveur." };
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, status: 403, error: "V\xE9rification anti-robot manquante. Recharge la page et r\xE9essaie." };
  }
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip });
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = await res.json();
    if (data.success) return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "V\xE9rification anti-robot momentan\xE9ment indisponible." };
  }
  return { ok: false, status: 403, error: "V\xE9rification anti-robot refus\xE9e. Recharge la page et r\xE9essaie." };
}
async function handle(request, env, { fetchImpl = (...a) => fetch(...a), now, store: injectedStore } = {}) {
  const url = new URL(request.url);
  const origin = (request.headers.get("Origin") || "").replace(/\/$/, "");
  const originOk = origin && allowedOrigins(env).has(origin);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: originOk ? 204 : 403, headers: corsHeaders(request, env) });
  }
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json(request, env, 200, {
      status: "ok",
      engine: "cloudflare-worker",
      storage: Boolean(env.DB),
      turnstile: Boolean(env.TURNSTILE_SECRET_KEY) || env.TURNSTILE_DISABLED === "true",
      ai: Boolean(env.AI),
      providers: {
        "API-Football": Boolean(env.API_FOOTBALL_KEY),
        "football-data.org": Boolean(env.FOOTBALL_DATA_KEY),
        TheSportsDB: true,
        OpenLigaDB: true,
        "Wikip\xE9dia": true
      },
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (url.pathname !== "/api/chat") return json(request, env, 404, { error: "Route inconnue." });
  if (request.method !== "POST") return json(request, env, 405, { error: "M\xE9thode non autoris\xE9e." });
  if (!originOk) return json(request, env, 403, { error: "Origine non autoris\xE9e." });
  const store = injectedStore || getStore(env);
  if (!store) return json(request, env, 503, { error: "Stockage (D1) non configur\xE9 sur le serveur." });
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const visitor = (await sha256(`${ip}|${env.TURNSTILE_SECRET_KEY || "dev"}`)).slice(0, 24);
  const errors = await store.hit(`err:${visitor}`, 5, 600, false);
  if (errors.count >= 5) {
    return json(request, env, 429, { status: "blocked", error: "Trop d'erreurs successives : r\xE9essaie dans quelques minutes.", retryAfter: errors.retryAfter });
  }
  const fail = async (status, error) => {
    await store.hit(`err:${visitor}`, 5, 600);
    return json(request, env, status, { status: "error", error });
  };
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return fail(415, "Content-Type application/json obligatoire.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return fail(413, "Message trop long.");
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, "Message trop long.");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Requ\xEAte illisible.");
  }
  if (!body || typeof body !== "object") return fail(400, "Requ\xEAte illisible.");
  let clean;
  try {
    clean = validateMessages(body.messages);
  } catch (error) {
    return fail(400, error.message);
  }
  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip, fetchImpl);
  if (!turnstile.ok) {
    return turnstile.status === 503 ? json(request, env, 503, { status: "error", error: turnstile.error }) : fail(turnstile.status, turnstile.error);
  }
  const perHour = Number(env.QUESTIONS_PER_HOUR || 10);
  const visitorLimit = await store.hit(`q:${visitor}`, perHour, 3600);
  if (!visitorLimit.allowed) {
    const minutes = Math.ceil(visitorLimit.retryAfter / 60);
    return json(request, env, 429, simple("quota", `Limite de ${perHour} questions par heure atteinte. R\xE9essaie dans environ ${minutes} minutes.`, { retryAfter: visitorLimit.retryAfter }));
  }
  const site = await store.hit("q:site", Number(env.QUESTIONS_PER_DAY || 2e3), 86400);
  if (!site.allowed) {
    return json(request, env, 429, simple("quota", "Le plafond gratuit de questions du site est atteint pour aujourd'hui. R\xE9essaie demain.", { retryAfter: site.retryAfter }));
  }
  const context = questionWithContext(clean);
  const intent = parseQuestion(context).intent;
  const cacheKey = `answer:${await sha256(norm(context))}`;
  const cached = await store.get(cacheKey);
  const nowSec2 = Math.floor(Date.now() / 1e3);
  if (cached && cached.expiresAt > nowSec2) return json(request, env, 200, { ...cached.value, cached: true });
  let result;
  try {
    result = await new Engine(env, store, { fetchImpl, now }).answer(clean);
  } catch (error) {
    if (error instanceof RangeError) return fail(400, error.message);
    console.error("Erreur interne", error?.name);
    return json(request, env, 500, { status: "error", error: "Erreur interne. R\xE9essaie plus tard." });
  }
  if (result.status === "verified" && ANSWER_TTL[intent]) await store.put(cacheKey, result, ANSWER_TTL[intent]);
  return json(request, env, 200, result);
}
var index_default = {
  fetch(request, env) {
    return handle(request, env);
  }
};
export {
  index_default as default,
  handle
};
