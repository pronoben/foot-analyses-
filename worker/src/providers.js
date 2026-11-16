// Accès aux fournisseurs gratuits : quotas, cache partagé, repli sur le cache
// quand un fournisseur est indisponible. Les clés restent dans `env` et ne
// figurent jamais dans les URL publiques renvoyées au navigateur.

import * as N from "./normalize.js";
import { LEAGUES, CHAMPIONS_LEAGUE } from "./intent.js";
import { currentSeasonStart, seasonLabel } from "./text.js";

export class QuotaError extends Error {
  constructor(provider, retryAfter) {
    super(`quota ${provider}`);
    this.provider = provider;
    this.retryAfter = retryAfter;
  }
}

export class UnavailableError extends Error {
  constructor(provider, reason) {
    super(`${provider} : ${reason}`);
    this.provider = provider;
    this.reason = reason;
  }
}

// Quotas gratuits, réglés sous les limites officielles.
export const LIMITS = {
  "API-Football": { perMinute: 8, perDay: 90 },          // offre gratuite : 100/jour
  "football-data.org": { perMinute: 9, perDay: 10000 },  // offre gratuite : 10/minute
  "TheSportsDB": { perMinute: 25, perDay: 20000 },       // clé publique : 30/minute
  "OpenLigaDB": { perMinute: 30, perDay: 20000 },        // pas de limite publiée
  "Wikipédia": { perMinute: 30, perDay: 5000 },
};

// Durées de cache (secondes).
export const TTL = {
  live: 60,            // score en direct / dernier résultat
  standings: 600,      // classement
  schedule: 600,       // calendrier
  playerStats: 21600,  // statistiques de joueur : 6 h
  teamIds: 259200,     // identifiants d'équipes : 3 jours
  wiki: 259200,        // informations générales : 3 jours
};
const STALE_MAX_SEC = 172800; // secours : cache jusqu'à 2 jours si le fournisseur tombe

const USER_AGENT = "FootAnalyse/1.0 (https://pronoben.github.io/foot-analyses-/)";
// Requêtes en cours : plusieurs visiteurs qui demandent la même donnée au même
// moment partagent un seul appel au fournisseur.
const inflight = new Map();

export class Providers {
  constructor(env, store, fetchImpl = (...a) => fetch(...a), now = () => new Date()) {
    this.env = env;
    this.store = store;
    this.fetch = fetchImpl;
    this.now = now;
    this.season = currentSeasonStart(now());
  }

