/* =========================================================
   CHATBOT – interface
   ---------------------------------------------------------
   Envoie la conversation au serveur (/api/chat), qui interroge
   Claude avec recherche web (voir chatbot_ai.py).
   Si le serveur de recherche n'est pas disponible, le chatbot
   refuse de répondre plutôt que d'utiliser des données anciennes.
   ========================================================= */

const Chatbot = (() => {
  const panel = document.getElementById("chat-panel");
  const messages = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = form.querySelector("button");
  const serviceStatus = document.getElementById("chat-service-status");
  const history = []; // { role: "user" | "assistant", content }
  const configuredBackend = Boolean(window.FOOTANALYSE_CONFIG?.apiBase);
  const staticGitHubPage = location.hostname.endsWith("github.io");
  let aiAvailable = configuredBackend || !staticGitHubPage;
  let healthChecked = false;
  const MAX_QUESTION_CHARS = 1000;
  const CHAT_TIMEOUT_MS = 170000;

  input.maxLength = MAX_QUESTION_CHARS;

  const unavailableText = () =>
    "La recherche web vérifiée n'est pas connectée à cette version du site. " +
    "Je préfère ne pas répondre plutôt que d'utiliser les données enregistrées ou d'inventer. " +
    "Le serveur IA sécurisé doit être déployé et relié au site.";

  function setStatus(text, offline = false) {
    serviceStatus.textContent = text;
    serviceStatus.classList.toggle("offline", offline);
  }

  // Réveille le serveur (hébergement gratuit en veille) et affiche son état.
  async function checkHealth() {
    if (healthChecked || !configuredBackend) return;
    healthChecked = true;
    setStatus("Connexion au serveur de recherche…");
    try {
      const res = await footApiFetch("/api/health");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ai) setStatus("Recherche web vérifiée · connectée");
      else if (res.ok) setStatus("Serveur joint, mais IA désactivée", true);
      else setStatus(`Serveur indisponible (${res.status})`, true);
    } catch {
      healthChecked = false; // on réessaiera à la prochaine ouverture
      setStatus("Serveur injoignable pour le moment", true);
    }
  }

  function toggle(open) {
    const isOpen = open ?? !panel.classList.contains("open");
    panel.classList.toggle("open", isOpen);
    panel.setAttribute("aria-hidden", !isOpen);
    if (isOpen) {
      input.focus();
      checkHealth();
    }
  }

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const SECTION_CLASSES = [
    [/faits/i, "facts"],
    [/analyse/i, "analysis"],
    [/pr[ée]diction|pronostic/i, "prediction"],
    [/limite|d[ée]saccord/i, "limits"],
  ];

  // Mise en forme minimale et sûre : on échappe le HTML puis on gère
  // **gras**, *italique*, titres de section, listes « - », liens HTTPS,
  // renvois [n] vers les sources et retours à la ligne.
  function formatText(text, sources = []) {
    return escapeHtml(text)
      .replace(/^\s*[-•*]\s+/gm, "• ")
      .replace(/^#{1,6}\s*(.+)$/gm, (_, title) => {
        const match = SECTION_CLASSES.find(([re]) => re.test(title));
        return `<strong class="section-title ${match ? match[1] : ""}">${title.replace(/\*\*/g, "")}</strong>\u0001`;
      })
      .replace(/\u0001\n?/g, "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, "$1<em>$2</em>")
      .replace(/\[([^\]\n]{1,200})\]\((https:\/\/[^\s)"]{1,500})\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\[(\d{1,2})\](?!\()/g, (whole, n) => {
        const source = sources[Number(n) - 1];
        if (!source) return whole;
        return `<sup class="cite"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(source.title)}">${n}</a></sup>`;
      })
      .replace(/\n/g, "<br>");
  }

  function safeSourceList(sources) {
    return (Array.isArray(sources) ? sources : []).map(source => {
      try {
        const url = new URL(String(source.url || ""));
        if (url.protocol !== "https:") return null;
        return {
          url: url.href,
          title: String(source.title || url.hostname),
          domain: url.hostname,
          pageAge: source.pageAge ? String(source.pageAge).slice(0, 60) : "",
        };
      } catch { return null; }
    }).filter(Boolean);
  }

  function badgeFor(research, sourceCount) {
    const badge = document.createElement("div");
    badge.className = `verification-badge ${research.status}`;
    if (research.status === "verified") {
      const when = research.verifiedAt ? new Date(research.verifiedAt) : new Date();
      const day = when.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const hour = when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      badge.textContent = `✓ Vérifié le ${day} à ${hour} · ${sourceCount} source${sourceCount > 1 ? "s" : ""} consultée${sourceCount > 1 ? "s" : ""}`;
      if (research.singleSource) {
        const warn = document.createElement("span");
        warn.className = "single-source";
        warn.textContent = " · ⚠ un seul site trouvé : à confirmer";
        badge.append(warn);
      }
    } else if (research.status === "clarification") {
      badge.textContent = "? Précisions nécessaires avant la recherche";
    } else if (research.status === "no_research") {
      badge.textContent = "ℹ Réponse sans recherche web : aucune donnée factuelle";
    } else {
      badge.textContent = "Non vérifié — aucune réponse factuelle fournie";
    }
    return badge;
  }

  function addMessage(text, from, sources = [], research = null) {
    const div = document.createElement("div");
    div.className = `msg ${from}`;
    if (from === "bot") {
      const safeSources = safeSourceList(sources);
      div.innerHTML = formatText(text, safeSources);
      if (research?.status) div.prepend(badgeFor(research, safeSources.length));

      if (safeSources.length) {
        const src = document.createElement("div");
        src.className = "sources";
        const heading = document.createElement("strong");
        heading.textContent = "Sources consultées";
        src.append(heading);
        safeSources.forEach((s, i) => {
          const a = document.createElement("a");
          a.href = s.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          const title = s.title.length > 70 ? s.title.slice(0, 70) + "…" : s.title;
          a.textContent = `${i + 1}. ${title} — ${s.domain}${s.pageAge ? ` · ${s.pageAge}` : ""}`;
          src.append(a);
        });
        div.append(src);
      }
    } else {
      div.textContent = text;
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function askAI() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
    try {
      const res = await footApiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Le serveur reconstruit lui-même le contexte depuis une source fiable.
        body: JSON.stringify({ messages: history.slice(-12), league: CURRENT_LEAGUE.apiCode }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || ([404, 405, 501].includes(res.status) ? "pas de serveur IA sur cet hébergement" : `Erreur ${res.status}`));
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  const KEEP_IN_HISTORY = new Set(["verified", "clarification", "no_research"]);

  async function handleQuestion(text) {
    text = String(text).slice(0, MAX_QUESTION_CHARS);
    addMessage(text, "user");
    history.push({ role: "user", content: text });

    if (!aiAvailable) {
      history.pop();
      return addMessage(unavailableText(), "bot", [], { status: "unavailable" });
    }

    const typing = addMessage("…", "bot typing");
    typing.textContent = "Je recherche et je vérifie les sources (jusqu'à une minute)";
    input.disabled = sendBtn.disabled = true;
    try {
      const { reply, sources, research } = await askAI();
      typing.remove();
      const status = research?.status || "unavailable";
      const usable = status !== "verified" || (Array.isArray(sources) && sources.length);
      if (KEEP_IN_HISTORY.has(status) && usable) {
        history.push({ role: "assistant", content: reply });
      } else {
        history.pop();
      }
      addMessage(reply, "bot", status === "verified" ? sources || [] : [], research || { status: "unavailable" });
    } catch (e) {
      typing.remove();
      history.pop(); // la question pourra être reposée
      // Aucun repli sur des données anciennes : une panne reste visible et honnête.
      if ([404, 405, 501].includes(e.status)) {
        aiAvailable = false;
        setStatus("Recherche vérifiée indisponible", true);
        addMessage(unavailableText(), "bot", [], { status: "unavailable" });
      } else if (!e.status) {
        healthChecked = false;
        const reason = e.name === "AbortError"
          ? "la recherche a pris trop de temps"
          : "le serveur est injoignable (il redémarre peut-être après une période d'inactivité)";
        addMessage(`La vérification a échoué : ${reason}. Réessaie dans une trentaine de secondes.`, "bot", [], { status: "unavailable" });
      } else {
        addMessage(`La vérification a échoué : ${e.message}`, "bot", [], { status: "unavailable" });
      }
    } finally {
      input.disabled = sendBtn.disabled = false;
      input.focus();
    }
  }

  // Suggestions de questions (cliquables)
  const SUGGESTIONS = [
    "Analyse les matchs de Ligue 1 du week-end avec les absents confirmés",
    "Quel est le classement actuel de Premier League ?",
    "Compare la forme récente du PSG et de Marseille",
    "Quelles compositions sont officiellement confirmées aujourd'hui ?",
    "Quels transferts ont été officialisés cette semaine ?",
    "Explique le modèle de pronostic et ses limites",
  ];
  const sugBox = document.getElementById("chat-suggestions");
  SUGGESTIONS.forEach(text => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", () => { if (!input.disabled) handleQuestion(text); });
    sugBox.appendChild(b);
  });

  document.getElementById("chat-toggle").addEventListener("click", () => toggle());
  document.getElementById("chat-close").addEventListener("click", () => toggle(false));
  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || input.disabled) return;
    input.value = "";
    handleQuestion(text);
  });

  if (!aiAvailable) setStatus("Recherche vérifiée non connectée", true);

  return { toggle, addMessage, ask: handleQuestion };
})();
