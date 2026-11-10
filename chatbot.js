/* =========================================================
   CHATBOT – interface
   ---------------------------------------------------------
   Envoie la conversation au serveur (/api/chat), qui interroge
   Claude avec recherche web (voir chatbot_ai.py).
   Si le serveur IA n'est pas disponible (pas de clé, pas
   d'internet…), on bascule sur des réponses simples par mots-clés.
   ========================================================= */

const Chatbot = (() => {
  const panel = document.getElementById("chat-panel");
  const messages = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = form.querySelector("button");
  const history = []; // { role: "user" | "assistant", content }
  let aiAvailable = true;

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

  function addMessage(text, from, sources = []) {
    const div = document.createElement("div");
    div.className = `msg ${from}`;
    if (from === "bot") {
      div.innerHTML = formatText(text);
      const safeSources = (Array.isArray(sources) ? sources : []).map(source => {
        try {
          const url = new URL(String(source.url || ""));
          if (!["http:", "https:"].includes(url.protocol)) return null;
          return { url: url.href, title: String(source.title || url.hostname) };
        } catch { return null; }
      }).filter(Boolean);
      if (safeSources.length) {
        const src = document.createElement("div");
        src.className = "sources";
        src.textContent = "Sources : ";
        safeSources.forEach((s, i) => {
          const a = document.createElement("a");
          a.href = s.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = s.title.length > 40 ? s.title.slice(0, 40) + "…" : s.title;
          if (i) src.append(" · ");
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

  // Réponses sans IA : moteur d'analyse local (js/chat-local.js)
  const localReply = question => LocalBot.reply(question);
  let noticeShown = false;

  async function handleQuestion(text) {
    addMessage(text, "user");
    history.push({ role: "user", content: text });

    if (!aiAvailable) {
      const reply = localReply(text);
      history.push({ role: "assistant", content: reply });
      return addMessage(reply, "bot");
    }

    const typing = addMessage("…", "bot typing");
    typing.textContent = "Je réfléchis";
    input.disabled = sendBtn.disabled = true;
    try {
      const { reply, sources } = await askAI();
      typing.remove();
      history.push({ role: "assistant", content: reply });
      addMessage(reply, "bot", sources || []);
    } catch (e) {
      typing.remove();
      // 503 = pas de clé / SDK non installé / site ouvert sans server.py : mode simple
      if ([404, 405, 501, 503].includes(e.status) || !e.status) {
        aiAvailable = false;
        const reply = localReply(text);
        history.push({ role: "assistant", content: reply });
        const notice = noticeShown ? "" : `*Mode analyse locale (IA indisponible : ${e.message}) — je réponds avec les données et le modèle du site.*\n\n`;
        noticeShown = true;
        addMessage(notice + reply, "bot");
      } else {
        history.pop(); // la question pourra être reposée
        addMessage(`⚠️ ${e.message}`, "bot");
      }
    } finally {
      input.disabled = sendBtn.disabled = false;
      input.focus();
    }
  }

  // Suggestions de questions (cliquables)
  const SUGGESTIONS = [
    "Analyse Lille – Lyon",
    "Qui va gagner Nice – PSG ?",
    "Compo probable de l'OM",
    "Quel est le match le plus serré de la journée ?",
    "Plus de 2,5 buts entre Lens et Toulouse ?",
    "Comment marche le pronostic ?",
    "Stats de Sinayoko",
    "Meilleurs passeurs",
    "Compare Gouiri et Wahi",
    "Qui va gagner Liverpool – Man United ?",
    "Stats de Haaland",
    "Compo probable du Real Madrid",
    "Classement de la Serie A",
    "Meilleurs buteurs de Bundesliga",
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

  return { toggle, addMessage, ask: handleQuestion };
})();
