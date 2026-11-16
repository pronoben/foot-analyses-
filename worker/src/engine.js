// Moteur du chatbot : comprendre → précisions → sources → comparaison →
// faits sourcés → reformulation (IA en dernier) → réponse vérifiable.

import { LEAGUES, CHAMPIONS_LEAGUE, TEAM_NICKNAMES, parseQuestion, residualName } from "./intent.js";
import { Providers, QuotaError, UnavailableError } from "./providers.js";
import { Evidence, finalize, unverifiable, simple, clarification } from "./verify.js";
import { matchTeam, nameMatches, distinctive } from "./normalize.js";
import { findRules, IFAB_SOURCE, RULE_TOPICS } from "./rules.js";
import { rephrase } from "./ai.js";
import { norm, hasPhrase, ordinal, seasonLabel, displayName, formatDate, formatTime, formatDateTime } from "./text.js";

export const CLARIFY_PREFIX = "Avant de chercher, j'ai besoin de précisions";
export const MAX_QUESTION_CHARS = 500;
const SECRET_REFUSAL = "Je ne communique aucune clé, aucun mot de passe ni aucune information interne. " +
  "Pose-moi une question sur le football.";

// ------------------------------------------------------------ conversation
export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) {
    throw new RangeError("Conversation invalide ou trop longue.");
  }
  const clean = [];
  for (const m of messages.slice(-8)) {
    if (!m || typeof m !== "object" || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
      throw new RangeError("Message invalide.");
    }
    const content = m.content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 2000);
    if (content) clean.push({ role: m.role, content });
  }
  const last = clean[clean.length - 1];
  if (!last || last.role !== "user") throw new RangeError("Le dernier message doit venir de l'utilisateur.");
  if (last.content.length > MAX_QUESTION_CHARS) {
    throw new RangeError(`Question trop longue (${MAX_QUESTION_CHARS} caractères maximum).`);
  }
  return clean;
}

/** La question + les réponses aux demandes de précisions qui la suivent. */
export function questionWithContext(clean) {
  const parts = [clean[clean.length - 1].content];
  let i = clean.length - 2;
  while (i >= 1 && clean[i].role === "assistant" && clean[i].content.startsWith(CLARIFY_PREFIX)
    && clean[i - 1].role === "user" && parts.length < 4) {
    parts.unshift(clean[i - 1].content);
    i -= 2;
  }
  return parts.join(" ; ");
}

