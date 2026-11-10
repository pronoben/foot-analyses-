/* =========================================================
   MOTEUR D'ANALYSE
   Fonctions « pures » réutilisables par le futur chatbot.
   ========================================================= */

const Analysis = {
  teamById(id) {
    return TEAMS.find(t => t.id === id);
  },

  // Classement trié, enrichi du nom, de la couleur et de la différence de buts
  standings() {
    return STANDINGS
      .map(s => ({ ...s, ...this.teamById(s.id), GD: s.GF - s.GA }))
      .sort((x, y) => y.pts - x.pts || y.GD - x.GD || y.GF - x.GF);
  },

  position(id) {
    return this.standings().findIndex(t => t.id === id) + 1;
  },

  seasonKpis() {
    const table = this.standings();
    const goals = table.reduce((s, t) => s + t.GF, 0);
    const matches = table.reduce((s, t) => s + t.P, 0) / 2;
    const draws = table.reduce((s, t) => s + t.D, 0) / 2;
    return {
      matches,
      goals,
      goalsPerMatch: (goals / matches).toFixed(2),
      drawPct: Math.round((draws / matches) * 100),
      leader: table[0],
    };
  },

  // Force offensive / défensive par rapport à la moyenne de la ligue.
  // Après seulement 10 matchs, on « tire » les valeurs vers la moyenne
  // (5 matchs fictifs moyens) pour éviter des pronostics extrêmes.
  teamStrengths() {
    const table = this.standings();
    const totalP = table.reduce((s, t) => s + t.P, 0);
    const avg = table.reduce((s, t) => s + t.GF, 0) / totalP; // buts par équipe et par match
    const PRIOR = 5;
    const res = {};
    table.forEach(t => {
      res[t.id] = {
        attack: (t.GF + avg * PRIOR) / (t.P + PRIOR) / avg,
        defense: (t.GA + avg * PRIOR) / (t.P + PRIOR) / avg,
      };
    });
    return { strengths: res, avg };
  },

  // Pronostic par loi de Poisson
  predict(homeId, awayId) {
    const { strengths, avg } = this.teamStrengths();
    const HOME_ADV = 1.12;
    const lh = strengths[homeId].attack * strengths[awayId].defense * avg * HOME_ADV;
    const la = strengths[awayId].attack * strengths[homeId].defense * avg / HOME_ADV;

    const pois = (k, l) => Math.exp(-l) * Math.pow(l, k) / this._fact(k);
    let pH = 0, pD = 0, pA = 0, over25 = 0, btts = 0;
    const scores = [];
    for (let i = 0; i <= 7; i++) {
      for (let j = 0; j <= 7; j++) {
        const p = pois(i, lh) * pois(j, la);
        if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
        if (i + j > 2) over25 += p;
        if (i > 0 && j > 0) btts += p;
        scores.push({ score: `${i} - ${j}`, p });
      }
    }
    const total = pH + pD + pA;
    return {
      expectedGoals: [lh, la],
      home: pH / total, draw: pD / total, away: pA / total,
      over25, btts,
      topScores: scores.sort((a, b) => b.p - a.p).slice(0, 6),
    };
  },

  // Analyse d'avant-match : phrases d'explication
  preMatchInsights(homeId, awayId) {
    const table = this.standings();
    const h = table.find(t => t.id === homeId), a = table.find(t => t.id === awayId);
    const ph = this.position(homeId), pa = this.position(awayId);
    const p = this.predict(homeId, awayId);
    const out = [];

    const gap = Math.abs(ph - pa);
    if (gap >= 8) {
      const fav = ph < pa ? h : a;
      out.push({ text: `Gros écart au classement : ${fav.name} (${Math.min(ph, pa) === 1 ? "1er" : Math.min(ph, pa) + "e"}) part favori face au ${Math.max(ph, pa)}e.` });
    } else if (gap <= 2) {
      out.push({ text: `Duel serré : les deux équipes sont proches au classement (${ph === 1 ? "1er" : ph + "e"} contre ${pa === 1 ? "1er" : pa + "e"}).` });
    }

    const fav = p.home > p.away ? h : a;
    const favP = Math.max(p.home, p.away);
    if (favP >= 0.55) out.push({ text: `Le modèle donne ${fav.name} gagnant à ${Math.round(favP * 100)} %.` });
    else out.push({ warn: true, text: `Match ouvert : aucune équipe ne dépasse 55 % de chances de victoire.` });

    [h, a].forEach(t => {
      const gf = t.GF / t.P, ga = t.GA / t.P;
      if (gf >= 2) out.push({ text: `${t.name} a une attaque prolifique (${gf.toFixed(1)} buts/match).` });
      if (ga <= 0.9) out.push({ text: `${t.name} a une défense solide (${ga.toFixed(1)} but encaissé/match).` });
      if (ga >= 2) out.push({ warn: true, text: `${t.name} encaisse beaucoup (${ga.toFixed(1)} buts/match).` });
      if (t.W === 0) out.push({ warn: true, text: `${t.name} n'a encore gagné aucun match cette saison.` });
    });

    if (p.over25 >= 0.55) out.push({ text: `Match qui devrait être animé : ${Math.round(p.over25 * 100)} % de chances de voir plus de 2,5 buts.` });
    if (p.over25 <= 0.4) out.push({ text: `Match plutôt fermé attendu : seulement ${Math.round(p.over25 * 100)} % de chances de dépasser 2,5 buts.` });

    return out;
  },

  _fact(n) { return n <= 1 ? 1 : n * this._fact(n - 1); },
};
