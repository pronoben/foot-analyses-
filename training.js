/* Profil joueur local et génération d'un programme d'entraînement explicable. */
(() => {
  const form = document.getElementById("player-profile-form");
  const planBox = document.getElementById("training-plan");
  const storageKey = "footanalyse-player-profile-v1";

  const drills = {
    technique: ["Conduite de balle et changements de direction", "Première touche sous pression", "Passes courtes des deux pieds"],
    vitesse: ["Échauffement dynamique", "Accélérations 6 × 15 m", "Appuis et changements de direction"],
    endurance: ["Course intermittente avec ballon", "Jeu réduit à haute intensité", "Retour au calme progressif"],
    tactique: ["Lecture des espaces sur vidéo", "Déplacements propres au poste", "Jeu de position avec contraintes"],
    finition: ["Frappe après contrôle orienté", "Finition en une touche", "Duels face au gardien"],
  };

  const positionFocus = {
    gardien: "prises de balle, relance et placement",
    defenseur: "duels, couverture et première relance",
    milieu: "orientation du corps, vision et passes sous pression",
    ailier: "accélération, un contre un et centres",
    attaquant: "appels, finition et jeu dos au but",
  };

  const levelGuidance = {
    "débutant": "garde une intensité modérée et privilégie la qualité du geste",
    loisir: "alterne effort et récupération pour rester régulier",
    amateur: "travaille à intensité match sur les blocs principaux",
    "régional": "ajoute des contraintes de temps et de pression",
    "semi-professionnel": "mesure tes séries et vise une exécution à haute intensité",
    professionnel: "intègre la séance à la charge planifiée avec ton staff",
  };

  function readProfile() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function saveProfile(profile) {
    localStorage.setItem(storageKey, JSON.stringify(profile));
  }

  function restoreProfile() {
    try {
      const profile = JSON.parse(localStorage.getItem(storageKey) || "{}");
      Object.entries(profile).forEach(([name, value]) => {
        if (form.elements[name]) form.elements[name].value = value;
      });
      if (Object.keys(profile).length) renderPlan(profile);
    } catch { localStorage.removeItem(storageKey); }
  }

  function renderPlan(profile) {
    planBox.replaceChildren();
    const sessions = Math.max(1, Math.min(Number(profile.sessions) || 2, 5));
    const duration = Math.max(30, Math.min(Number(profile.duration) || 60, 120));
    const focus = drills[profile.goal] || drills.technique;

    const intro = document.createElement("div");
    intro.className = "card plan-intro";
    const title = document.createElement("h2");
    title.textContent = `Programme ${profile.level || "amateur"} · ${profile.position || "joueur"}`;
    const text = document.createElement("p");
    text.textContent = `${sessions} séance(s) par semaine de ${duration} minutes pour un joueur basé en ${profile.country || "ton pays"}. Priorité : ${profile.goal || "technique"}, avec un travail spécifique sur ${positionFocus[profile.position] || "les fondamentaux"}. Conseil de niveau : ${levelGuidance[profile.level] || levelGuidance.amateur}.`;
    intro.append(title, text);
    planBox.append(intro);

    for (let index = 0; index < sessions; index += 1) {
      const card = document.createElement("article");
      card.className = "card training-session";
      const heading = document.createElement("h3");
      heading.textContent = `Séance ${index + 1}`;
      const list = document.createElement("ol");
      const sequence = [
        `Échauffement et mobilité · ${Math.round(duration * 0.15)} min`,
        `${focus[index % focus.length]} · ${Math.round(duration * 0.35)} min`,
        `${positionFocus[profile.position] || "Situation de jeu"}, avec un bloc pied ${profile.foot === "droit" ? "gauche" : profile.foot === "gauche" ? "droit" : "alterné"} · ${Math.round(duration * 0.35)} min`,
        `Retour au calme et bilan · ${Math.round(duration * 0.15)} min`,
      ];
      sequence.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        list.append(li);
      });
      card.append(heading, list);
      planBox.append(card);
    }

    const note = document.createElement("p");
    note.className = "training-note";
    note.textContent = "Ce programme est une base éducative. Adapte l'intensité à ton état de forme et demande l'avis d'un entraîneur qualifié en cas de douleur ou de reprise après blessure.";
    planBox.append(note);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const profile = readProfile();
    saveProfile(profile);
    renderPlan(profile);
  });

  restoreProfile();
})();