// ------------------------------------------------------------ moteur
export class Engine {
  constructor(env, store, { fetchImpl, now } = {}) {
    this.env = env;
    this.store = store;
    this.now = now || (() => new Date());
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
          return simple("not_supported", "Les pronostics ne font pas partie de cette première version : ils ne sont pas " +
            "vérifiables. L'onglet « Pronostics » du site donne une estimation statistique, présentée comme telle.");
        case "rules": return await this.rules(q);
        case "info": return await this.info(q);
        case "standings": return await this.standings(q);
        case "top_scorers": return await this.topScorers(q);
        case "goals": return await this.playerStat(q, "goals");
        case "appearances": return await this.playerStat(q, "matches");
        case "next_match": return await this.matches(q, "next");
        case "last_match": return await this.matches(q, "last");
        case "schedule": return await this.matches(q, "schedule");
        default: return this.help();
      }
    } catch (error) {
      if (error instanceof QuotaError) {
        const minutes = Math.max(1, Math.ceil((error.retryAfter || 60) / 60));
        return simple("quota", `Le quota gratuit de ${error.provider} est atteint. Réessaie dans environ ${minutes} minute${minutes > 1 ? "s" : ""}. ` +
          "Aucune donnée non vérifiée n'est affichée et aucun service payant n'est utilisé.", { retryAfter: error.retryAfter || 60 });
      }
      if (error instanceof UnavailableError) {
        return unverifiable([`${error.provider} : ${error.reason}.`]);
      }
      throw error;
    }
  }

  help() {
    return clarification("je réponds pour l'instant à des questions simples (saison en cours, 5 grands championnats).", [
      "« Quel est le classement actuel de la Ligue 1 ? »",
      "« Meilleur buteur de Premier League »",
      "« Combien de buts João Pedro de Chelsea a-t-il marqués cette saison, toutes compétitions confondues ? »",
      "« Prochain match du PSG », « Calendrier de l'OM », « Dernier résultat du Bayern »",
      "« Qui est Kylian Mbappé ? », « C'est quoi le hors-jeu ? »",
    ]);
  }

  async finish(evidence, template, extra = {}) {
    const usable = evidence.facts.filter(f => f.sourceIds.length);
    const { text, mode } = await rephrase(this.env, this.store, usable, template);
    if (mode === "quota") evidence.warn("Allocation gratuite de l'IA atteinte : réponse rédigée automatiquement à partir des faits.");
    return finalize(evidence, { answer: text, extra: { phrasing: mode, ...extra } });
  }

  // ------------------------------------------------------------ données de base
  async tryAll(fetchers) {
    const ok = [], failed = [];
    for (const fetcher of fetchers) {
      try { ok.push(await fetcher()); } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
        failed.push(error);
      }
    }
    return { ok, failed };
  }

  /** Aucune donnée : si un quota gratuit en est la cause, on le dit clairement. */
  noData(ev, failed, reason = null) {
    const quota = failed.find(e => e instanceof QuotaError);
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
      if (hasPhrase(q.text, nick)) { [hint, search] = TEAM_NICKNAMES[nick]; break; }
    }
    if (q.league) hint = q.league;
    const found = [];
    const leagues = hint ? [hint] : Object.keys(LEAGUES);
    for (const code of leagues) {
      const { ok, failed } = await this.primaryStandings(code);
      if (!ok.length) {
        if (failed.some(e => e instanceof QuotaError)) throw failed.find(e => e instanceof QuotaError);
        continue;
      }
      const rows = ok.find(r => r.data.length)?.data || [];
      for (const row of rows) {
        const names = [norm(row.teamFull), norm(row.team)].filter(Boolean);
        if (search) {
          if (names.some(n => hasPhrase(n, search))) found.push({ code, row });
          continue;
        }
        const words = [...new Set(names.flatMap(n => [...distinctive(n)]))];
        if (names.some(n => hasPhrase(q.text, n)) || words.some(w => w.length >= 4 && hasPhrase(q.text, w))) {
          found.push({ code, row });
        }
      }
      if (found.length && !hint) break;
    }
    const unique = [];
    for (const f of found) if (!unique.some(u => u.row.teamFull === f.row.teamFull)) unique.push(f);
    return unique;
  }

  teamWords(q, teams) {
    const words = Object.keys(TEAM_NICKNAMES).filter(n => hasPhrase(q.text, n));
    for (const { row } of teams) words.push(norm(row.teamFull), norm(row.team), ...distinctive(row.teamFull));
    return words;
  }

  // ------------------------------------------------------------ règles
  async rules(q) {
    const rules = findRules(q.text);
    if (!rules.length) {
      return clarification(`je connais pour l'instant les règles de base (${RULE_TOPICS}).`,
        ["Sur quelle règle porte ta question ?"]);
    }
    const ev = new Evidence(this.now);
    const id = ev.source({ ...IFAB_SOURCE, retrievedAt: this.now().toISOString() });
    for (const rule of rules.slice(0, 2)) ev.fact(`${rule.law} : ${rule.claim}`, [id]);
    ev.warn("Synthèse courte des Lois du Jeu ; les compétitions peuvent préciser certains points dans leur règlement.");
    return finalize(ev, { answer: rules[0].claim, extra: { phrasing: "modèle" } });
  }

  // ------------------------------------------------------------ informations générales
  async info(q) {
    const teams = await this.findTeams(q).catch(() => []);
    const subject = teams.length === 1 ? teams[0].row.teamFull : residualName(q.text, this.teamWords(q, teams));
    if (!subject) return clarification("le sujet n'est pas précisé.", ["De quel joueur ou de quelle équipe parles-tu ?"]);
    let page;
    try {
      page = await this.p.wiki(teams.length === 1 ? `${subject} club de football` : `${subject} footballeur`);
    } catch (error) {
      if (error instanceof UnavailableError && /ambigu/.test(error.reason)) {
        return clarification("plusieurs pages correspondent à ce nom.", ["Précise le nom complet, le club ou la nationalité."]);
      }
      throw error;
    }
    const tokens = norm(subject).split(" ").filter(w => w.length > 2);
    if (!tokens.every(t => norm(page.data.title).includes(t) || norm(page.data.extract).includes(t))) {
      return unverifiable([], `Je n'ai pas trouvé de page fiable correspondant exactement à « ${displayName(q.raw, norm(subject))} ».`);
    }
    const ev = new Evidence(this.now);
    const id = ev.source(page);
    const first = page.data.extract.split(/(?<=\.)\s/).slice(0, 2).join(" ").slice(0, 400);
    ev.fact(first, [id]);
    ev.warn(`Informations générales (page Wikipédia mise à jour le ${formatDateTime(page.data.updated || page.retrievedAt)}) : ` +
      "elles ne remplacent pas les statistiques récentes.");
    if (page.data.alternatives?.length) ev.warn(`Autres pages possibles : ${page.data.alternatives.join(", ")}.`);
    return this.finish(ev, first);
  }

  // ------------------------------------------------------------ classement
  async standings(q) {
    const wantsTeam = Object.keys(TEAM_NICKNAMES).some(n => hasPhrase(q.text, n))
      || ["place", "position", "classe", "rang", "points"].some(w => hasPhrase(q.text, w)) || !q.league;
    const teams = wantsTeam ? await this.findTeams(q) : [];
    if (!q.league && !teams.length) {
      return clarification("le championnat n'est pas précisé.", ["Quel championnat : Ligue 1, Premier League, Liga, Serie A ou Bundesliga ?"]);
    }
    if (teams.length > 1) {
      return clarification("plusieurs équipes correspondent.", [`De quelle équipe parles-tu : ${teams.map(t => t.row.team).join(", ")} ?`]);
    }
    const code = teams[0]?.code || q.league;
    const league = LEAGUES[code].name;
    const ev = new Evidence(this.now);
    const { ok, failed } = await this.primaryStandings(code);
    const secondary = await this.tryAll([() => this.p.tsdbTable(code), ...(code === "BL1" ? [() => this.p.olTable()] : [])]);
    for (const e of [...failed, ...secondary.failed]) ev.warn(`${e.provider} indisponible : ${e.reason || "quota gratuit atteint"}.`);
    const all = [...ok, ...secondary.ok].filter(r => r.data.length);
    if (!all.length) return this.noData(ev, [...failed, ...secondary.failed]);
    const primary = all[0];
    const others = all.slice(1);
    if (!ok.length) ev.warn("Fournisseur principal indisponible : réponse construite avec une source secondaire.");
    const rows = teams.length ? [primary.data.find(r => matchTeam(teams[0].row.teamFull, [r])) || null].filter(Boolean)
      : primary.data.slice(0, 5);
    if (!rows.length) return unverifiable(ev.warnings, `L'équipe n'apparaît pas dans le classement fourni par ${primary.provider}.`);
    for (const row of rows) this.compareRow(ev, row, primary, others);
    const top = rows[0];
    const template = teams.length
      ? `${top.team} est ${ordinal(top.position)} de ${league} avec ${top.points} points après ${top.played} matchs.`
      : `${top.team} est en tête de ${league} avec ${top.points} points après ${top.played} matchs.`;
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
    const base = `${ordinal(row.position)} : ${row.team} — ${row.points} pts en ${row.played} matchs`;
    if (!disagree.length) return ev.fact(base, agree);
    const variants = disagree.map(d => `${d.match.points} pts en ${d.match.played} matchs selon ${d.provider}` +
      (d.updated ? ` (mise à jour du ${d.updated})` : ""));
    ev.fact(`${row.team} : ${row.points} pts en ${row.played} matchs selon ${primary.provider} ; ${variants.join(" ; ")}`,
      [...agree, ...disagree.map(d => d.oid)], { conflict: true });
    ev.warn(`Désaccord entre les sources pour ${row.team} : valeurs affichées côte à côte, probablement un décalage de mise à jour.`);
  }

  // ------------------------------------------------------------ meilleurs buteurs
  async topScorers(q) {
    if (!q.league) {
      return clarification("le championnat n'est pas précisé.", ["Pour quel championnat : Ligue 1, Premier League, Liga, Serie A ou Bundesliga ?"]);
    }
    const fetchers = [];
    if (this.p.hasApiFootball()) fetchers.push(() => this.p.afTopScorers(q.league));
    fetchers.push(() => this.p.fdScorers(q.league));
    if (q.league === "BL1") fetchers.push(() => this.p.olScorers());
    const { ok, failed } = await this.tryAll(fetchers);
    const ev = new Evidence(this.now);
    for (const e of failed) ev.warn(`${e.provider} indisponible : ${e.reason || "quota gratuit atteint"}.`);
    const lists = ok.filter(r => r.data.length);
    if (!lists.length) return this.noData(ev, failed);
    const primary = lists[0];
    for (const s of primary.data.slice(0, 3)) {
      const pid = ev.source(primary);
      const agree = [pid], diff = [];
      for (const other of lists.slice(1)) {
        const m = other.data.find(o => norm(o.lastName || o.player).split(" ").pop() === norm(s.lastName || s.player).split(" ").pop());
        if (!m) continue;
        const oid = ev.source(other);
        if (m.goals === s.goals) agree.push(oid); else diff.push(`${m.goals} selon ${other.provider}`);
      }
      const who = s.team ? `${s.player} (${s.team})` : s.player;
      if (diff.length) {
        ev.fact(`${who} : ${s.goals} buts selon ${primary.provider} ; ${diff.join(" ; ")}`, agree, { conflict: true });
      } else {
        ev.fact(`${who} — ${s.goals} buts${s.matches ? ` en ${s.matches} matchs` : ""}`, agree);
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
      missing.push(`De quel « ${name} » parles-tu (nom complet, nationalité ou poste) ?`, "Dans quel club joue-t-il ?");
    } else if (teams.length > 1) {
      missing.push(`Dans quel club joue-t-il : ${teams.map(t => t.row.team).join(", ")} ?`);
    }
    if (!q.season) missing.push(`Pour quelle saison ? (seule la saison en cours, ${this.season}, est disponible gratuitement)`);
    if (!q.competition && !q.unsupported) missing.push("En championnat seulement, en Ligue des champions, ou toutes compétitions confondues ?");
    if (missing.length) {
      return clarification("plusieurs joueurs peuvent porter ce nom et le chiffre dépend du club, de la saison et des compétitions.", missing);
    }
    if (q.season === "other") {
      return unverifiable([], `Les sources gratuites configurées ne couvrent que la saison en cours (${this.season}), pas ${q.label}.`);
    }
    if (q.unsupported && q.competition !== "ALL") {
      return unverifiable([], `Les sources gratuites configurées ne couvrent pas ${q.unsupported}.`);
    }
    const { code, row: club } = teams[0];
    const scope = q.competition || "LEAGUE";
    const ev = new Evidence(this.now);
    const values = new Map(); // compétition → [{provider, value, sourceId}]
    const add = (comp, provider, value, sourceId) => {
      if (!values.has(comp)) values.set(comp, []);
      values.get(comp).push({ provider, value, sourceId });
    };
    const leagueName = LEAGUES[code].name;
    const failures = [];

    // 1. API-Football (prioritaire) : toutes les compétitions du joueur.
    if (this.p.hasApiFootball()) {
      try {
        const res = await this.p.afPlayers(code, player);
        const hits = res.data.filter(p => nameMatches(player, p));
        if (hits.length > 1) {
          return clarification("plusieurs joueurs correspondent.", [`Lequel : ${hits.map(h => `${h.player} (${h.nationality})`).join(", ")} ?`]);
        }
        if (hits.length) {
          const sid = ev.source(res);
          for (const c of hits[0].competitions.filter(c => matchTeam(club.teamFull, [{ team: c.team, teamFull: c.team }]))) {
            const key = /champions league/i.test(c.name) ? CHAMPIONS_LEAGUE.name : (matchTeam(leagueName, [{ team: c.name }]) ? leagueName : c.name);
            add(key, res.provider, c[stat], sid);
          }
        }
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
        failures.push(error);
        ev.warn(`API-Football indisponible : ${error.reason || "quota gratuit atteint"}.`);
      }
    }
    // 2. football-data.org : listes de buteurs (championnat + Ligue des champions).
    const fdComps = scope === "CL" ? ["CL"] : scope === "ALL" ? [code, "CL"] : [code];
    for (const comp of fdComps) {
      try {
        const res = await this.p.fdScorers(comp);
        const hits = res.data.filter(p => nameMatches(player, p) && matchTeam(club.teamFull, [{ team: p.team, teamFull: p.teamFull }]));
        if (hits.length === 1) add(comp === "CL" ? CHAMPIONS_LEAGUE.name : leagueName, res.provider, hits[0][stat], ev.source(res));
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
        failures.push(error);
        ev.warn(`football-data.org indisponible pour ${comp === "CL" ? CHAMPIONS_LEAGUE.name : leagueName} : ${error.reason || "quota gratuit atteint"}.`);
      }
    }
    // 3. OpenLigaDB (Bundesliga, buts uniquement).
    if (code === "BL1" && stat === "goals" && scope !== "CL") {
      try {
        const res = await this.p.olScorers();
        const last = norm(player).split(" ").pop();
        const hits = res.data.filter(g => norm(g.player).split(" ").pop() === last);
        if (hits.length === 1) add(leagueName, res.provider, hits[0].goals, ev.source(res));
      } catch (error) {
        if (!(error instanceof QuotaError || error instanceof UnavailableError)) throw error;
      }
    }

    const wanted = scope === "LEAGUE" ? [leagueName] : scope === "CL" ? [CHAMPIONS_LEAGUE.name] : [...values.keys()];
    const unit = stat === "goals" ? "buts" : "matchs joués";
    let total = 0, counted = 0;
    for (const comp of wanted) {
      const list = values.get(comp);
      if (!list?.length) continue;
      const distinct = [...new Set(list.map(v => v.value))];
      if (distinct.length === 1) {
        ev.fact(`${comp} : ${distinct[0]} ${unit} (${name}, ${club.team}, ${this.season})`, list.map(v => v.sourceId));
        total += distinct[0]; counted++;
      } else {
        ev.fact(`${comp} : ${list.map(v => `${v.value} ${unit} selon ${v.provider}`).join(" ; ")}`, list.map(v => v.sourceId), { conflict: true });
        ev.warn(`Désaccord entre les sources pour ${comp} : valeurs affichées côte à côte.`);
        counted = -Infinity;
      }
    }
    if (!ev.facts.length) {
      return this.noData(ev, failures, `Je n'ai trouvé « ${name} » (${club.team}) dans aucune donnée vérifiable pour ${this.season}.`);
    }
    if (scope === "ALL") {
      const covered = [...values.keys()].join(", ");
      ev.warn(`Total calculé sur les compétitions couvertes par les sources gratuites (${covered}) : coupes nationales ou autres compétitions absentes peuvent manquer.`);
    }
    const template = counted > 0
      ? (scope === "ALL"
        ? `${name} (${club.team}) compte au moins ${total} ${unit} cette saison dans les compétitions couvertes.`
        : `${name} (${club.team}) compte ${total} ${unit} en ${wanted[0]} cette saison.`)
      : `Les sources ne concordent pas sur le nombre de ${unit} de ${name} : voir le détail ci-dessous.`;
    return this.finish(ev, template);
  }

  // ------------------------------------------------------------ matchs
  async matches(q, kind) {
    const teams = await this.findTeams(q);
    if (!teams.length) return clarification("l'équipe n'est pas précisée.", ["De quelle équipe parles-tu ?"]);
    const distinctLeagues = new Set(teams.map(t => t.code));
    let team = teams[0], opponent = null;
    if (teams.length === 2 && distinctLeagues.size === 1) opponent = teams[1];
    else if (teams.length > 1) {
      return clarification("plusieurs équipes correspondent.", [`De quelle équipe parles-tu : ${teams.map(t => t.row.team).join(", ")} ?`]);
    }
    const res = await this.p.fdMatches(team.code);
    const involves = (m, t) => [m.homeFull, m.home, m.awayFull, m.away].some(n => n && matchTeam(t.row.teamFull, [{ team: n, teamFull: n }]));
    let list = res.data.filter(m => involves(m, team) && (!opponent || involves(m, opponent)));
    const ev = new Evidence(this.now);
    const sid = ev.source(res);
    const label = m => `${m.home} – ${m.away}`;
    if (kind === "last") {
      list = list.filter(m => m.status === "finished").sort((a, b) => a.date.localeCompare(b.date));
      const m = list[list.length - 1];
      if (!m) return unverifiable([], `Aucun match terminé trouvé pour ${team.row.team} sur les 3 dernières semaines.`);
      ev.fact(`${formatDate(m.date)}${m.matchday ? `, journée ${m.matchday}` : ""} : ${m.home} ${m.homeGoals} – ${m.awayGoals} ${m.away}`, [sid]);
      ev.warn("Offre gratuite de football-data.org : les scores sont transmis avec un léger différé.");
      return this.finish(ev, `Dernier match de ${team.row.team} : ${m.home} ${m.homeGoals} – ${m.awayGoals} ${m.away} le ${formatDate(m.date)}.`);
    }
    list = list.filter(m => m.status === "scheduled" || m.status === "live").sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) return unverifiable([], `Aucun match à venir trouvé pour ${team.row.team} dans les 5 prochaines semaines.`);
    const when = m => `${formatDate(m.date)} à ${m.timeConfirmed ? formatTime(m.date) : "horaire à confirmer"} (heure de Paris)`;
    const shown = kind === "schedule" ? list.slice(0, 5) : list.slice(0, 1);
    for (const m of shown) ev.fact(`${when(m)}${m.matchday ? `, journée ${m.matchday}` : ""} : ${label(m)}`, [sid]);
    ev.warn(`${LEAGUES[team.code].name} uniquement : les matchs de coupe ne sont pas couverts. Horaires susceptibles d'évoluer.`);
    const m0 = shown[0];
    const template = kind === "schedule"
      ? `Prochains matchs de ${team.row.team} en ${LEAGUES[team.code].name} : ${shown.length} rencontre${shown.length > 1 ? "s" : ""} programmée${shown.length > 1 ? "s" : ""}, la première le ${formatDate(m0.date)} (${label(m0)}).`
      : `Prochain match de ${team.row.team} : ${label(m0)} le ${when(m0)}.`;
    return this.finish(ev, template);
  }
}
