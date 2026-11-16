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

  const unavailableText = () =>
    "La recherche web vérifiée n'est pas connectée à cette version du site. " +
    "Je préfère ne pas répondre plutôt que d'utiliser les données enregistrées ou d'inventer. " +
    "Le serveur IA sécurisé doit être déployé et relié au site.";

  function toggle(open) {
    const isOpen = open ?? !panel.classList.contains("open");
    panel.classList.toggle("open", isOpen);
    panel.setAttribute("aria-hidden", !isOpen);
    if (isOpen) input.focus();
  }

  // Mise en forme minimale et sûre : on échappe le HTML puis on gère
  // **gras**, *italique*, listes « - » et retours à la ligne.
  function formatText(text) {
    const esc = String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, "$1<em>$2</em>")
      .replace(/^#{1,6}\s*(.+)$/gm, "<strong>$1</strong>")
      .replace(/^\s*[-•]\s+/gm, "• ")
      .replace(/\n/g, "<br>");
  }

  function addMessage(text, from, sources = [], research = null) {
    const div = document.createElement("div");
    div.className = `msg ${from}`;
    if (from === "bot") {
      div.innerHTML = formatText(text);
      const safeSources = (Array.isArray(sources) ? sources : []).map(source => {
        try {
          const url = new URL(String(source.url || ""));
          if (!["http:", "https:"].includes(url.protocol)) return null;
          return { url: url.href, title: String(source.title || url.hostname), domain: url.hostname };
        } catch { return null; }
      }).filter(Boolean);

      if (research?.status) {
        const badge = document.createElement("div");
        badge.className = `verification-badge ${research.status}`;
        if (research.status === "verified") {
          const when = research.verifiedAt
            ? new Date(research.verifiedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
            : "à l'instant";
          badge.textContent = `✓ Recherche web vérifiée · ${safeSources.length} source${safeSources.length > 1 ? "s" : ""} · ${when}`;
        } else {
          badge.textContent = "Non vérifié — aucune réponse factuelle fournie";
        }
        div.prepend(badge);
      }

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
          a.textContent = `${i + 1}. ${title} — ${s.domain}`;
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
    const res = await footApiFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Le serveur reconstruit lui-même le contexte depuis une source fiable.
      body: JSON.stringify({ messages: history, league: CURRENT_LEAGUE.apiCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || ([404, 405, 501].includes(res.status) ? "pas de serveur IA sur cet hébergement" : `Erreur ${res.status}`));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function handleQuestion(text) {
    addMessage(text, "user");
    history.push({ role: "user", content: text });

    if (!aiAvailable) {
      history.pop();
      return addMessage(unavailableText(), "bot", [], { status: "unavailable" });
    }

    const typing = addMessage("…", "bot typing");
    typing.textContent = "Je réfléchis";
    input.disabled = sendBtn.disabled = true;
    try {
      const { reply, sources, research } = await askAI();
      typing.remove();
      if (research?.status === "verified" && Array.isArray(sources) && sources.length) {
        history.push({ role: "assistant", content: reply });
      } else {
        history.pop();
      }
      addMessage(reply, "bot", sources || [], research || { status: "unavailable" });
    } catch (e) {
      typing.remove();
      // Aucun repli sur des données anciennes : une panne reste visible et honnête.
      if ([404, 405, 501, 503].includes(e.status) || !e.status) {
        aiAvailable = false;
        history.pop();
        serviceStatus.textContent = "Recherche vérifiée indisponible";
        serviceStatus.classList.add("offline");
        addMessage(unavailableText(), "bot", [], { status: "unavailable" });
      } else {
        history.pop(); // la question pourra être reposée
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

  if (!aiAvailable) {
    serviceStatus.textContent = "Recherche vérifiée non connectée";
    serviceStatus.classList.add("offline");
  }

  return { toggle, addMessage, ask: handleQuestion };
})();
