/* =========================================================
   INTERFACE : affichage des vues
   ========================================================= */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = value => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
};
const safeColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? value : "#8b98a5";
const team = id => Analysis.teamById(id);
// Logo du club si l'API le fournit, sinon pastille de couleur
const dot = id => {
  const t = team(id);
  const crest = safeUrl(t?.crest);
  return crest
    ? `<img class="team-crest" src="${esc(crest)}" alt="" loading="lazy">`
    : `<span class="team-dot" style="background:${safeColor(t?.color)}"></span>`;
};
const pct = x => Math.round(x * 100) + " %";
const ord = n => (n === 1 ? "1er" : n + "e");
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const fmtDate = d => {
  const dt = new Date(d + "T12:00:00");
  return `${JOURS[dt.getDay()]} ${d.slice(8)}/${d.slice(5, 7)}`;
};

// ---------- Navigation ----------
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.body.dataset.view = name;
  $(`#view-${name}`).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.dispatchEvent(new CustomEvent("foot:view", { detail: { name } }));
}
document.querySelectorAll("[data-view]").forEach(btn =>
  btn.addEventListener("click", () => showView(btn.dataset.view))
);

// ---------- Composants ----------
function matchRow(m) {
  const p = Analysis.predict(m.home, m.away);
  const home = team(m.home), away = team(m.away);
  return `
    <button type="button" class="match" data-id="${esc(m.id)}" aria-label="Voir ${esc(home.name)} contre ${esc(away.name)}">
      <span class="day">J${esc(m.day)}<br>${esc(fmtDate(m.date))}</span>
      <span class="home">${esc(home.name)} <small class="pos">${ord(Analysis.position(m.home))}</small>${dot(m.home)}</span>
      <span class="score time">${esc(String(m.time).replace(":", "h"))}</span>
      <span class="away">${dot(m.away)}<small class="pos">${ord(Analysis.position(m.away))}</small> ${esc(away.name)}</span>
      <span class="mini-probs" title="Victoire domicile / Nul / Victoire extérieur">
        <span class="p-home" style="width:${p.home * 100}%"></span>
        <span class="p-draw" style="width:${p.draw * 100}%"></span>
        <span class="p-away" style="width:${p.away * 100}%"></span>
      </span>
    </button>`;
}

function bindMatchClicks(container) {
  container.querySelectorAll(".match").forEach(el =>
    el.addEventListener("click", () => renderDetail(el.dataset.id))
  );
}

function bars(items, max, cls = "") {
  return items.map(i => `
    <div class="bar-row">
      <span>${dot(i.id)}${esc(i.name)}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${(i.value / max) * 100}%"></div></div>
      <span class="num">${i.value}</span>
    </div>`).join("");
}

function predictionBlocks(h, a) {
  const p = Analysis.predict(h, a);
  return `
    <div class="card">
      <h2>Probabilités du résultat</h2>
      <div class="probs">
        <div class="p-home" style="width:${p.home * 100}%">${pct(p.home)}</div>
        <div class="p-draw" style="width:${p.draw * 100}%">${pct(p.draw)}</div>
        <div class="p-away" style="width:${p.away * 100}%">${pct(p.away)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.85rem">
        <span>Victoire ${esc(team(h).name)}</span><span>Nul</span><span>Victoire ${esc(team(a).name)}</span>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h2>Indicateurs</h2>
        <div class="insight">Buts attendus : <strong>${p.expectedGoals[0].toFixed(2)} – ${p.expectedGoals[1].toFixed(2)}</strong></div>
        <div class="insight">Plus de 2,5 buts : <strong>${pct(p.over25)}</strong></div>
        <div class="insight">Les deux équipes marquent : <strong>${pct(p.btts)}</strong></div>
      </div>
      <div class="card">
        <h2>Scores les plus probables</h2>
        <div class="score-grid">${p.topScores.map(s => `<div><strong>${s.score}</strong><small>${(s.p * 100).toFixed(1)} %</small></div>`).join("")}</div>
      </div>
    </div>`;
}

