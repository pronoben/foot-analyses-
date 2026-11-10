/* =========================================================
   CHATBOT – QUESTIONS SUR LES JOUEURS
   ---------------------------------------------------------
   Répond sans IA aux questions sur les statistiques des
   joueurs : buts, passes décisives, penalties, matchs joués,
   ratio, classement des buteurs/passeurs, comparaison,
   place dans la composition probable, absences.
   Données : js/players-data.js + js/lineups-data.js
   ========================================================= */

const PlayerBot = (() => {
  const norm = s => String(s).toLowerCase()
    .replace(/ø/g, "o").replace(/æ/g, "ae").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’'-]/g, " ").replace(/[^a-z0-9. ]/g, " ").replace(/\s+/g, " ").trim();
  const fr = (x, d = 1) => x.toFixed(d).replace(".", ",");
  const ordinal = n => (n === 1 ? "1er" : n + "e");
  const teamName = id => (team(id) ? team(id).name : id);

  // Mots courants qui sont aussi des noms de joueurs : on les ignore seuls
  const STOP = new Set(["mille", "restes", "danois", "karim", "bretelle", "simon", "andre", "peter", "lefort", "dia"]);

  const nameParts = full => {
    const words = norm(full).split(" ");
    const initial = words.length > 1 && /^[a-z]\.$/.test(words[0]) ? words[0][0] : null;
    const rest = words.filter(w => !/^[a-z]\.$/.test(w));
    return { initial, full: rest.join(" "), last: rest[rest.length - 1] || "" };
  };
  const lineLabel = (i, n) => (i === 0 ? "gardien" : i === n - 1 ? "attaquant" : i === 1 ? "défenseur" : (n === 5 && i === 3) ? "milieu offensif" : "milieu");

  // Index de tous les joueurs connus : stats + compos probables + absents
  function buildIndex() {
    const index = [];
    const add = (name, teamId, info) => {
      const p = nameParts(name);
      // Même joueur si même club, même nom de famille et première lettre du prénom compatible
      // (« Lautaro Martínez » ≠ « J. Martínez », mais « F. Torres » = « Ferran Torres »)
      const first = q => q.initial || (q.full.includes(" ") ? q.full[0] : null);
      let e = index.find(x => x.team === teamId && x.parts.last === p.last &&
        (!first(x.parts) || !first(p) || first(x.parts) === first(p)));
      if (!e) { e = { name, team: teamId, parts: p }; index.push(e); }
      // On garde le nom le plus complet pour l'affichage
      const { name: newName, ...rest } = info;
      if (newName && newName.length > e.name.length) e.name = newName;
      Object.assign(e, rest);
    };
    PLAYERS.forEach(s => add(s.name, s.team, { stats: s, name: s.name }));
    Object.entries(SAVED_LINEUPS_RAW).forEach(([tid, raw]) => {
      const teamId = TEAMS.some(t => t.id === tid) ? tid : (TEAMS.find(t => raw.names.some(n => norm(t.name).includes(norm(n)))) || {}).id || tid;
      raw.lines.forEach((line, i) => line.split("|").forEach(slot => {
        const [main, alt] = slot.split("(ou").map(x => x.replace(")", "").trim());
        add(main, teamId, { role: lineLabel(i, raw.lines.length), formation: raw.formation, alternative: alt || null });
        if (alt) add(alt, teamId, { role: lineLabel(i, raw.lines.length), formation: raw.formation, alternativeTo: main });
      }));
      raw.absents.forEach(([n, why]) => add(n, teamId, { absent: why }));
    });
    return index;
  }

  // Trouve les joueurs cités dans la question
  function find(question, teams = []) {
    const q = ` ${norm(question)} `;
    const qNoDots = q.replace(/\./g, " ");
    const hits = [];
    for (const e of buildIndex()) {
      const { full, last, initial } = e.parts;
      const fullHit = full.length >= 4 && full.includes(" ") && qNoDots.includes(` ${full} `);
      const lastHit = last.length >= 3 && qNoDots.includes(` ${last} `);
      // Prénom seul (« Lautaro », « Raphinha ») quand le nom complet est connu
      const firstName = !initial && full.includes(" ") ? full.split(" ")[0] : null;
      const firstHit = firstName && firstName.length >= 5 && !STOP.has(firstName) && qNoDots.includes(` ${firstName} `);
      if (!fullHit && !lastHit && !firstHit) continue;
      const initialHit = initial && new RegExp(` ${initial}\\.? ${last} `).test(q);
      if (!fullHit && !initialHit && STOP.has(last) && !teams.includes(e.team)) continue;
      hits.push({ e, score: (fullHit ? 3 : 0) + (initialHit || firstHit ? 2 : 0) + (teams.includes(e.team) ? 1 : 0) });
    }
    // Pour un même nom de famille, on garde les meilleurs candidats
    const byLast = {};
    hits.forEach(h => { (byLast[h.e.parts.last] ||= []).push(h); });
    const out = [];
    Object.values(byLast).forEach(list => {
      list.sort((a, b) => b.score - a.score);
      const best = list.filter(h => h.score === list[0].score);
      out.push(...best.map(h => h.e));
    });
    return out;
  }

  // ---------- Réponses ----------
  const scorersRank = p => 1 + PLAYERS.filter(x => (x.goals ?? -1) > p.goals).length;

  function card(e) {
    const s = e.stats;
    const lines = [`**${e.name}** (${teamName(e.team)})`];
    if (s) {
      if (s.goals != null) {
        const pen = s.penalties ? ` dont ${s.penalties} sur penalty` : "";
        lines.push(`- Buts : **${s.goals}**${pen} — ${ordinal(scorersRank(s))} au classement des buteurs`);
      }
      if (s.assists != null) lines.push(`- Passes décisives : **${s.assists}**`);
      if (s.total != null) lines.push(`- Buts + passes : **${s.total}**${s.matches ? ` en ${s.matches} matchs (${fr(s.total / s.matches, 2)} par match)` : ""}`);
      else if (s.matches) lines.push(`- Matchs joués : ${s.matches}`);
      if (s.minutes && s.goals) lines.push(`- Temps de jeu ≈ ${s.minutes} min, soit un but toutes les ${Math.round(s.minutes / s.goals)} min`);
      if (s.goals == null) lines.push(`- Répartition buts / passes non disponible dans les sources`);
    } else {
      lines.push(`- Pas dans les classements des buteurs et passeurs (moins de 2 buts et moins de 4 buts + passes).`);
      lines.push(`- *Avec l'IA activée, je peux chercher ses stats détaillées sur le web.*`);
    }
    if (e.absent) lines.push(`- ⚠️ Indisponible pour l'instant : ${e.absent.toLowerCase()}`);
    else if (e.role) lines.push(`- Compo probable : titulaire, ${e.role} (${e.formation})${e.alternative ? `, en concurrence avec ${e.alternative}` : ""}${e.alternativeTo ? ` — alternative à ${e.alternativeTo}` : ""}`);
    return lines.join("\n");
  }

  function compare(a, b) {
    const s1 = a.stats || {}, s2 = b.stats || {};
    const v = x => (x == null ? "?" : x);
    const row = (label, x, y) => `- ${label} : ${v(x)} vs ${v(y)}`;
    const ratio = s => (s.goals != null && s.matches ? fr(s.goals / s.matches, 2) : null);
    let verdict = "";
    if (s1.total != null && s2.total != null && s1.total !== s2.total) {
      const best = s1.total > s2.total ? a : b;
      verdict = `\n➡️ **${best.name}** est le plus décisif (buts + passes).`;
    } else if (s1.goals != null && s2.goals != null && s1.goals !== s2.goals) {
      verdict = `\n➡️ **${s1.goals > s2.goals ? a.name : b.name}** a marqué le plus.`;
    }
    return `**${a.name}** (${teamName(a.team)}) vs **${b.name}** (${teamName(b.team)})\n` +
      [row("Buts", s1.goals, s2.goals), row("Passes décisives", s1.assists, s2.assists), row("Buts + passes", s1.total, s2.total),
        row("Matchs", s1.matches, s2.matches), row("Buts par match", ratio(s1), ratio(s2)), row("Penalties marqués", s1.penalties, s2.penalties)].join("\n") + verdict;
  }

  function ranking(kind, teamId) {
    let list = PLAYERS.filter(p => !teamId || p.team === teamId);
    const where = teamId ? ` de ${teamName(teamId)}` : "";
    const fmt = (p, i, val) => `${i + 1}. ${p.name} (${teamName(p.team)}) – ${val}`;
    let title, key;
    if (kind === "assists") { title = `Meilleurs passeurs${where}`; key = "assists"; }
    else if (kind === "total") { title = `Joueurs les plus décisifs (buts + passes)${where}`; key = "total"; }
    else if (kind === "penalties") { title = `Buts sur penalty${where}`; key = "penalties"; }
    else if (kind === "ratio") {
      list = list.filter(p => p.goals != null && p.matches >= 4).sort((a, b) => b.goals / b.matches - a.goals / a.matches);
      if (!list.length) return `Pas assez de données pour calculer les ratios${where}.`;
      return `Meilleurs ratios buts par match${where} (4 matchs minimum) :\n` +
        list.slice(0, 8).map((p, i) => `- ${fmt(p, i, `${fr(p.goals / p.matches, 2)} but/match (${p.goals} en ${p.matches})`)}`).join("\n");
    } else { title = `Meilleurs buteurs${where}`; key = "goals"; }
    list = list.filter(p => p[key] != null && p[key] > 0).sort((a, b) => b[key] - a[key]);
    if (!list.length) return `Je n'ai pas de joueur${where} dans ce classement (seuls les meilleurs de Ligue 1 sont enregistrés).`;
    const unit = { goals: "buts", assists: "passes déc.", total: "B+PD", penalties: "pen." }[key];
    const note = key === "assists" && !PLAYER_STATS_INFO.live ? "\n*Passes connues seulement pour les joueurs dont on a le détail buts/passes.*" : "";
    return `${title} :\n` + list.slice(0, teamId ? 6 : 10).map((p, i) => `- ${fmt(p, i, `**${p[key]}** ${unit}`)}`).join("\n") + note;
  }

  const source = () => `\n*Stats ${PLAYER_STATS_INFO.label}.*`;

  /**
   * Renvoie une réponse si la question concerne les joueurs, sinon null.
   * @param q question normalisée ; teams = équipes citées ; followUp = question de suite
   */
  let lastPlayers = [];
  function reply(question, q, teams, useLastPlayers) {
    const has = re => re.test(q);
    let players = find(question, teams);
    if (!players.length && useLastPlayers && lastPlayers.length && !teams.length) players = lastPlayers;

    if (players.length) {
      lastPlayers = players.slice(0, 2);
      const sameLast = players.length > 1 && players.every(p => p.parts.last === players[0].parts.last);
      if (sameLast) {
        return `Plusieurs joueurs s'appellent ainsi, lequel ?\n` + players.slice(0, 5).map(p => `- ${p.name} (${teamName(p.team)})`).join("\n") +
          `\n*Précise l'initiale ou le club, par ex. « ${players[0].name} de ${teamName(players[0].team)} ».*`;
      }
      if (players.length >= 2 && has(/compar|\bvs\b|\bou\b|mieux|meilleur|plus fort|plus decisif|contre|face a|\bet\b/)) {
        return compare(players[0], players[1]) + source();
      }
      return players.slice(0, 3).map(card).join("\n\n") + source();
    }

    const teamId = teams[0];
    if (has(/passeur|passes? d|passe dec|assist|offrande/)) return ranking("assists", teamId) + source();
    if (has(/penalt|penalty|tireur/)) return ranking("penalties", teamId) + source();
    if (has(/decisif|buts? (et|\+) pass|b\s?\+\s?pd|meilleur joueur|plus influent/)) return ranking("total", teamId) + source();
    if (has(/ratio|par match|plus efficace|efficacite/) && has(/joueur|buteur|attaquant|marque/)) return ranking("ratio", teamId) + source();
    if (teamId && has(/joueurs?|stats? des joueurs|effectif/) && !has(/buteur|passeur/)) {
      const list = PLAYERS.filter(p => p.team === teamId).sort((a, b) => (b.total ?? b.goals) - (a.total ?? a.goals));
      if (!list.length) return `Aucun joueur de ${teamName(teamId)} dans les classements des buteurs et passeurs.` + source();
      return `Joueurs décisifs de ${teamName(teamId)} :\n` + list.map(p =>
        `- **${p.name}** : ${p.goals != null ? `${p.goals} but(s), ${p.assists ?? "?"} passe(s)` : `${p.total} buts + passes (détail non disponible)`}${p.matches ? ` en ${p.matches} matchs` : ""}`).join("\n") + source();
    }
    if (has(/buteur|qui marque|qui a marque|marque le plus|plus de buts? (en|cette)|top scorer|soulier|goleador|meilleur attaquant/)) {
      return ranking("goals", teamId) + source();
    }
    if (has(/stat|joueur/) && !teamId && has(/joueur/)) {
      return "Je connais les statistiques des meilleurs joueurs de Ligue 1. Exemples :\n" +
        "- « Combien de buts a marqué Sinayoko ? »\n- « Stats de Thauvin »\n- « Meilleurs passeurs »\n" +
        "- « Meilleur buteur de l'OM »\n- « Compare Gouiri et Wahi »\n- « Qui a le meilleur ratio buts par match ? »";
    }
    return null;
  }

  // Résumé pour le chatbot IA
  function context() {
    const rows = PLAYERS.map(p => `- ${p.name} (${teamName(p.team)}) : buts ${p.goals ?? "?"}${p.penalties ? ` (dont ${p.penalties} pen.)` : ""}, passes ${p.assists ?? "?"}, B+PD ${p.total ?? "?"}, matchs ${p.matches ?? "?"}${p.minutes ? `, ≈${p.minutes} min` : ""}`);
    return `STATISTIQUES DES JOUEURS (${PLAYER_STATS_INFO.label} ; « ? » = non disponible)\n${rows.join("\n")}`;
  }

  return { reply, find, context };
})();
