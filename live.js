/* Matchs en direct et actualités. Les données viennent exclusivement du backend. */
(() => {
  const LIVE_STATUS = {
    SCHEDULED: "À venir",
    TIMED: "À venir",
    IN_PLAY: "En direct",
    PAUSED: "Mi-temps",
    FINISHED: "Terminé",
    POSTPONED: "Reporté",
    CANCELLED: "Annulé",
    SUSPENDED: "Suspendu",
  };

  const liveList = document.getElementById("live-matches");
  const liveInfo = document.getElementById("live-info");
  const newsList = document.getElementById("news-list");
  const newsInfo = document.getElementById("news-info");

  const safeHttpUrl = value => {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };

  const empty = (container, text) => {
    container.replaceChildren();
    const card = document.createElement("div");
    card.className = "card empty-state";
    card.textContent = text;
    container.append(card);
  };

  const crest = team => {
    const img = document.createElement("img");
    img.className = "team-crest large";
    img.alt = "";
    try {
      const url = new URL(team.crest || "");
      if (["http:", "https:"].includes(url.protocol)) img.src = url.href;
    } catch { /* aucune image */ }
    return img;
  };

  function renderLive(data) {
    liveList.replaceChildren();
    const matches = Array.isArray(data.matches) ? data.matches : [];
    liveInfo.textContent = `Source : ${data.source || "—"} · mise à jour ${new Date(data.fetchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    if (!matches.length) return empty(liveList, "Aucun match des cinq championnats n'est programmé aujourd'hui.");

    matches.forEach(match => {
      const card = document.createElement("article");
      card.className = "card live-card";
      const header = document.createElement("div");
      header.className = "live-card-head";
      const competition = document.createElement("span");
      competition.textContent = match.competition?.name || match.competition?.code || "Football";
      const status = document.createElement("span");
      status.className = `live-status ${["IN_PLAY", "PAUSED"].includes(match.status) ? "active" : ""}`;
      const minute = match.minute ? ` · ${match.minute}${match.injuryTime ? `+${match.injuryTime}` : ""}'` : "";
      status.textContent = `${LIVE_STATUS[match.status] || match.status || "—"}${minute}`;
      header.append(competition, status);

      const score = document.createElement("div");
      score.className = "live-score";
      const home = document.createElement("div");
      home.append(crest(match.home || {}), document.createTextNode(match.home?.name || "À confirmer"));
      const result = document.createElement("strong");
      const homeScore = match.score?.home;
      const awayScore = match.score?.away;
      result.textContent = homeScore == null || awayScore == null ? "–" : `${homeScore} – ${awayScore}`;
      const away = document.createElement("div");
      away.append(document.createTextNode(match.away?.name || "À confirmer"), crest(match.away || {}));
      score.append(home, result, away);
      card.append(header, score);
      liveList.append(card);
    });
  }

  async function loadLive() {
    liveInfo.textContent = "Actualisation des matchs…";
    try {
      const response = await footApiFetch("/api/live");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
      renderLive(data);
    } catch (error) {
      liveInfo.textContent = "Le direct sera disponible après le déploiement du backend et la configuration de la clé football.";
      empty(liveList, `Direct indisponible : ${error.message}`);
    }
  }

  function renderNews(data) {
    newsList.replaceChildren();
    const items = Array.isArray(data.items) ? data.items : [];
    if (!data.configured) {
      newsInfo.textContent = "Aucun flux d'actualités autorisé n'est encore configuré sur le serveur.";
      return empty(newsList, "Configurez NEWS_FEEDS avec des flux RSS/Atom autorisés. Les articles resteront sur leurs sites d'origine.");
    }
    newsInfo.textContent = `Dernière mise à jour : ${new Date(data.fetchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    if (!items.length) return empty(newsList, "Aucune actualité disponible pour le moment.");
    items.forEach(item => {
      const articleUrl = safeHttpUrl(item.url);
      if (!articleUrl) return;
      const article = document.createElement("article");
      article.className = "card news-card";
      const source = document.createElement("span");
      source.className = "news-source";
      source.textContent = item.source || "Source sportive";
      const title = document.createElement("h2");
      const link = document.createElement("a");
      link.href = articleUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title;
      title.append(link);
      const date = document.createElement("small");
      date.textContent = item.publishedAt || "";
      article.append(source, title, date);
      newsList.append(article);
    });
  }

  async function loadNews() {
    newsInfo.textContent = "Chargement des actualités…";
    try {
      const response = await footApiFetch("/api/news");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
      renderNews(data);
    } catch (error) {
      newsInfo.textContent = "Les actualités nécessitent le backend FootAnalyse.";
      empty(newsList, `Actualités indisponibles : ${error.message}`);
    }
  }

  document.getElementById("refresh-live").addEventListener("click", loadLive);
  document.getElementById("refresh-news").addEventListener("click", loadNews);
  document.addEventListener("foot:view", event => {
    if (event.detail.name === "live") loadLive();
    if (event.detail.name === "news") loadNews();
  });
})();

