/* =========================================================
   COMPOSITIONS ENREGISTRÉES (vrais joueurs)
   ---------------------------------------------------------
   Source : ligue1.com – « J10 : Les compositions probables »,
   publié le 08/11/2026 (10e journée de Ligue 1 2026-2027).
   https://ligue1.com/fr/articles/l1_article_5704-les-compositions-probables-ligue-1-2026-2027

   Les compos probables de la 11e journée (20-22 novembre) ne sont pas
   encore publiées (trêve internationale) : on affiche donc le dernier
   onze probable connu de chaque équipe, à confirmer.
   Pour la version à jour, bouton « Actualiser avec l'IA » (clé Anthropic).

   Format compact : chaque ligne du gardien vers l'attaque,
   joueurs de gauche à droite, séparés par « | ».
   ========================================================= */

let SAVED_LINEUPS_INFO = {
  date: "08/11/2026",
  source: { titre: "ligue1.com – J10 : Les compositions probables (08/11/2026)", url: "https://ligue1.com/fr/articles/l1_article_5704-les-compositions-probables-ligue-1-2026-2027" },
  note: "Dernier onze probable connu de chaque équipe (10e journée, publié par la Ligue 1 le 08/11/2026). Les compositions de la 11e journée ne sont pas encore publiées : elles peuvent changer (blessures, suspensions, retours de sélection).",
};

