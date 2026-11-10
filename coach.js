/* =========================================================
   RUBRIQUE COACH
   ---------------------------------------------------------
   - Catalogue de séances (js/training-data.js) avec filtres
   - Fiche détaillée d'une séance : copier / imprimer
   - Chatbot coach : conseils et programmes personnalisés.
     Avec le serveur + clé Anthropic : Claude (route /api/coach).
     Sinon : moteur local basé sur le catalogue.
   ========================================================= */

const Coach = (() => {
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
  const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = id => TRAINING_SESSIONS.find(s => s.id === id);
  const qLabel = q => `${TRAINING_QUALITIES[q].icon} ${TRAINING_QUALITIES[q].label}`;

  // ---------- Catalogue ----------
  function initFilters() {
    $("#coach-quality").innerHTML = `<option value="">Toutes les qualités</option>` +
      Object.entries(TRAINING_QUALITIES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join("");
    $("#coach-level").innerHTML = `<option value="">Tous les niveaux</option>` +
      Object.entries(TRAINING_LEVELS).filter(([k]) => k !== "tous").map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    ["#coach-quality", "#coach-level"].forEach(sel => $(sel).addEventListener("change", renderCatalog));
    $("#coach-search").addEventListener("input", renderCatalog);
  }

  function renderCatalog() {
    const q = $("#coach-quality").value, lvl = $("#coach-level").value, txt = norm($("#coach-search").value.trim());
    const list = TRAINING_SESSIONS.filter(s =>
      (!q || s.qualite === q) &&
      (!lvl || s.niveau === lvl || s.niveau === "tous") &&
      (!txt || norm(`${s.titre} ${s.joueur} ${s.poste}`).includes(txt)));
    $("#coach-grid").innerHTML = list.length ? list.map(s => `
      <button type="button" class="session-card" data-id="${s.id}" aria-label="Voir la séance ${escH(s.titre)}">
        <div class="session-quality">${qLabel(s.qualite)}</div>
        <h3>${escH(s.titre)}</h3>
        <div class="session-player">Inspirée de <strong>${escH(s.joueur)}</strong> · ${escH(s.poste)}</div>
        <div class="session-meta"><span>⏱️ ${s.duree} min</span><span>📈 ${TRAINING_LEVELS[s.niveau]}</span><span>🏃 ${s.exercices.length} exercices</span></div>
      </button>`).join("") : `<p class="subtitle">Aucune séance ne correspond à ces filtres.</p>`;
    document.querySelectorAll(".session-card").forEach(c => c.addEventListener("click", () => openSession(c.dataset.id)));
  }

  // ---------- Fiche séance ----------
  function openSession(id) {
    const s = byId(id);
    if (!s) return;
    let t = 0;
    const steps = s.exercices.map((e, i) => {
      const start = t; t += e.duree || 0;
      return `
        <div class="exercise">
          <div class="ex-time">${start}–${t} min</div>
          <div class="ex-body">
            <h3>${i + 1}. ${escH(e.nom)} ${e.volume ? `<span class="badge">${escH(e.volume)}</span>` : ""}</h3>
            <p>${escH(e.detail)}</p>
          </div>
        </div>`;
    }).join("");
    $("#session-detail").innerHTML = `
      <div class="card">
        <div class="session-quality">${qLabel(s.qualite)}</div>
        <h1>${escH(s.titre)}</h1>
        <p class="subtitle">Séance inspirée du style de <strong>${escH(s.joueur)}</strong> · ${escH(s.poste)} · ⏱️ ${s.duree} min · 📈 ${TRAINING_LEVELS[s.niveau]}</p>
        <div class="insight">🎯 <strong>Objectif :</strong> ${escH(s.objectif)}</div>
        <div class="insight">⭐ <strong>Pourquoi ce joueur :</strong> ${escH(s.style)}</div>
        <div class="insight warn">ℹ️ Ce n'est pas l'entraînement réel du joueur (non public) : ce sont des exercices classiques qui travaillent les mêmes qualités.</div>
        <p><strong>Matériel :</strong> ${s.materiel.map(escH).join(", ")}</p>
        <div class="session-actions">
          <button class="primary" id="copy-session">📋 Copier la séance</button>
          <button class="secondary" id="print-session">🖨️ Imprimer</button>
          <span id="copy-msg" class="subtitle"></span>
        </div>
      </div>
      <div class="card"><h2>Déroulé de la séance</h2>${steps}</div>
      <div class="card"><h2>Conseils du coach</h2>${s.conseils.map(c => `<div class="insight">${escH(c)}</div>`).join("")}</div>`;
    $("#copy-session").addEventListener("click", () => copyText(sessionText(s)));
    $("#print-session").addEventListener("click", () => window.print());
    showView("session");
  }

  function sessionText(s) {
    let t = 0;
    return [
      `${s.titre.toUpperCase()}`,
      `Inspirée du style de ${s.joueur} (${s.poste}) – ${s.duree} min – ${TRAINING_LEVELS[s.niveau]}`,
      `Objectif : ${s.objectif}`,
      `Matériel : ${s.materiel.join(", ")}`,
      "",
      ...s.exercices.map((e, i) => { const a = t; t += e.duree || 0; return `${i + 1}. [${a}-${t} min] ${e.nom}${e.volume ? ` (${e.volume})` : ""}\n   ${e.detail}`; }),
      "",
      "Conseils :",
      ...s.conseils.map(c => `- ${c}`),
      "",
      "Source : FootAnalyse – séance inspirée du style du joueur, pas son entraînement réel.",
    ].join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    $("#copy-msg").textContent = "✅ Séance copiée : colle-la dans tes notes !";
  }

  // ---------- Chatbot coach (moteur local) ----------
  const PLAYER_KEYS = [
    [/mbappe/, "vitesse-profondeur"], [/haaland/, "finition-surface"], [/messi/, "dribble-espaces-reduits"],
    [/ronaldo|cr7/, "tete-detente"], [/yamal/, "dribble-aile"], [/de bruyne|kdb/, "passe-vision"],
    [/modric/, "controle-oriente"], [/van dijk/, "defense-duels"], [/kante/, "endurance-recuperation"],
    [/courtois|neuer/, "gardien-reflexes"], [/bellingham/, "box-to-box"], [/\bkane\b/, "avant-centre-complet"],
  ];
  const QUALITY_KEYS = [
    ["gardien", /gardien|goal\b|plongeon|arrets?\b|cage/],
    ["vitesse", /vite|vitesse|sprint|explosi|accelera|rapide|demarrage/],
    ["finition", /finition|frapp|tirer|\btir\b|marquer|buteur|efficace devant/],
    ["dribble", /dribbl|conduite|feinte|eliminer|1 ?(contre|vs|v) ?1|crochet/],
    ["passe", /passe|vision|centre|controle|technique|premiere touche/],
    ["tete", /\btete|detente|sauter|saut|coup franc|aerien/],
    ["defense", /defen|duel|tacle|marquage|interception/],
    ["endurance", /endurance|cardio|souffle|courir plus|fatigue vite|fractionne|volume de course/],
    ["physique", /muscu|renforc|force|prevention|gainage|physique|musculation/],
  ];
  const POSTE_KEYS = [
    ["gardien", /gardien/], ["defense", /defenseur|central|lateral|arriere/],
    ["passe", /milieu|meneur|numero 10|relayeur/], ["dribble", /ailier/], ["finition", /attaquant|avant[ -]centre|buteur|numero 9/],
  ];

  function detect(q) {
    const players = PLAYER_KEYS.filter(([re]) => re.test(q)).map(([, id]) => id);
    let qualities = QUALITY_KEYS.filter(([, re]) => re.test(q)).map(([k]) => k);
    if (!qualities.length) qualities = POSTE_KEYS.filter(([, re]) => re.test(q)).map(([k]) => k);
    const level = /debutant|commence|je debute|enfant|petit|\b(8|9|10|11|12|13) ans/.test(q) ? "debutant"
      : /avance|confirme|haut niveau|centre de formation|semi[- ]pro/.test(q) ? "avance" : null;
    const days = Number((q.match(/(\d)\s*(fois|jours?|seances?|entrainements?)/) || [])[1]) || null;
    return { players, qualities, level, days };
  }

  function pickSessions(qualities, level, max = 3) {
    let list = TRAINING_SESSIONS.filter(s => qualities.includes(s.qualite));
    if (level === "debutant") list = list.filter(s => s.niveau !== "avance");
    return list.slice(0, max);
  }

  const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const DAY_SLOTS = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

  function weeklyPlan(qualities, level, days) {
    const n = Math.min(Math.max(days || 3, 1), 5);
    const main = pickSessions(qualities.length ? qualities : ["vitesse", "passe", "finition"], level, 4);
    const pool = [...main];
    if (n >= 2) pool.splice(1, 0, byId("renforcement-prevention"));
    const plan = DAY_SLOTS[n].map((d, i) => ({ jour: JOURS[d], s: pool[i % pool.length] }));
    const lines = plan.map(p => `- **${p.jour}** : ${p.s.titre} (${p.s.duree} min)`);
    const ids = [...new Set(plan.map(p => p.s.id))];
    return {
      text: `Voici un programme sur **${n} jour${n > 1 ? "s" : ""}** par semaine${level ? ` (niveau ${TRAINING_LEVELS[level].toLowerCase()})` : ""} :\n${lines.join("\n")}\n` +
        `- Les autres jours : repos ou activité légère (vélo, natation, marche).\n\n` +
        `*Règles d'or : jamais de séance de vitesse la veille d'un match, au moins un jour de repos complet, et on arrête en cas de douleur.*`,
      sessions: ids,
    };
  }

  function localReply(question) {
    const q = norm(question);
    const has = re => re.test(q);
    const { players, qualities, level, days } = detect(q);

    if (has(/j ai mal|douleur|je suis blesse|blessure a|entorse|tendinite|claquage|je me suis fait mal/)) {
      return { text: "⚠️ Si tu as une douleur, **ne t'entraîne pas dessus**. Repos, glace les premières 48 h si c'est un choc, et **consulte un médecin ou un kiné** si la douleur dure plus de quelques jours ou t'empêche de marcher normalement.\n\nUne fois rétabli, la séance de renforcement aide à éviter de se reblesser :", sessions: ["renforcement-prevention"] };
    }
    if (has(/programme|plan|planning|semaine|routine|organiser|combien de fois/)) {
      return weeklyPlan([...new Set([...players.map(id => byId(id).qualite), ...qualities])], level, days);
    }
    if (players.length) {
      const s = byId(players[0]);
      return { text: `Pour progresser comme **${s.joueur}**, travaille ses points forts. ${s.style}\n\nSéance conseillée : **${s.titre}** (${s.duree} min, ${TRAINING_LEVELS[s.niveau].toLowerCase()}).\n*Ce n'est pas son entraînement réel (non public), mais des exercices qui travaillent les mêmes qualités.*`, sessions: [s.id] };
    }
    if (has(/echauff/)) {
      return { text: `**Échauffement type (10 min)** :\n- ${WARMUP.detail}\n\nAvec ballon :\n- ${WARMUP_BALL.detail}\n\nUn bon échauffement réduit le risque de blessure : ne le saute jamais, surtout avant les sprints.`, sessions: [] };
    }
    if (has(/recup|etire|etirement|courbature|sommeil|dormir|repos/)) {
      return { text: "**Bien récupérer** :\n- Dors 8 à 10 h (c'est là que le corps progresse).\n- Bois de l'eau régulièrement, avant, pendant et après l'effort.\n- Retour au calme et étirements doux après chaque séance.\n- Au moins 1 jour de repos complet par semaine, et 48 h entre deux séances intenses.\n- Les courbatures sont normales après un nouvel effort ; une douleur vive ne l'est pas.", sessions: [] };
    }
    if (has(/manger|nutrition|aliment|regime|repas|boire|hydrat/)) {
      return { text: "**Alimentation du footballeur (conseils généraux)** :\n- Des féculents (pâtes, riz, pain) au repas qui précède l'entraînement, pour l'énergie.\n- Des protéines (viande, poisson, œufs, légumineuses) pour la récupération.\n- Fruits et légumes à chaque repas.\n- De l'eau avant, pendant et après l'effort.\n*Pour un suivi personnalisé, demande conseil à un professionnel de santé ou un diététicien.*", sessions: [] };
    }
    if (qualities.length) {
      const list = pickSessions(qualities, level);
      if (list.length) {
        return { text: `Pour travailler ${qualities.map(k => `**${TRAINING_QUALITIES[k].label.toLowerCase()}**`).join(" et ")}, je te conseille :\n` +
          list.map(s => `- **${s.titre}**, inspirée de ${s.joueur} (${s.duree} min, ${TRAINING_LEVELS[s.niveau].toLowerCase()})`).join("\n") +
          `\n\nTu veux un programme sur la semaine ? Dis-moi par exemple « programme 3 jours pour la vitesse ».`, sessions: list.map(s => s.id) };
      }
    }
    return {
      text: "Je suis ton coach ⚽ Dis-moi ce que tu veux améliorer, par exemple :\n- « Je veux être plus rapide »\n- « Une séance pour jouer comme Messi »\n- « Programme 3 jours pour un milieu débutant »\n- « Comment bien s'échauffer ? »\n- « Je suis gardien, quels exercices ? »",
      sessions: [],
    };
  }

  // ---------- Chatbot coach (interface) ----------
  const history = [];
  let aiAvailable = true, noticeShown = false;

  function formatText(text) {
    const esc = escH(text);
    return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/^\s*[-•]\s+/gm, "• ").replace(/\n/g, "<br>");
  }

  function addMessage(text, from, sessions = []) {
    const div = document.createElement("div");
    div.className = `msg ${from}`;
    if (from === "bot") {
      div.innerHTML = formatText(text);
      if (sessions.length) {
        const box = document.createElement("div");
        box.className = "msg-actions";
        sessions.forEach(id => {
          const s = byId(id);
          if (!s) return;
          const b = document.createElement("button");
          b.textContent = `Voir : ${s.titre}`;
          b.addEventListener("click", () => openSession(id));
          box.appendChild(b);
        });
        div.appendChild(box);
      }
    } else div.textContent = text;
    $("#coach-messages").appendChild(div);
    $("#coach-messages").scrollTop = $("#coach-messages").scrollHeight;
    return div;
  }

  function catalogContext() {
    return "SÉANCES DU SITE (inspirées du style de joueurs, pas leurs entraînements réels) :\n" +
      TRAINING_SESSIONS.map(s => `- [${s.id}] ${s.titre} – inspirée de ${s.joueur} (${s.poste}) – ${TRAINING_QUALITIES[s.qualite].label} – ${s.duree} min – ${TRAINING_LEVELS[s.niveau]}\n  Exercices : ${s.exercices.map(e => `${e.nom}${e.volume ? ` (${e.volume})` : ""}`).join(" ; ")}`).join("\n");
  }

  async function ask(text) {
    addMessage(text, "user");
    history.push({ role: "user", content: text });
    const input = $("#coach-input");
    if (aiAvailable) {
      const typing = addMessage("Le coach réfléchit…", "bot typing");
      input.disabled = true;
      try {
        const res = await footApiFetch("/api/coach", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, context: catalogContext() }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) { const e = new Error((data && data.error) || "pas de serveur IA"); e.status = res.status; throw e; }
        typing.remove();
        history.push({ role: "assistant", content: data.reply });
        // Boutons vers les séances citées par l'IA ([id] dans le texte)
        const ids = TRAINING_SESSIONS.filter(s => data.reply.includes(s.id) || data.reply.includes(s.titre)).map(s => s.id);
        addMessage(data.reply.replace(/\[([a-z-]+)\]/g, ""), "bot", ids.slice(0, 4));
        input.disabled = false; input.focus();
        return;
      } catch (e) {
        typing.remove();
        aiAvailable = false;
      } finally { input.disabled = false; }
    }
    const r = localReply(text);
    const notice = noticeShown ? "" : "*Mode coach local (sans IA) : je te conseille à partir des séances du site.*\n\n";
    noticeShown = true;
    history.push({ role: "assistant", content: r.text });
    addMessage(notice + r.text, "bot", r.sessions);
  }

  function initChat() {
    const SUGG = ["Je veux être plus rapide", "Jouer comme Messi", "Programme 3 jours pour un milieu débutant", "Je suis gardien", "Comment bien récupérer ?"];
    $("#coach-suggestions").innerHTML = "";
    SUGG.forEach(t => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = t;
      b.addEventListener("click", () => ask(t));
      $("#coach-suggestions").appendChild(b);
    });
    $("#coach-form").addEventListener("submit", e => {
      e.preventDefault();
      const t = $("#coach-input").value.trim();
      if (!t) return;
      $("#coach-input").value = "";
      ask(t);
    });
  }

  function init() { initFilters(); renderCatalog(); initChat(); }
  return { init, openSession, localReply, ask };
})();

Coach.init();