// ---------- Tableau de bord ----------
function renderDashboard() {
  const k = Analysis.seasonKpis();
  const info = DATA_INFO.live
    ? `🟢 Données en direct (football-data.org) · Saison ${DATA_INFO.season} · mises à jour le ${DATA_INFO.fetchedAt}`
    : `🟠 Données enregistrées · Saison ${DATA_INFO.season} · ${DATA_INFO.label}${DATA_INFO.apiError ? " · API : " + DATA_INFO.apiError : ""}`;
  document.querySelectorAll(".league-name").forEach(el => { el.textContent = CURRENT_LEAGUE.name; });
  $("#data-info").textContent = info;
  $("#standings-info").textContent = info;

  $("#kpis").innerHTML = [
    ["Matchs joués", k.matches],
    ["Buts marqués", k.goals],
    ["Buts / match", k.goalsPerMatch],
    ["Matchs nuls", k.drawPct + " %"],
    ["Leader", `${k.leader.name.replace("Paris Saint-Germain", "PSG")} (${k.leader.pts} pts)`],
    ["Meilleur buteur", topScorerLabel()],
  ].map(([l, v]) => `<div class="kpi"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div></div>`).join("");

  const table = Analysis.standings();
  const attack = [...table].sort((a, b) => b.GF - a.GF).slice(0, 5).map(t => ({ id: t.id, name: t.name, value: t.GF }));
  const defense = [...table].sort((a, b) => a.GA - b.GA).slice(0, 5).map(t => ({ id: t.id, name: t.name, value: t.GA }));
  $("#top-attack").innerHTML = bars(attack, attack[0].value);
  $("#top-defense").innerHTML = bars(defense, Math.max(...defense.map(d => d.value)), "blue");

  const nextDay = Math.min(...UPCOMING.map(m => m.day));
  const next = UPCOMING.filter(m => m.day === nextDay);
  $("#next-matches").innerHTML = next.length ? next.map(matchRow).join("") : "<p class='subtitle'>Aucun match programmé.</p>";
  bindMatchClicks($("#next-matches"));
}

// ---------- Prochains matchs ----------
function renderMatches() {
  const t = $("#filter-team").value;
  const list = UPCOMING.filter(m => !t || m.home === t || m.away === t);
  $("#all-matches").innerHTML = list.length ? list.map(matchRow).join("") : "<p class='subtitle'>Aucun match.</p>";
  bindMatchClicks($("#all-matches"));
}

function topScorerLabel() {
  const best = [...PLAYERS].filter(p => p.goals != null).sort((a, b) => b.goals - a.goals)[0];
  return best ? `${best.name} (${best.goals})` : "—";
}

$("#filter-team").addEventListener("change", renderMatches);
function initFilters() {
  const opts = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name))
    .map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
  $("#filter-team").innerHTML = `<option value="">Toutes les équipes</option>${opts}`;
  $("#predict-result").innerHTML = "";
  $("#predict-home").innerHTML = opts;
  $("#predict-away").innerHTML = opts;
  $("#predict-away").selectedIndex = 1;
}

