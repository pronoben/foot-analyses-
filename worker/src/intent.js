// Compréhension des questions : règles déterministes uniquement.
// Le texte de l'utilisateur n'est jamais envoyé à l'IA : aucune injection de
// prompt ne peut donc modifier une réponse.

import { norm, hasPhrase, removePhrase, currentSeasonStart, seasonLabel } from "./text.js";

export const LEAGUES = {
  FL1: { name: "Ligue 1", apiFootball: 61, tsdb: "4334", aliases: ["ligue 1", "ligue1", "l1", "championnat de france", "championnat francais"] },
  PL: { name: "Premier League", apiFootball: 39, tsdb: "4328", aliases: ["premier league", "epl", "championnat anglais", "championnat d angleterre"] },
  PD: { name: "Liga", apiFootball: 140, tsdb: "4335", aliases: ["liga", "la liga", "laliga", "championnat espagnol", "championnat d espagne"] },
  SA: { name: "Serie A", apiFootball: 135, tsdb: "4332", aliases: ["serie a", "calcio", "championnat italien", "championnat d italie"] },
  BL1: { name: "Bundesliga", apiFootball: 78, tsdb: "4331", openliga: "bl1", aliases: ["bundesliga", "championnat allemand", "championnat d allemagne"] },
};
export const CHAMPIONS_LEAGUE = { code: "CL", name: "Ligue des champions", apiFootball: 2 };
const CL_ALIASES = ["ligue des champions", "champions league", "ldc", "c1", "ucl"];
const ALL_COMP_ALIASES = ["toutes competitions confondues", "toutes competitions", "toutes les competitions",
  "toutes compets", "tout compris", "au total", "all competitions"];
const UNSUPPORTED = {
  "coupe de france": "la Coupe de France", "fa cup": "la FA Cup", "carabao": "la Carabao Cup",
  "league cup": "la League Cup", "copa del rey": "la Copa del Rey", "coupe du roi": "la Coupe du Roi",
  "coppa italia": "la Coppa Italia", "dfb pokal": "la DFB-Pokal", "europa league": "la Ligue Europa",
  "ligue europa": "la Ligue Europa", "c3": "la Ligue Europa", "conference league": "la Ligue Conférence",
  "ligue conference": "la Ligue Conférence", "c4": "la Ligue Conférence", "coupe du monde": "la Coupe du monde",
  "mondial des clubs": "la Coupe du monde des clubs", "equipe de france": "les matchs en sélection",
  "selection nationale": "les matchs en sélection",
};
// Surnoms → [championnat, texte à chercher dans le nom officiel].
export const TEAM_NICKNAMES = {
  "psg": ["FL1", "paris saint germain"], "paris sg": ["FL1", "paris saint germain"],
  "paris saint germain": ["FL1", "paris saint germain"], "om": ["FL1", "marseille"], "ol": ["FL1", "lyon"],
  "losc": ["FL1", "lille"], "asse": ["FL1", "etienne"], "barca": ["PD", "barcelona"], "barcelone": ["PD", "barcelona"],
  "real madrid": ["PD", "real madrid"], "real": ["PD", "real madrid"], "atletico": ["PD", "atletico"],
  "atleti": ["PD", "atletico"], "seville": ["PD", "sevilla"], "man city": ["PL", "manchester city"],
  "manchester city": ["PL", "manchester city"], "man united": ["PL", "manchester united"],
  "man utd": ["PL", "manchester united"], "manchester united": ["PL", "manchester united"],
  "spurs": ["PL", "tottenham"], "bayern": ["BL1", "bayern"], "bayern munich": ["BL1", "bayern"],
  "bvb": ["BL1", "dortmund"], "dortmund": ["BL1", "dortmund"], "leverkusen": ["BL1", "leverkusen"],
  "leipzig": ["BL1", "leipzig"], "juve": ["SA", "juventus"], "juventus": ["SA", "juventus"],
  "inter": ["SA", "inter"], "inter milan": ["SA", "inter"], "ac milan": ["SA", "milan"], "milan": ["SA", "milan"],
  "naples": ["SA", "napoli"], "napoli": ["SA", "napoli"], "as rome": ["SA", "roma"], "rome": ["SA", "roma"],
  "lazio": ["SA", "lazio"],
};

const STOPWORDS = new Set(`
a ai as au aux avec avait avoir c ca ce ces cet cette ceux chez combien comme d dans de des du deja depuis
donc donne donner dit dis elle en encore est et etre eu il ils j je jusqu l la le les leur lui m ma mais me
mes moi mon n ne ni nombre nous on ont ou par pas pendant peux peut plus pour pourrais quand que quel quelle
quelles quels qui sa sans se ses si son sont sur t ta te tes toi ton tous tout toute toutes tu un une vos
votre vous y svp stp merci bonjour salut hello please what how many goals goal scored has have is the in of
for this season much but buts marque marques marquee marquees inscrit inscrits score scores saison saisons
cours actuelle actuel annee competition competitions confondues compets total verifie verifier verifiez
sources source deux moins recentes recente recent fiable fiables championnat match matchs joue joues jouer
joueur joueurs attaquant milieu defenseur gardien club actuellement maintenant aujourd hui dernier derniere
prochain prochaine classe classement disputes dispute rencontres rencontre apparitions titularisations
`.split(/\s+/).filter(Boolean));

