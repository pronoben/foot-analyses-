/* =========================================================
   CHATBOT – MOTEUR D'ANALYSE LOCAL
   ---------------------------------------------------------
   1. LocalBot.reply(question) : répond SANS IA aux questions
      d'analyse des matchs (pronostic, compo, absents, buts,
      comparaison, classement…), à partir des données du site.
   2. LocalBot.fullContext() : résumé complet de l'analyse du
      site, envoyé au chatbot IA (Claude) avec chaque question.
   ========================================================= */

const LocalBot = (() => {
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
  const P = x => Math.round(x * 100) + " %";
  const name = id => team(id).name;
  const ordinal = n => (n === 1 ? "1er" : n + "e");

  // Noms + surnoms de chaque club (définis dans js/leagues/*.js)
  function aliasList(teams = TEAMS) {
    const list = [];
    teams.forEach(t => {
      const aliases = new Set([norm(t.name), ...(t.aliases || []).map(norm)]);
      aliases.forEach(a => list.push({ id: t.id, alias: a }));
    });
    return list.sort((a, b) => b.alias.length - a.alias.length); // les plus longs d'abord (« paris fc » avant « paris »)
  }

  // Trouve les équipes citées, dans l'ordre où elles apparaissent
  function findTeams(text, teams = TEAMS) {
    let q = ` ${norm(text).replace(/[^a-z0-9 ]/g, " ")} `;
    const found = [];
    for (const { id, alias } of aliasList(teams)) {
      const re = new RegExp(`\\s${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`);
      const m = q.match(re);
      if (m) {
        if (!found.some(f => f.id === id)) found.push({ id, pos: m.index });
        q = q.replace(re, " " + "_".repeat(alias.length) + " ");
      }
    }
    return found.sort((a, b) => a.pos - b.pos).map(f => f.id);
  }

  const nextMatchOf = id => UPCOMING.find(m => m.home === id || m.away === id);
  const matchBetween = (a, b) => UPCOMING.find(m => (m.home === a && m.away === b) || (m.home === b && m.away === a));
  const row = id => Analysis.standings().find(t => t.id === id);
  const fmtDay = m => `${fmtDate(m.date)} à ${m.time.replace(":", "h")} (J${m.day})`;

  // ---------- Blocs de réponse ----------
  function predictionText(h, a) {
    const p = Analysis.predict(h, a);
    const fav = p.home >= p.away ? h : a;
    const favP = Math.max(p.home, p.away);
    const verdict = favP >= 0.55 ? `**${name(fav)}** est nettement favori.`
      : favP >= 0.42 ? `Léger avantage pour **${name(fav)}**.`
      : "Match très ouvert, aucun favori clair.";
    return `${verdict}\n- Victoire ${name(h)} : **${P(p.home)}**\n- Match nul : **${P(p.draw)}**\n- Victoire ${name(a)} : **${P(p.away)}**\n` +
      `- Buts attendus : ${p.expectedGoals[0].toFixed(2)} – ${p.expectedGoals[1].toFixed(2)}\n` +
      `- Score le plus probable : **${p.topScores[0].score}** (${(p.topScores[0].p * 100).toFixed(1)} %)`;
  }

  function teamStatsText(id) {
    const t = row(id), pos = Analysis.position(id);
    return `**${t.name}** : ${ordinal(pos)} avec ${t.pts} pts (${t.W}V ${t.D}N ${t.L}D), ` +
      `${t.GF} buts marqués (${(t.GF / t.P).toFixed(1)}/match), ${t.GA} encaissés (${(t.GA / t.P).toFixed(1)}/match).`;
  }

  function lineupText(id) {
    const l = savedLineupFor(id, name(id));
    if (!l) return `Je n'ai pas de composition enregistrée pour ${name(id)}.`;
    const lines = l.lignes.map((line, i) => {
      const n = l.lignes.length;
      const label = i === 0 ? "Gardien" : i === n - 1 ? "Attaque" : i === 1 ? "Défense" : (n === 5 && i === 3) ? "Milieu offensif" : "Milieu";
      return `- ${label} : ${line.map(p => p.nom).join(", ")}`;
    }).join("\n");
    return `Composition probable de **${name(id)}** (${l.schema_tactique}) :\n${lines}\n*Source : ${SAVED_LINEUPS_INFO.source.titre}, à confirmer.*`;
  }

  function absentsText(id) {
    const l = savedLineupFor(id, name(id));
    if (!l) return `Pas d'infos d'absences enregistrées pour ${name(id)}.`;
    if (!l.absents.length) return `Aucun absent signalé pour ${name(id)}.`;
    return `Absents / incertains pour **${name(id)}** : ${l.absents.map(a => `${a.nom}${a.raison !== "Absent" ? ` (${a.raison.toLowerCase()})` : ""}`).join(", ")}.\n*Infos du ${SAVED_LINEUPS_INFO.date}, à vérifier avant le match.*`;
  }

  function analysisText(h, a, m) {
    const head = m ? `**${name(h)} – ${name(a)}**, ${fmtDay(m)}` : `**${name(h)} – ${name(a)}** (match fictif : ${name(h)} à domicile)`;
    const insights = Analysis.preMatchInsights(h, a).map(i => `- ${i.text}`).join("\n");
    const absH = savedLineupFor(h, name(h)), absA = savedLineupFor(a, name(a));
    const abs = absH && absA
      ? `\n\n**Absents notables** : ${name(h)} : ${absH.absents.map(x => x.nom).join(", ") || "aucun"} · ${name(a)} : ${absA.absents.map(x => x.nom).join(", ") || "aucun"}.`
      : "";
    return `${head}\n\n**Rapport de forces**\n- ${teamStatsText(h)}\n- ${teamStatsText(a)}\n\n**Pronostic du modèle**\n${predictionText(h, a)}\n\n**Points clés**\n${insights}${abs}`;
  }

  function journeeRanking(kind) {
    if (!UPCOMING.length) return "Aucun match programmé.";
    const day = Math.min(...UPCOMING.map(m => m.day));
    const list = UPCOMING.filter(m => m.day === day).map(m => ({ m, p: Analysis.predict(m.home, m.away) }));
    const label = ({ m }) => `${name(m.home)} – ${name(m.away)}`;
    if (kind === "goals") {
      const s = [...list].sort((x, y) => (y.p.expectedGoals[0] + y.p.expectedGoals[1]) - (x.p.expectedGoals[0] + x.p.expectedGoals[1]));
      return `Matchs de la J${day} avec le plus de buts attendus :\n` + s.slice(0, 3).map(x =>
        `- ${label(x)} : ${(x.p.expectedGoals[0] + x.p.expectedGoals[1]).toFixed(1)} buts attendus, +2,5 buts à ${P(x.p.over25)}`).join("\n");
    }
    if (kind === "open") {
      const s = [...list].sort((x, y) => Math.max(x.p.home, x.p.away) - Math.max(y.p.home, y.p.away));
      return `Matchs les plus serrés de la J${day} :\n` + s.slice(0, 3).map(x =>
        `- ${label(x)} : ${P(x.p.home)} / ${P(x.p.draw)} / ${P(x.p.away)}`).join("\n");
    }
    // plus gros favoris
    const s = [...list].sort((x, y) => Math.max(y.p.home, y.p.away) - Math.max(x.p.home, x.p.away));
    return `Plus gros favoris de la J${day} :\n` + s.slice(0, 3).map(x => {
      const fav = x.p.home >= x.p.away ? x.m.home : x.m.away;
      return `- **${name(fav)}** dans ${label(x)} (${P(Math.max(x.p.home, x.p.away))})`;
    }).join("\n");
  }

  const HELP = "Je peux analyser les matchs de Ligue 1, Premier League, Liga, Serie A et Bundesliga. Exemples :\n" +
    "- « Analyse Lille – Lyon »\n- « Qui va gagner Nice PSG ? »\n- « Compo probable de l'OM »\n" +
    "- « Absents du PSG »\n- « Y aura-t-il plus de 2,5 buts entre Lens et Toulouse ? »\n" +
    "- « Quel est le match le plus serré de la journée ? »\n- « Compare Rennes et Brest »\n- « Comment marche le pronostic ? »\n" +
    "Et sur les joueurs :\n- « Combien de buts a marqué Sinayoko ? »\n- « Meilleurs passeurs »\n- « Compare Gouiri et Wahi »\n" +
    "Et dans les autres championnats :\n- « Qui va gagner Liverpool – Man United ? »\n- « Stats de Haaland »\n- « Classement de la Liga »";

  // ---------- Compréhension de la question ----------
  let lastTeams = []; // pour les questions de suite (« et les absents ? »)
  let lastSubject = null; // "player" ou "team"

  function replyInLeague(question) {
    const q = norm(question);
    const has = re => re.test(q);
    let teams = findTeams(question);
    const followUp = /^(et|pour|du coup)\b|ce match|cette rencontre|\bils?\b|\beux\b|\bleurs?\b|\bses\b|\bson\b|\bsa\b|\bce choc\b|\blui\b/.test(q);

    // Questions sur les joueurs (js/chat-players.js)
    const playerAnswer = PlayerBot.reply(question, q, teams, followUp && lastSubject === "player");
    if (playerAnswer) { lastSubject = "player"; return playerAnswer; }
    lastSubject = "team";

    if (!teams.length && followUp && lastTeams.length) teams = lastTeams;
    if (teams.length) lastTeams = teams;
    const [t1, t2] = teams;

    // Questions sur la méthode
    if (has(/(comment|explique).*(calcul|modele|pronostic|prono|marche|fonctionne)|poisson|methode/)) {
      return "Le pronostic du site utilise une **loi de Poisson**, un modèle classique en football :\n" +
        "- On calcule la force offensive (buts marqués) et défensive (buts encaissés) de chaque équipe, comparées à la moyenne du championnat.\n" +
        "- Comme il n'y a qu'une dizaine de matchs joués, ces forces sont « lissées » vers la moyenne pour éviter les excès.\n" +
        "- On en déduit les buts attendus de chaque équipe (+12 % pour l'équipe à domicile), puis la probabilité de chaque score (0-0, 1-0, 2-1…).\n" +
        "- En additionnant les scores, on obtient victoire / nul / défaite, plus de 2,5 buts, etc.\n" +
        "_Limites : le modèle ne connaît pas les blessures, la forme récente ni la motivation._";
    }

    // Classements de la journée (sans équipe citée)
    if (!t1) {
      if (has(/plus (de )?buts|plus offensi|spectacle|prolifique/)) return journeeRanking("goals");
      if (has(/serre|equilibre|ouvert|incertain|indecis/)) return journeeRanking("open");
      if (has(/favori|surs?|banker|plus probable|valeur sure/)) return journeeRanking("fav");
      if (has(/meilleure? attaque/)) { const t = [...Analysis.standings()].sort((a, b) => b.GF - a.GF)[0]; return `Meilleure attaque : **${t.name}** avec ${t.GF} buts (${(t.GF / t.P).toFixed(1)} par match).`; }
      if (has(/meilleure? defense/)) { const t = [...Analysis.standings()].sort((a, b) => a.GA - b.GA)[0]; return `Meilleure défense : **${t.name}** avec seulement ${t.GA} buts encaissés.`; }
      if (has(/pire defense|encaisse le plus/)) { const t = [...Analysis.standings()].sort((a, b) => b.GA - a.GA)[0]; return `Défense la plus faible : **${t.name}** avec ${t.GA} buts encaissés.`; }
      if (has(/classement|leader|premier|podium|top|relegation|releg|dernier/)) {
        const tb = Analysis.standings();
        return `Classement ${CURRENT_LEAGUE.name} (${DATA_INFO.live ? "en direct" : DATA_INFO.label}) :\n` +
          tb.slice(0, 5).map((t, i) => `- ${i + 1}. ${t.name} – ${t.pts} pts`).join("\n") +
          `\n…\n` + tb.slice(-3).map((t, i) => `- ${tb.length - 2 + i}. ${t.name} – ${t.pts} pts`).join("\n");
      }
      if (has(/meilleur buteur|buteurs?/) === false && has(/championnat|ligue|league|liga|serie|bundesliga/)) {
        const k = Analysis.seasonKpis();
        return `${CURRENT_LEAGUE.flag} **${CURRENT_LEAGUE.name}** : ${k.leader.name} en tête avec ${k.leader.pts} pts. ${k.goals} buts en ${k.matches} matchs (${k.goalsPerMatch} par match).\n` +
          `Demande-moi le classement, les matchs de la journée, une analyse de match ou les stats d'un joueur.`;
      }
      if (has(/prochain|journee|programme|calendrier|match|week/)) {
        const day = Math.min(...UPCOMING.map(m => m.day));
        return `Matchs de la J${day} :\n` + UPCOMING.filter(m => m.day === day).map(m => {
          const p = Analysis.predict(m.home, m.away);
          const fav = p.home >= p.away ? m.home : m.away;
          return `- ${fmtDate(m.date)} ${m.time.replace(":", "h")} : ${name(m.home)} – ${name(m.away)} (favori : ${name(fav)}, ${P(Math.max(p.home, p.away))})`;
        }).join("\n");
      }
      if (has(/but/)) { const k = Analysis.seasonKpis(); return `${k.goals} buts en ${k.matches} matchs cette saison, soit **${k.goalsPerMatch} par match**. ${k.drawPct} % de matchs nuls.`; }
      return HELP;
    }

    // Une ou deux équipes citées : on identifie le match concerné
    let h, a, m = null;
    if (t2) {
      m = matchBetween(t1, t2);
      [h, a] = m ? [m.home, m.away] : [t1, t2];
    } else {
      m = nextMatchOf(t1);
      if (m) [h, a] = [m.home, m.away];
    }

    if (has(/compo|composition|onze|titulaire|alignement|equipe type|qui joue/)) {
      return teams.slice(0, 2).map(lineupText).join("\n\n");
    }
    if (has(/absent|bless|suspen|forfait|indisponible|incertain|infirmerie/)) {
      return teams.slice(0, 2).map(absentsText).join("\n\n");
    }
    if (!h) return `${teamStatsText(t1)}\nPas de match programmé pour ${name(t1)} dans les prochains jours.`;

    const p = Analysis.predict(h, a);
    if (has(/plus de|moins de|over|under|2[.,]5|nombre de buts|combien de buts|beaucoup de buts/)) {
      return `**${name(h)} – ${name(a)}** : ${p.expectedGoals[0].toFixed(2)} + ${p.expectedGoals[1].toFixed(2)} = **${(p.expectedGoals[0] + p.expectedGoals[1]).toFixed(1)} buts attendus**.\n` +
        `- Plus de 2,5 buts : **${P(p.over25)}**\n- Moins de 2,5 buts : **${P(1 - p.over25)}**`;
    }
    if (has(/deux equipes marquent|2 equipes marquent|btts|les deux marquent/)) {
      return `**${name(h)} – ${name(a)}** : probabilité que les deux équipes marquent : **${P(p.btts)}**.`;
    }
    if (has(/score exact|quel score|score probable|scores/)) {
      return `Scores les plus probables pour **${name(h)} – ${name(a)}** :\n` +
        p.topScores.slice(0, 5).map(s => `- ${s.score} : ${(s.p * 100).toFixed(1)} %`).join("\n");
    }
    if (!t2 && has(/classement|place|position|rang|stat|bilan|forme|attaque|defense|but/)) {
      return teamStatsText(t1);
    }
    if (has(/gagn|vainqueur|favori|prono|qui va|chance|victoire|perdre|nul/) && !has(/analys/)) {
      return `**${name(h)} – ${name(a)}**${m ? `, ${fmtDay(m)}` : " (match fictif)"}\n${predictionText(h, a)}`;
    }
    return analysisText(h, a, m);
  }

  // ---------- Choix automatique du championnat ----------
  const LEAGUE_KEYWORDS = [
    ["L1", /ligue 1|championnat de france|\bl1\b/],
    ["PL", /premier league|angleterre|anglais|\bpl\b|\bepl\b/],
    ["LIGA", /\bliga\b|espagne|espagnol/],
    ["SA", /serie a|italie|italien|calcio/],
    ["BL", /bundesliga|allemagne|allemand/],
  ];

  function detectLeague(question) {
    const q = norm(question);
    const cur = CURRENT_LEAGUE.id;
    const kw = LEAGUE_KEYWORDS.find(([, re]) => re.test(q));
    if (kw) return kw[0];
    if (findTeams(question).length) return cur;
    for (const id of LEAGUE_ORDER) {
      if (id !== cur && findTeams(question, LEAGUES[id].teams).length) return id;
    }
    if (PlayerBot.find(question).length) return cur;
    for (const id of LEAGUE_ORDER) {
      if (id === cur) continue;
      setLeague(id);
      const hit = PlayerBot.find(question).length > 0;
      setLeague(cur);
      if (hit) return id;
    }
    return cur;
  }

  function reply(question) {
    const target = detectLeague(question);
    let prefix = "";
    if (target !== CURRENT_LEAGUE.id) {
      switchLeague(target, { keepView: true }); // change aussi l'affichage du site
      lastTeams = [];
      lastSubject = null;
      prefix = `*(Je passe sur ${LEAGUES[target].flag} ${LEAGUES[target].name}.)*\n\n`;
    }
    const answer = replyInLeague(question);
    return prefix + answer + (lastSubject === "player" && !findTeams(question).length ? namesakesNote(question) : "");
  }

  // Signale un joueur du même nom dans un autre championnat (ex. Mbappé)
  function namesakesNote(question) {
    const cur = CURRENT_LEAGUE.id;
    const others = [];
    LEAGUE_ORDER.filter(id => id !== cur).forEach(id => {
      setLeague(id);
      PlayerBot.find(question).forEach(p => others.push(`${p.name} (${name(p.team)}, ${CURRENT_LEAGUE.name})`));
      setLeague(cur);
    });
    return others.length
      ? `\n\n*Il existe aussi : ${others.slice(0, 3).join(", ")}. Précise le club pour le voir, par ex. « ${question.trim().replace(/[?!.\s]+$/, "")} du ${others[0].split(" (")[1].split(",")[0]} ».*`
      : "";
  }

  // ---------- Contexte complet pour l'IA ----------
  function fullContext() {
    const src = DATA_INFO.live ? `en direct, mises à jour le ${DATA_INFO.fetchedAt}` : `enregistrées, ${DATA_INFO.label}`;
    const table = Analysis.standings().map((t, i) =>
      `${i + 1}. ${t.name} – ${t.pts} pts (${t.P} J, ${t.W}V ${t.D}N ${t.L}D, buts ${t.GF}-${t.GA}, ${(t.GF / t.P).toFixed(2)} marqués/match, ${(t.GA / t.P).toFixed(2)} encaissés/match)`).join("\n");
    const matches = UPCOMING.slice(0, 18).map(m => {
      const p = Analysis.predict(m.home, m.away);
      const ins = Analysis.preMatchInsights(m.home, m.away).map(i => `  • ${i.text}`).join("\n");
      const lu = id => {
        const l = savedLineupFor(id, name(id));
        return l ? `  Compo probable ${name(id)} (${l.schema_tactique}) : ${l.lignes.map(line => line.map(x => x.nom).join(", ")).join(" / ")}. Absents : ${l.absents.map(x => `${x.nom} (${x.raison})`).join(", ") || "aucun"}.` : "";
      };
      return `- J${m.day} ${m.date} ${m.time} : ${name(m.home)} (${ordinal(Analysis.position(m.home))}) – ${name(m.away)} (${ordinal(Analysis.position(m.away))})\n` +
        `  Modèle : ${P(p.home)} / nul ${P(p.draw)} / ${P(p.away)} ; buts attendus ${p.expectedGoals[0].toFixed(2)}-${p.expectedGoals[1].toFixed(2)} ; +2,5 buts ${P(p.over25)} ; les deux marquent ${P(p.btts)} ; scores probables ${p.topScores.slice(0, 3).map(s => s.score).join(", ")}\n` +
        `  Analyse du site :\n${ins}\n${lu(m.home)}\n${lu(m.away)}`;
    }).join("\n");
    return `CHAMPIONNAT AFFICHÉ : ${CURRENT_LEAGUE.name} ${DATA_INFO.season} (données ${src})\n\nCLASSEMENT\n${table}\n\nPROCHAINS MATCHS (avec analyse du site)\n${matches}\n\n` +
      `Compositions : ${SAVED_LINEUPS_INFO.source.titre} (${SAVED_LINEUPS_INFO.source.url}), à confirmer.\n\n` +
      PlayerBot.context() + "\n\n" + otherLeaguesContext();
  }

  // Résumé des autres championnats (classement, matchs à venir, buteurs)
  function otherLeaguesContext() {
    const cur = CURRENT_LEAGUE.id;
    const parts = LEAGUE_ORDER.filter(id => id !== cur).map(id => {
      setLeague(id);
      const table = Analysis.standings().map((t, i) => `${i + 1}. ${t.name} ${t.pts} pts (${t.P} J, ${t.GF}-${t.GA})`).join(" ; ");
      const matches = UPCOMING.map(m => {
        const p = Analysis.predict(m.home, m.away);
        return `J${m.day} ${m.date} ${m.time} ${name(m.home)} – ${name(m.away)} (${P(p.home)}/${P(p.draw)}/${P(p.away)})`;
      }).join(" ; ");
      const scorers = PLAYERS.filter(p => p.goals != null).sort((a, b) => b.goals - a.goals).slice(0, 8)
        .map(p => `${p.name} (${name(p.team)}) ${p.goals} buts${p.assists != null ? `, ${p.assists} passes` : ""}`).join(" ; ");
      return `AUTRE CHAMPIONNAT : ${CURRENT_LEAGUE.name} (${DATA_INFO.live ? "en direct" : DATA_INFO.label})\nClassement : ${table}\nProchains matchs (modèle du site) : ${matches}\nMeilleurs buteurs : ${scorers}`;
    });
    setLeague(cur);
    return parts.join("\n\n");
  }

  return { reply, fullContext, findTeams };
})();