// ---------- Analyse d'avant-match ----------
function renderDetail(id) {
  const m = UPCOMING.find(x => x.id === id);
  const table = Analysis.standings();
  const H = table.find(t => t.id === m.home), A = table.find(t => t.id === m.away);

  const rows = [
    ["Position", Analysis.position(m.home), Analysis.position(m.away), true],
    ["Points", H.pts, A.pts],
    ["Victoires", H.W, A.W],
    ["Buts marqués", H.GF, A.GF],
    ["Buts encaissés", H.GA, A.GA, true],
    ["Buts marqués / match", +(H.GF / H.P).toFixed(2), +(A.GF / A.P).toFixed(2)],
    ["Buts encaissés / match", +(H.GA / H.P).toFixed(2), +(A.GA / A.P).toFixed(2), true],
  ];
  // « lowerIsBetter » : on inverse les barres pour que la plus longue = la meilleure
  const statsHtml = rows.map(([label, h, a, lowerIsBetter]) => {
    let wh = h, wa = a;
    if (lowerIsBetter) { wh = 1 / (h || 0.5); wa = 1 / (a || 0.5); }
    const total = wh + wa || 1;
    return `
      <div class="stat-compare">
        <div class="labels"><strong>${h}</strong><span class="name">${label}</span><strong>${a}</strong></div>
        <div class="split-bar">
          <div class="h" style="width:${(wh / total) * 100}%"></div>
          <div class="a" style="width:${(wa / total) * 100}%"></div>
        </div>
      </div>`;
  }).join("");

  const insights = Analysis.preMatchInsights(m.home, m.away)
    .map(i => `<div class="insight ${i.warn ? "warn" : ""}">${esc(i.text)}</div>`).join("");

  $("#match-detail").innerHTML = `
    <div class="card">
      <div class="scoreboard">
        <div><div class="team-name">${dot(m.home)}${esc(H.name)}</div><div class="meta">Domicile · ${ord(Analysis.position(m.home))}</div></div>
        <div><div class="big-score">${esc(String(m.time).replace(":", "h"))}</div><div class="meta">Journée ${esc(m.day)} · ${esc(fmtDate(m.date))}</div></div>
        <div><div class="team-name">${esc(A.name)}${dot(m.away)}</div><div class="meta">Extérieur · ${ord(Analysis.position(m.away))}</div></div>
      </div>
    </div>
    ${predictionBlocks(m.home, m.away)}
    <div class="grid-2">
      <div class="card"><h2>Comparaison sur la saison</h2>${statsHtml}</div>
      <div class="card"><h2>Analyse d'avant-match</h2>${insights}</div>
    </div>
    <div class="card" id="lineups-card">
      <h2>Compositions probables</h2>
      <p class="subtitle">Le bouton lance une recherche web par l'IA (presse sportive, blessés, suspendus) pour obtenir la version la plus récente. Peut prendre jusqu'à une minute.</p>
      <button class="primary" id="lineups-btn">Actualiser avec l'IA</button>
      <div id="lineups-msg"></div>
      <div id="lineups"></div>
    </div>`;
  $("#lineups-btn").addEventListener("click", () => loadLineups(m));
  showSavedLineups(m);
  showView("detail");
}

// ---------- Compositions probables ----------
const lineLabel = (i, n) => (i === 0 ? "Gardien" : i === 1 ? "Défense" : i === n - 1 ? "Attaque" : "Milieu");

function pitchHtml(teamId, side, data) {
  // Gardien en bas, attaque en haut ; chaque ligne de gauche à droite
  const lines = [...data.lignes].reverse().map(line => `
    <div class="pitch-line">${line.map(p => `
      <div class="player" title="${esc(p.nom)} (${esc(p.poste)})">
        <span class="shirt" style="background:${safeColor(team(teamId).color)}">${esc(p.poste)}</span>
        <span class="pname">${esc(p.nom)}</span>
      </div>`).join("")}
    </div>`).join("");
  const roster = `<ul class="roster">${data.lignes.map((line, i) => `
    <li><span class="line-label">${lineLabel(i, data.lignes.length)}</span>
      ${line.map(p => `${esc(p.nom)} <small>(${esc(p.poste)})</small>`).join(", ")}</li>`).join("")}</ul>`;
  const absents = data.absents.length
    ? `<ul class="absents">${data.absents.map(a => `<li><strong>${esc(a.nom)}</strong> – ${esc(a.raison)}</li>`).join("")}</ul>`
    : `<p class="subtitle">Aucun absent signalé.</p>`;
  return `
    <div>
      <div class="pitch-head">${dot(teamId)}<strong>${esc(team(teamId).name)}</strong> <span class="badge">${esc(data.schema_tactique)}</span></div>
      <div class="pitch">${lines}</div>
      <p class="coach">${data.entraineur ? `Entraîneur : ${esc(data.entraineur)} · ` : ""}${side}</p>
      <h3>Titulaires</h3>${roster}
      <h3>Absents / incertains</h3>${absents}
    </div>`;
}

