/* =========================================================
   CHATBOT – interface
   ---------------------------------------------------------
   Envoie la conversation au Worker Cloudflare (/api/chat) avec un
   jeton anti-robot Turnstile. Le Worker consulte des sources de
   données gratuites, compare les résultats et renvoie une réponse
   vérifiable : faits reliés à leurs sources, date de vérification,
   avertissements. Sans source, aucune valeur n'est affichée.
   Compatible aussi avec l'ancien serveur Python (server.py).
   ========================================================= */

const Chatbot = (() => {
  const panel = document.getElementById("chat-panel");
  const messages = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = form.querySelector("button");
  const serviceStatus = document.getElementById("chat-service-status");
  const turnstileBox = document.getElementById("chat-turnstile");
  const config = window.FOOTANALYSE_CONFIG || {};
  const history = []; // { role: "user" | "assistant", content }
  const configuredBackend = Boolean(config.apiBase);
  const staticGitHubPage = location.hostname.endsWith("github.io");
  let aiAvailable = configuredBackend || !staticGitHubPage;
  let healthChecked = false;
  const MAX_QUESTION_CHARS = 500;
  const CHAT_TIMEOUT_MS = 60000;

  input.maxLength = MAX_QUESTION_CHARS;

  const unavailableText = () =>
    "Le service de vérification n'est pas connecté à cette version du site. " +
    "Je préfère ne pas répondre plutôt que d'utiliser des données anciennes ou d'inventer.";

  function setStatus(text, offline = false) {
    serviceStatus.textContent = text;
    serviceStatus.classList.toggle("offline", offline);
  }

  async function checkHealth() {
    if (healthChecked || !configuredBackend) return;
    healthChecked = true;
    setStatus("Connexion au service de vérification…");
    try {
      const res = await footApiFetch("/api/health");
      const data = await res.json().catch(() => ({}));
      const ready = data.engine === "cloudflare-worker"
        ? data.storage && data.turnstile
        : (data.chat ? data.chat.ready : data.ai);
      if (res.ok && ready) setStatus("Données vérifiées · connecté");
      else if (res.ok) setStatus("Service joint, configuration incomplète", true);
      else setStatus(`Service indisponible (${res.status})`, true);
    } catch {
      healthChecked = false;
      setStatus("Service injoignable pour le moment", true);
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

  // ---------------------------------------------------------- Turnstile
  let widgetId = null;
  let pending = null;

  function turnstileToken() {
    if (!config.turnstileSiteKey) return Promise.resolve("");
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 15000;
      const start = () => {
        if (!window.turnstile) {
          if (Date.now() > deadline) return reject(new Error("la vérification anti-robot n'a pas pu se charger"));
          return setTimeout(start, 200);
        }
        pending = { resolve, reject };
        if (widgetId === null) {
          widgetId = window.turnstile.render(turnstileBox, {
            sitekey: config.turnstileSiteKey,
            execution: "execute",
            appearance: "interaction-only",
            language: "fr",
            callback: token => { pending?.resolve(token); pending = null; },
            "error-callback": () => { pending?.reject(new Error("vérification anti-robot échouée")); pending = null; },
            "expired-callback": () => window.turnstile.reset(widgetId),
          });
        } else {
          window.turnstile.reset(widgetId);
        }
        window.turnstile.execute(widgetId);
      };
      start();
    });
  }

  // ---------------------------------------------------------- affichage
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const fmt = iso => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const safeUrl = value => {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : null;
    } catch { return null; }
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const STATUS_BADGES = {
    clarification: "? Précisions nécessaires avant de chercher",
    unverifiable: "Non confirmé — aucune valeur donnée",
    refused: "⛔ Demande refusée",
    quota: "⏳ Quota gratuit atteint",
    not_supported: "ℹ Hors du périmètre de cette version",
    error: "Erreur",
  };
  const LEVEL_CLASS = { multiple: "level-multiple", single: "level-single", conflict: "level-conflict" };

  /** Réponse au format du Worker : statut, réponse, faits ↔ sources, avertissements. */
  function renderStructured(data) {
    const div = el("div", "msg bot");
    const status = data.status || "error";
    if (status === "verified") {
      div.append(el("div", "verification-badge verified", `✓ Réponse vérifiée · Vérifié le ${fmt(data.verifiedAt)}`));
      const level = data.verification?.level;
      if (level) div.append(el("div", `verification-level ${LEVEL_CLASS[level] || ""}`, data.verification.label));
    } else {
      div.append(el("div", `verification-badge ${status}`, STATUS_BADGES[status] || "Non vérifié"));
    }
    div.append(el("p", "answer", data.answer || ""));

    if (Array.isArray(data.questions) && data.questions.length) {
      const ul = el("ul", "questions");
      data.questions.forEach(q => ul.append(el("li", "", q)));
      div.append(ul);
    }

    const sources = (Array.isArray(data.sources) ? data.sources : [])
      .map(s => ({ ...s, safe: safeUrl(s.url) })).filter(s => s.safe);
    const number = new Map(sources.map((s, i) => [s.id, i + 1]));

    if (Array.isArray(data.facts) && data.facts.length) {
      div.append(el("strong", "section-title facts", "Faits vérifiés"));
      const ul = el("ul", "facts");
      data.facts.forEach(f => {
        const li = el("li", f.conflict ? "conflict" : "", f.claim);
        (f.sourceIds || []).forEach(id => {
          const n = number.get(id);
          const s = sources[n - 1];
          if (!s) return;
          const sup = el("sup", "cite");
          const a = el("a", "", String(n));
          a.href = s.safe; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = `${s.provider} — ${s.title}`;
          sup.append(a);
          li.append(" ", sup);
        });
        ul.append(li);
      });
      div.append(ul);
    }

    if (Array.isArray(data.warnings) && data.warnings.length) {
      div.append(el("strong", "section-title limits", "Avertissements"));
      const ul = el("ul", "warnings");
      data.warnings.forEach(w => ul.append(el("li", "", w)));
      div.append(ul);
    }

    if (sources.length) {
      const box = el("div", "sources");
      box.append(el("strong", "", "Sources"));
      sources.forEach((s, i) => {
        const a = el("a", "", `${i + 1}. ${s.provider} — ${s.title}${s.retrievedAt ? ` · récupéré le ${fmt(s.retrievedAt)}` : ""}`);
        a.href = s.safe; a.target = "_blank"; a.rel = "noopener noreferrer";
        box.append(a);
      });
      div.append(box);
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  /** Ancien format (serveur Python) : converti puis affiché. */
  function renderLegacy(data) {
    const research = data.research || {};
    return renderStructured({
      status: research.status === "no_research" ? "not_supported" : (research.status || "error"),
      answer: data.reply || "",
      verifiedAt: research.verifiedAt,
      verification: research.status === "verified"
        ? (research.conflict ? { level: "conflict", label: "Sources en désaccord — valeurs différentes affichées" }
          : research.singleSource ? { level: "single", label: "Source unique — vérification complémentaire recommandée" }
            : { level: "multiple", label: "Vérifié par plusieurs sources" })
        : null,
      sources: (data.sources || []).map((s, i) => ({ id: `source-${i + 1}`, provider: s.domain || "", title: s.title, url: s.url })),
      facts: [], warnings: [],
    });
  }

  function addMessage(text, from, _sources = [], research = null) {
    if (from === "bot" && research) return renderStructured({ status: research.status === "unavailable" ? "unverifiable" : research.status, answer: text });
    const div = el("div", `msg ${from}`, text);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  // ---------------------------------------------------------- échanges
  async function askServer() {
    const token = await turnstileToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
    try {
      const res = await footApiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-8), turnstileToken: token }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.status) {
        const err = new Error(data.error || ([404, 405, 501].includes(res.status) ? "pas de service de vérification sur cet hébergement" : `Erreur ${res.status}`));
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  const KEEP_IN_HISTORY = new Set(["verified", "clarification", "unverifiable", "not_supported"]);

  async function handleQuestion(text) {
    text = String(text).slice(0, MAX_QUESTION_CHARS);
    addMessage(text, "user");
    history.push({ role: "user", content: text });

    if (!aiAvailable) {
      history.pop();
      return addMessage(unavailableText(), "bot", [], { status: "unavailable" });
    }

    const typing = el("div", "msg bot typing", "Je consulte et je compare les sources");
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    input.disabled = sendBtn.disabled = true;
    try {
      const data = await askServer();
      typing.remove();
      if (data.reply !== undefined && data.research) {
        renderLegacy(data);
        if (KEEP_IN_HISTORY.has(data.research.status)) history.push({ role: "assistant", content: data.reply });
        else history.pop();
        return;
      }
      if (data.error && !data.answer) data.answer = data.error;
      renderStructured(data);
      if (KEEP_IN_HISTORY.has(data.status)) {
        const questions = Array.isArray(data.questions) ? `\n${data.questions.join("\n")}` : "";
        history.push({ role: "assistant", content: `${data.answer}${questions}` });
      } else {
        history.pop(); // la question pourra être reposée
      }
    } catch (e) {
      typing.remove();
      history.pop();
      if ([404, 405, 501].includes(e.status)) {
        aiAvailable = false;
        setStatus("Service de vérification indisponible", true);
        addMessage(unavailableText(), "bot", [], { status: "unavailable" });
      } else {
        healthChecked = false;
        const reason = e.name === "AbortError" ? "la vérification a pris trop de temps" : e.message;
        addMessage(`La vérification a échoué : ${reason}. Réessaie dans un instant.`, "bot", [], { status: "error" });
      }
    } finally {
      input.disabled = sendBtn.disabled = false;
      input.focus();
    }
  }

  const SUGGESTIONS = [
    "Quel est le classement actuel de la Ligue 1 ?",
    "Meilleur buteur de Premier League",
    "Prochain match du PSG",
    "Dernier résultat du Bayern",
    "Combien de buts a João Pedro ?",
    "C'est quoi le hors-jeu ?",
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

  if (!aiAvailable) setStatus("Service de vérification non connecté", true);

  return { toggle, addMessage, ask: handleQuestion };
})();