const SECRET_PATTERNS = [
  /\bcles? (api|secretes?|d acces|d api|privees?|anthropic|groq|turnstile|football data|api football|du serveur|de l api|du site|du worker)\b/,
  /\bapi ?keys?\b/, /\b(token|tokens|jeton|jetons)\b/, /\bmots? de passe\b/, /\bpasswords?\b/,
  /\b(code|valeur|information|donnee)s? secret/, /\bsecrets? (du|de l|des|de la) (serveur|site|api|application|worker)\b/,
  /(^| )env( |$)/, /\bvariables? d environnement\b/, /\benvironment variables?\b/, /\bsystem prompt\b/,
  /\bprompt systeme\b/, /\btes (instructions|consignes|regles internes)\b/,
  /\b(ignore|oublie)\w* (les|tes|toutes|vos|previous|all|your)\b/,
  /\b(football data key|api football key|turnstile secret key|anthropic api key)\b/,
];
const PREDICTION = [" pronostic", " prono ", "qui va gagner", " va gagner", " gagnera ", " prediction",
  " predire ", " parier ", " pari ", " paris sportif"];
const RULE_WORDS = ["regle", "regles", "hors jeu", "penalty", "penalties", "carton rouge", "carton jaune",
  "duree d un match", "combien de temps dure", "combien de joueurs", "but valable", "arbitre", "ifab", "loi du jeu",
  "lois du jeu", "mi temps", "remplacant", "remplacants"];
const INFO_WORDS = ["qui est", "c est qui", "c est quoi", "presente moi", "presente", "parle moi de",
  "informations sur", "infos sur", "histoire de", "histoire du", "fondation", "fonde", "stade de", "palmares"];

export function detectIntent(t) {
  const padded = ` ${t} `;
  if (SECRET_PATTERNS.some(re => re.test(t))) return "secret";
  if (PREDICTION.some(w => padded.includes(w))) return "prediction";
  if (["meilleur buteur", "meilleurs buteurs", "top buteur", "top buteurs", "classement des buteurs",
    "top scorer", "top scorers", "qui a marque le plus"].some(p => hasPhrase(t, p))) return "top_scorers";
  if (["calendrier", "prochains matchs", "programme de", "fixtures"].some(p => hasPhrase(t, p))) return "schedule";
  if (["prochain match", "prochaine rencontre", "joue quand", "quand joue", "a quelle heure", "quelle heure",
    "quelle date", "next match", "coup d envoi"].some(p => hasPhrase(t, p))) return "next_match";
  if (["dernier match", "dernier resultat", "derniere rencontre", "resultat du match", "score du match",
    "last match", "resultat de", "score de"].some(p => hasPhrase(t, p))) return "last_match";
  if (RULE_WORDS.some(p => hasPhrase(t, p))) return "rules";
  if (/\bbuts?\b|\bgoals?\b/.test(t)) return "goals";
  if (/\b(combien de|nombre de) (matchs|matches|rencontres|apparitions)\b/.test(t)) return "appearances";
  if (["classement", "premier du", "leader", "en tete", "position", "quelle place", "combien de points",
    "standings"].some(p => hasPhrase(t, p))) return "standings";
  if (INFO_WORDS.some(p => hasPhrase(t, p))) return "info";
  if (hasPhrase(t, "score") || hasPhrase(t, "resultat")) return "last_match";
  return null;
}

export function parseSeason(t, now = new Date()) {
  const current = currentSeasonStart(now);
  if (["cette saison", "saison en cours", "saison actuelle", "cette annee", "en ce moment", "actuellement",
    "this season"].some(p => hasPhrase(t, p))) return { season: "current", label: seasonLabel(current) };
  let m = t.match(/(?<!\d)(20\d{2}) (20\d{2}|\d{2})(?!\d)/);
  if (m) {
    const start = Number(m[1]);
    return { season: start === current ? "current" : "other", label: seasonLabel(start), start };
  }
  m = t.match(/(?<!\d)(\d{2}) (\d{2})(?!\d)/);
  if (m && Number(m[2]) === (Number(m[1]) + 1) % 100) {
    const start = 2000 + Number(m[1]);
    return { season: start === current ? "current" : "other", label: seasonLabel(start), start };
  }
  m = t.match(/(?<!\d)(20\d{2})(?!\d)/);
  if (m) {
    const year = Number(m[1]);
    if (year === current || year === current + 1) return { season: "current", label: seasonLabel(current) };
    return { season: "other", label: String(year), start: year };
  }
  return { season: null, label: null };
}

export function parseQuestion(text, now = new Date()) {
  const t = norm(text);
  const q = { raw: text, text: t, intent: detectIntent(t), league: null, competition: null, unsupported: null };
  for (const [phrase, label] of Object.entries(UNSUPPORTED)) {
    if (hasPhrase(t, phrase)) { q.unsupported = label; break; }
  }
  if (ALL_COMP_ALIASES.some(a => hasPhrase(t, a))) q.competition = "ALL";
  else if (CL_ALIASES.some(a => hasPhrase(t, a))) q.competition = "CL";
  for (const [code, league] of Object.entries(LEAGUES)) {
    if (league.aliases.some(a => hasPhrase(t, a))) {
      q.league = code;
      if (!q.competition) q.competition = "LEAGUE";
      break;
    }
  }
  Object.assign(q, parseSeason(t, now));
  return q;
}

/** Ce qui reste une fois retirés les mots connus : le nom du joueur. */
export function residualName(t, teamWords = []) {
  let text = ` ${t} `;
  const removable = [
    ...Object.values(LEAGUES).flatMap(l => l.aliases), ...CL_ALIASES, ...ALL_COMP_ALIASES,
    ...Object.keys(UNSUPPORTED), ...teamWords,
  ].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const phrase of removable) text = removePhrase(text, phrase);
  const words = text.split(/\s+/).filter(w => w && !STOPWORDS.has(w) && !/^\d+$/.test(w) && w.length > 1);
  return words.slice(0, 4).join(" ") || null;
}

export function isSecretRequest(text) {
  return detectIntent(norm(text)) === "secret";
}