async function loadLineups(m) {
  const btn = $("#lineups-btn"), box = $("#lineups");
  btn.disabled = true;
  btn.textContent = "Recherche en cours…";
  $("#lineups-msg").innerHTML = `<p class="subtitle loading">L'IA consulte la presse sportive…</p>`;
  try {
    const res = await footApiFetch("/api/lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, home: team(m.home).name, away: team(m.away).name, date: m.date, league: CURRENT_LEAGUE.name }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || ([404, 405, 501].includes(res.status) ? "l'actualisation par l'IA n'est pas disponible sur cette version en ligne du site" : `Erreur ${res.status}`));
    renderLineups(m, d);
    $("#lineups-msg").innerHTML = "";
    btn.textContent = "Actualiser avec l'IA";
  } catch (e) {
    // On garde les compositions déjà affichées et on explique le problème
    $("#lineups-msg").innerHTML = `<div class="insight warn">Actualisation impossible : ${esc(e.message)}</div>`;
    if (!box.querySelector(".pitch")) showSavedLineups(m);
    btn.textContent = "Réessayer";
  } finally {
    btn.disabled = false;
  }
}

// Compositions enregistrées (js/lineups-data.js), affichées dès l'ouverture du match
function showSavedLineups(m) {
  const home = savedLineupFor(m.home, team(m.home).name);
  const away = savedLineupFor(m.away, team(m.away).name);
  if (!home || !away) {
    $("#lineups").innerHTML = `<p class="subtitle">Pas de composition enregistrée pour ce match : utilise le bouton ci-dessus.</p>`;
    return;
  }
  renderLineups(m, {
    domicile: home, exterieur: away, fiabilite: "faible",
    note: SAVED_LINEUPS_INFO.note, sources: [SAVED_LINEUPS_INFO.source], generee_le: SAVED_LINEUPS_INFO.date || "—",
  });
}

function renderLineups(m, d) {
    const box = $("#lineups");
    const fiab = { "élevée": "ok", "moyenne": "mid", "faible": "low" }[d.fiabilite] || "mid";
    const verifiedSources = (Array.isArray(d.sources) ? d.sources : [])
      .map(s => ({ ...s, safeUrl: safeUrl(s.url) })).filter(s => s.safeUrl);
    const sources = verifiedSources.length
      ? `Sources : ${verifiedSources.map(s => `<a href="${esc(s.safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.titre)}</a>`).join(" · ")}`
      : "Sources : aucune source précise retenue.";
    box.innerHTML = `
      <div class="lineup-meta">
        <span class="fiab ${fiab}">Fiabilité ${esc(d.fiabilite)}</span>
        <span>${esc(d.note)}</span>
      </div>
      <div class="grid-2">${pitchHtml(m.home, "Domicile", d.domicile)}${pitchHtml(m.away, "Extérieur", d.exterieur)}</div>
      <p class="sources-line">${sources}<br>Mises à jour le ${esc(d.generee_le)} · les compositions officielles sont annoncées environ 1 h avant le match.</p>`;
}

// ---------- Classement ----------
function renderStandings() {
  const n = STANDINGS.length;
  const { releg, barrage } = CURRENT_LEAGUE.zones;
  $("#standings-table tbody").innerHTML = Analysis.standings().map((t, i) => `
    <tr class="${i >= n - releg ? "releg" : i >= n - releg - barrage ? "barrage" : ""}">
      <td>${i + 1}</td>
      <td class="left">${dot(t.id)}${esc(t.name)}</td>
      <td>${t.P}</td><td>${t.W}</td><td>${t.D}</td><td>${t.L}</td>
      <td>${t.GF}</td><td>${t.GA}</td><td>${t.GD > 0 ? "+" : ""}${t.GD}</td>
      <td>${(t.GF / t.P).toFixed(1)}</td>
      <td><strong>${t.pts}</strong></td>
    </tr>`).join("");
}

// ---------- Pronostic libre ----------
function renderPrediction() {
  const h = $("#predict-home").value, a = $("#predict-away").value;
  if (h === a) {
    $("#predict-result").innerHTML = `<div class="card insight warn">Choisis deux équipes différentes.</div>`;
    return;
  }
  $("#predict-result").innerHTML = predictionBlocks(h, a);
}
$("#predict-btn").addEventListener("click", renderPrediction);

// ---------- Championnats ----------
function renderLeagueBar() {
  $("#league-bar").innerHTML = LEAGUE_ORDER.map(id => {
    const l = LEAGUES[id];
    return `<button class="league-btn ${l === CURRENT_LEAGUE ? "active" : ""}" data-league="${esc(id)}">${esc(l.flag)} ${esc(l.short)}</button>`;
  }).join("");
  document.querySelectorAll(".league-btn").forEach(b =>
    b.addEventListener("click", () => switchLeague(b.dataset.league)));
}

function renderAll() {
  renderLeagueBar();
  initFilters();
  renderDashboard();
  renderMatches();
  renderStandings();
}

// Change de championnat (aussi utilisé par le chatbot)
async function switchLeague(id, { keepView = false } = {}) {
  if (!LEAGUES[id]) return;
  setLeague(id);
  localStorage.setItem("footanalyse-league", id);
  renderAll(); // affichage immédiat avec les données enregistrées
  if (!keepView) showView("dashboard");
  if (await loadLiveData(LEAGUES[id])) { setLeague(id); renderAll(); }
}

// ---------- Données en direct ----------
// On essaie l'API (via server.py) pour le championnat affiché. En cas
// d'échec, on garde les données enregistrées (js/leagues/*.js).
async function loadLiveData(league) {
  if (league.liveLoaded || league.liveFailed) return false;
  try {
    const res = await footApiFetch(`/api/league?code=${encodeURIComponent(league.apiCode)}`);
    const data = await res.json().catch(() => null);
    // Site hébergé sans server.py (hébergement statique) : pas d'API, on reste sur les données enregistrées
    if (!data) throw new Error("");
    if (!res.ok) throw new Error(data.error || res.status);
    // On garde couleurs et surnoms des clubs enregistrés (l'API ne les fournit pas)
    const simple = x => String(x).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    league.teams = data.teams.map(t => {
      const base = league.teams.find(b => b.id === t.id || simple(t.name).includes(simple(b.name)) ||
        (b.aliases || []).some(a => simple(t.name) === simple(a))) || {};
      return { ...t, color: base.color, aliases: [...(base.aliases || []), simple(base.name || "")].filter(Boolean) };
    });
    league.standings = data.standings;
    league.upcoming = data.upcoming;
    league.info = { ...data.info, live: true };
    if (data.players && data.players.length) {
      league.players = data.players.map(p => ({
        ...p,
        total: p.goals != null && p.assists != null ? p.goals + p.assists : null,
        minutes: null,
      }));
      league.playersInfo = { live: true, label: `en direct (football-data.org, ${data.info.fetchedAt})`, sources: ["https://www.football-data.org/"] };
    }
    league.liveLoaded = true;
    return true;
  } catch (e) {
    league.liveFailed = true;
    league.info = { ...league.info, apiError: e.message || null };
    if (league === CURRENT_LEAGUE) DATA_INFO = league.info;
    console.info(`API indisponible pour ${league.name}, données enregistrées utilisées :`, e.message);
    return false;
  }
}

// ---------- Démarrage ----------
switchLeague(LEAGUES[localStorage.getItem("footanalyse-league")] ? localStorage.getItem("footanalyse-league") : "L1");