let SAVED_LINEUPS_RAW = {
  TFC: { names: ["Toulouse"], formation: "4-2-3-1",
    lines: ["Restes", "Tapé | Nicolaisen | McKenzie | I. Diallo", "Casseres | Sigur", "Oppong | T. Jorgensen | Hidalgo", "Tengstedt"],
    absents: [["Donnum", "Suspendu"], ["Messali", "Absent"], ["Amougou", "Absent"], ["Odogu", "Absent"], ["A. Francis", "Absent"]] },
  RCS: { names: ["Strasbourg"], formation: "4-2-3-1",
    lines: ["F. Jorgensen", "Oso | K. Coulibaly | I. Doukouré | Högsberg", "El Mourabet | Essugo", "Godo | Reyna | Yassine", "Harder"],
    absents: [["F. Baldé", "Absent"], ["Panichelli", "Absent"]] },
  AJA: { names: ["Auxerre"], formation: "3-4-3",
    lines: ["Nardi", "Akpa | Tuanzebe (ou Senaya) | Makosso", "Oppegard | Danois | N. Ahamada | L. Sy", "Archer | Namaso | Faivre"],
    absents: [["L. Dioubaté", "Suspendu"], ["S. Fofana", "Absent"], ["Zaddy", "Absent"], ["A. Dioussé", "Absent"], ["Okoh", "Absent"]] },
  PFC: { names: ["Paris FC"], formation: "4-2-3-1",
    lines: ["Trapp", "Otavio | D. Coppola | Mbow | H. Traoré", "Lees-Melou | M. Lopez", "M. Simon (ou Koleosho) | Pagis | Kebbal", "L. Sinayoko"],
    absents: [["A. Camara", "Absent"], ["Chergui", "Absent"], ["Sangui", "Absent"], ["Ikoné", "Absent"]] },
  PSG: { names: ["Paris Saint-Germain", "PSG"], formation: "4-3-3",
    lines: ["Safonov", "Digne | L. Hernandez | Zabarnyi | Zaïre-Emery", "Dro Fernandez | Beraldo | J. Neves (ou F. Ruiz)", "Godts | Mayulu | F. Torres"],
    absents: [["Akliouche", "Absent"], ["Hakimi", "Absent"], ["N. Mendes", "Absent"], ["Marquinhos", "Absent"], ["O. Dembélé", "Absent"], ["Kvaratskhelia", "Absent"]] },
  EST: { names: ["Troyes"], formation: "4-3-3",
    lines: ["H. Konaté", "Boura (ou Gozzi) | J. Diaz | Monfray | Maronnier", "M. Diop | Karim | Mille", "K. Diawara (ou Nkada) | Ripart | Ifnaoui"],
    absents: [["Ouzenadji", "Absent"], ["Y. Koné", "Absent"]] },
  REN: { names: ["Rennes"], formation: "5-3-2",
    lines: ["B. Samba", "Nagida | Rouault | Cresswell | Aït Boudlal | Reynolds", "Thomasson (ou M. Camara) | Rongier | Szymanski", "Al-Tamari | B. Dia"],
    absents: [["Lepaul", "Absent"], ["Nordin", "Absent"]] },
  LIL: { names: ["Lille"], formation: "4-3-3",
    lines: ["Özer", "Perraud | Alexsandro | Nianzou | Ngoy", "B. André | Bentaleb (ou Kjaergaard) | Mukau", "Diaoune | Haraldsson | E. Mbappé"],
    absents: [["Ueda", "Absent"], ["Igamane", "Absent"], ["T. Santos", "Absent"]] },
  SCO: { names: ["Angers"], formation: "4-5-1",
    lines: ["A. Lopes", "J. Kalulu | Lefort | O. Camara | Arcus", "Sbaï | van den Boomen | Belkebla | Belkhdim | Allevinah", "Peter"],
    absents: [["El Ouazzani", "Absent"], ["B. Diatta", "Absent"]] },
  NIC: { names: ["Nice"], formation: "3-4-3",
    lines: ["Y. Diouf", "Mandza | Ndayishimiye | Abdelmonem", "Nkounkou | Boudaoui | Witsel (ou D. Coulibaly) | Clauss", "Wahi | Amoura | S. Diop"],
    absents: [["Abdi", "Absent"], ["Bombito", "Absent"], ["Abergel", "Absent"], ["A. Mendy", "Absent"], ["Abdul Samed", "Absent"]] },
  BRE: { names: ["Brest"], formation: "4-2-3-1",
    lines: ["Selvik", "Locko | G. Lloris | Tousart | Lala", "Magnetti | Chotard", "Mboup | K. Doumbia | M. Baldé (ou Versini)", "Ajorque"],
    absents: [["Chardonnet", "Absent"], ["Le Guen", "Absent"]] },
  OL: { names: ["Lyon"], formation: "4-3-3",
    lines: ["Greif", "Abner | M. Niakhaté | Bacher | Athekame", "Tolisso | Tessmann | Bidstrup", "K. Nakamura | Nuamah | Duranville"],
    absents: [["Morton", "Absent"], ["Himbert", "Absent"], ["Kango", "Absent"], ["Sulc", "Absent"], ["Openda", "Absent"], ["Ouedraogo", "Absent"]] },
  HAC: { names: ["Le Havre"], formation: "4-2-3-1",
    lines: ["Gallon (ou Bodart)", "M. N'Diaye | Touba | Mwanga | Ouziad", "Richardson | Ebonog", "Mizuta | Samatta | R. Fofana", "Maja"],
    absents: [["Seko", "Suspendu"], ["R. Ndiaye", "Absent"], ["S. Nakamura", "Absent"], ["Jelert", "Absent"], ["T. Pembélé", "Absent"], ["Mambimbi", "Absent"], ["S. Zagadou", "Absent"], ["Mpasi", "Absent"]] },
  LOR: { names: ["Lorient"], formation: "3-4-2-1",
    lines: ["Mvogo", "I. Touré | Talbi | Adjei", "A. Kouassi | Avom (ou Mbamba) | Cadiou | D. Sylla", "Makengo | Bernardeau (ou S. Faye)", "Tosin"],
    absents: [["Katseris", "Absent"], ["I. Baldé", "Absent"]] },
  LMF: { names: ["Le Mans"], formation: "3-5-2",
    lines: ["Kocik", "Torrente | Yohou | Boissé", "Calodat | Bretelle | Lauray | Rabillard | Buades", "D. Gueye | Mafouta"],
    absents: [["Bourabaa", "Absent"], ["D. Sidibé", "Absent"], ["H. Diallo", "Absent"], ["Brahimi", "Absent"], ["Colas", "Incertain"], ["Eyoum", "Incertain"], ["Rossignol", "Incertain"]] },
  ASM: { names: ["Monaco"], formation: "4-2-3-1",
    lines: ["Hradecky", "Nazinho | Dier | S. Sané | Vanderson", "Zakaria | L. Camara", "Abline | Golovin | Minamino (ou E. Diop)", "Brunner (ou Balogun)"],
    absents: [["Fati", "Absent"], ["Idumbo", "Absent"]] },
  RCL: { names: ["Lens"], formation: "3-4-2-1",
    lines: ["Risser", "Todibo | Baidoo | Gradit (ou Aguilar)", "Udol | A. Haidara (ou Titraoui) | Cuisance | Abdulhamid", "Sotoca | Thauvin", "T. Hazard"],
    absents: [["Ivanovic", "Absent"], ["Édouard", "Absent"], ["Ganiou", "Absent"], ["Sima", "Absent"], ["Nawrocki", "Absent"]] },
  OM: { names: ["Marseille"], formation: "4-2-3-1",
    lines: ["De Lange", "U. Garcia | Aguerd | Egan-Riley | Weah", "Nnadi | Hojbjerg", "Paixão | Abdelli | Harit", "Gouiri"],
    absents: [["Cornelius", "Absent"], ["Emerson", "Absent"], ["Moumbagna", "Absent"]] },
};

// Convertit le format compact vers le format affiché par le site
// (le même que celui renvoyé par l'IA).
function savedLineupFor(teamId, teamName) {
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let raw = SAVED_LINEUPS_RAW[teamId];
  if (!raw && teamName) {
    raw = Object.values(SAVED_LINEUPS_RAW).find(t => t.names.some(n => norm(teamName).includes(norm(n))));
  }
  if (!raw) return null;
  const n = raw.lines.length;
  const poste = i => (i === 0 ? "G" : i === 1 ? "DÉF" : i === n - 1 ? "ATT" : "MIL");
  return {
    schema_tactique: raw.formation,
    lignes: raw.lines.map((line, i) => line.split("|").map(nom => ({ nom: nom.trim(), poste: poste(i) }))),
    absents: raw.absents.map(([nom, raison]) => ({ nom, raison })),
    entraineur: "",
  };
}