  hasApiFootball() { return Boolean(this.env.API_FOOTBALL_KEY); }
  hasFootballData() { return Boolean(this.env.FOOTBALL_DATA_KEY); }

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
      throw new UnavailableError(provider, "accès refusé (clé absente, invalide ou donnée hors offre gratuite)");
    }
    if (!res.ok) throw new UnavailableError(provider, `erreur ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new UnavailableError(provider, "réponse illisible");
    }
  }

  /** Cache partagé ; si le fournisseur échoue, on sert une copie récente marquée « stale ». */
  async cached(key, ttl, fetcher) {
    const entry = await this.store.get(key);
    const nowSec = Math.floor(this.now().getTime() / 1000);
    if (entry && entry.expiresAt > nowSec) return { ...entry.value, stale: false };
    try {
      let pending = inflight.get(key);
      if (!pending) {
        pending = (async () => {
          const value = await fetcher();
          await this.store.put(key, value, ttl);
          return value;
        })();
        inflight.set(key, pending);
        pending.finally(() => inflight.delete(key)).catch(() => {});
      }
      const value = await pending;
      return { ...value, stale: false };
    } catch (error) {
      if (entry && nowSec - entry.storedAt < STALE_MAX_SEC) {
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
    if (!this.hasFootballData()) throw new UnavailableError("football-data.org", "clé FOOTBALL_DATA_KEY non configurée");
    return this.cached(`fd:${path}`, ttl, async () => {
      const json = await this.getJSON("football-data.org", `https://api.football-data.org/v4${path}`,
        { "X-Auth-Token": this.env.FOOTBALL_DATA_KEY });
      return this.result("football-data.org", title, "https://www.football-data.org/", normalizer(json));
    });
  }

  fdStandings(code) {
    return this.fd(`/competitions/${code}/standings`, TTL.standings, N.fdStandings,
      `classement ${LEAGUES[code].name}`);
  }

  fdScorers(code) {
    const name = code === "CL" ? CHAMPIONS_LEAGUE.name : LEAGUES[code].name;
    return this.fd(`/competitions/${code}/scorers?limit=100`, TTL.playerStats, N.fdScorers,
      `buteurs ${name}`);
  }

  fdMatches(code) {
    const day = 86400000;
    const now = this.now().getTime();
    const from = new Date(now - 21 * day).toISOString().slice(0, 10);
    const to = new Date(now + 35 * day).toISOString().slice(0, 10);
    return this.fd(`/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`, TTL.live, N.fdMatches,
      `matchs ${LEAGUES[code].name}`);
  }

  // -------------------------------------------------------------- API-Football
  async af(path, ttl, normalizer, title) {
    if (!this.hasApiFootball()) throw new UnavailableError("API-Football", "clé API_FOOTBALL_KEY non configurée");
    // Refus de l'offre gratuite mémorisé 6 h : on ne gaspille pas les 100 requêtes/jour.
    const down = await this.store.get("af:down");
    const nowSec = Math.floor(this.now().getTime() / 1000);
    if (down && down.expiresAt > nowSec) {
      const cachedCopy = await this.store.get(`af:${path}`);
      if (cachedCopy && nowSec - cachedCopy.storedAt < 172800) return { ...cachedCopy.value, stale: false };
      throw new UnavailableError("API-Football", down.value.reason);
    }
    return this.cached(`af:${path}`, ttl, async () => {
      const json = await this.getJSON("API-Football", `https://v3.football.api-sports.io${path}`,
        { "x-apisports-key": this.env.API_FOOTBALL_KEY });
      const errors = N.afErrors(json);
      if (errors) {
        if (errors.requests || errors.rateLimit) throw new QuotaError("API-Football", 3600);
        const remember = async reason => {
          await this.store.put("af:down", { reason }, 21600);
          return new UnavailableError("API-Football", reason);
        };
        if (errors.plan) throw await remember("saison non incluse dans l'offre gratuite");
        if (errors.token) throw await remember("clé invalide");
        if (errors.access) throw await remember("compte suspendu ou accès refusé");
        throw new UnavailableError("API-Football", "requête refusée par le fournisseur");
      }
      return this.result("API-Football", title, "https://www.api-football.com/", normalizer(json));
    });
  }

  afStandings(code) {
    return this.af(`/standings?league=${LEAGUES[code].apiFootball}&season=${this.season}`, TTL.standings,
      N.afStandings, `classement ${LEAGUES[code].name}`);
  }

  afTopScorers(code) {
    return this.af(`/players/topscorers?league=${LEAGUES[code].apiFootball}&season=${this.season}`, TTL.playerStats,
      N.afTopScorers, `meilleurs buteurs ${LEAGUES[code].name}`);
  }

  afPlayers(code, search) {
    const q = encodeURIComponent(search.slice(0, 40));
    return this.af(`/players?league=${LEAGUES[code].apiFootball}&season=${this.season}&search=${q}`, TTL.playerStats,
      N.afPlayers, `statistiques du joueur (${seasonLabel(this.season)})`);
  }

  // --------------------------------------------------------------- TheSportsDB
  tsdbTable(code) {
    const query = `l=${LEAGUES[code].tsdb}&s=${seasonLabel(this.season)}`;
    const url = `https://www.thesportsdb.com/api/v1/json/123/lookuptable.php?${query}`;
    return this.cached(`tsdb:${query}`, TTL.standings, async () => {
      const json = await this.getJSON("TheSportsDB", url);
      return this.result("TheSportsDB", `classement ${LEAGUES[code].name} (5 premiers)`, url, N.tsdbTable(json));
    });
  }

  // ---------------------------------------------------------------- OpenLigaDB
  olTable() {
    const url = `https://api.openligadb.de/getbltable/bl1/${this.season}`;
    return this.cached(`ol:table:${this.season}`, TTL.standings, async () =>
      this.result("OpenLigaDB", "classement Bundesliga", url, N.olTable(await this.getJSON("OpenLigaDB", url))));
  }

  olScorers() {
    const url = `https://api.openligadb.de/getgoalgetters/bl1/${this.season}`;
    return this.cached(`ol:goals:${this.season}`, TTL.playerStats, async () =>
      this.result("OpenLigaDB", "buteurs Bundesliga", url, N.olScorers(await this.getJSON("OpenLigaDB", url))));
  }

  // ----------------------------------------------------------------- Wikipédia
  async wiki(query) {
    const q = query.slice(0, 80);
    return this.cached(`wiki:${q.toLowerCase()}`, TTL.wiki, async () => {
      const search = await this.getJSON("Wikipédia",
        `https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=${encodeURIComponent(q)}`);
      const hits = search?.query?.search || [];
      if (!hits.length) throw new UnavailableError("Wikipédia", "aucune page trouvée");
      const title = hits[0].title;
      const json = await this.getJSON("Wikipédia",
        `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
      const summary = N.wikiSummary(json);
      if (!summary) throw new UnavailableError("Wikipédia", "page ambiguë ou vide");
      return this.result("Wikipédia", `page « ${summary.title} »`, summary.url, {
        ...summary, alternatives: hits.slice(1).map(h => h.title),
      });
    });
  }
}
