"""
Chatbot gratuit de FootAnalyse
------------------------------
Principe (dans cet ordre, à chaque question) :
1. comprendre la question (règles simples, IA gratuite seulement en secours) ;
2. repérer ce qui manque (joueur, club, saison, compétition…) et le demander ;
3. consulter les sources autorisées (free_sources.py) ;
4. comparer les sources quand il en existe plusieurs ;
5. confier les faits obtenus à l'IA gratuite pour une phrase simple (facultatif) ;
6. répondre court, daté, avec les sources cliquables.

Garanties :
- aucun chiffre ne vient de la mémoire d'une IA : la phrase de l'IA est rejetée
  si elle contient un nombre absent des données ;
- sans donnée vérifiable, le chatbot le dit et ne répond pas ;
- aucune clé ni information interne n'est jamais renvoyée ;
- quota gratuit épuisé : message clair, aucun appel payant possible.
"""

import json
import os
import re
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timedelta

import free_sources as src
from free_sources import LEAGUES, QuotaExceeded, SourceUnavailable

MAX_USER_CHARS = 1000
MAX_MESSAGES = 40
CLARIFY_PREFIX = "Avant de chercher, j'ai besoin de précisions"
HELP_PREFIX = "Je réponds pour l'instant à ces questions"

# --------------------------------------------------------------- normalisation
def norm(text):
    text = unicodedata.normalize("NFD", str(text or "").lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[’'`´\-_/.,;:!?()\[\]«»\"]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def has_phrase(text, phrase):
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text) is not None


def tokens(text):
    return [t for t in norm(text).split() if t]


# ------------------------------------------------------------------ vocabulaire
LEAGUE_ALIASES = {
    "FL1": ["ligue 1", "ligue1", "l1", "championnat de france", "championnat francais"],
    "PL": ["premier league", "epl", "championnat anglais", "championnat d angleterre"],
    "PD": ["liga", "la liga", "laliga", "championnat espagnol", "championnat d espagne"],
    "SA": ["serie a", "calcio", "championnat italien", "championnat d italie"],
    "BL1": ["bundesliga", "championnat allemand", "championnat d allemagne"],
}
CL_ALIASES = ["ligue des champions", "champions league", "ldc", "c1", "ucl"]
ALL_COMP_ALIASES = [
    "toutes competitions", "toutes les competitions", "toutes compets", "tout compris",
    "au total", "all competitions", "toutes competitions confondues",
]
UNSUPPORTED_COMPETITIONS = {
    "coupe de france": "la Coupe de France", "fa cup": "la FA Cup", "carabao": "la Carabao Cup",
    "league cup": "la League Cup", "copa del rey": "la Copa del Rey", "coupe du roi": "la Coupe du Roi",
    "coppa italia": "la Coppa Italia", "coupe d italie": "la Coupe d'Italie", "dfb pokal": "la DFB-Pokal",
    "coupe d allemagne": "la Coupe d'Allemagne", "europa league": "la Ligue Europa",
    "ligue europa": "la Ligue Europa", "c3": "la Ligue Europa", "conference league": "la Ligue Conférence",
    "ligue conference": "la Ligue Conférence", "c4": "la Ligue Conférence", "supercoupe": "la Supercoupe",
    "trophee des champions": "le Trophée des champions", "coupe du monde": "la Coupe du monde",
    "mondial des clubs": "la Coupe du monde des clubs", "selection": "les matchs en sélection",
    "equipe nationale": "les matchs en sélection", "equipe de france": "les matchs en sélection",
}
# Surnoms courants → (championnat, mot à chercher dans le nom officiel).
TEAM_NICKNAMES = {
    "psg": ("FL1", "paris saint germain"), "paris sg": ("FL1", "paris saint germain"),
    "paris saint germain": ("FL1", "paris saint germain"), "om": ("FL1", "marseille"),
    "ol": ("FL1", "lyon"), "losc": ("FL1", "lille"), "asse": ("FL1", "etienne"),
    "barca": ("PD", "barcelona"), "barcelone": ("PD", "barcelona"), "real": ("PD", "real madrid"),
    "real madrid": ("PD", "real madrid"), "atletico": ("PD", "atletico"), "atleti": ("PD", "atletico"),
    "seville": ("PD", "sevilla"), "man city": ("PL", "manchester city"),
    "manchester city": ("PL", "manchester city"), "city": ("PL", "manchester city"),
    "man united": ("PL", "manchester united"), "man utd": ("PL", "manchester united"),
    "manchester united": ("PL", "manchester united"), "united": ("PL", "manchester united"),
    "spurs": ("PL", "tottenham"), "bayern": ("BL1", "bayern"), "bayern munich": ("BL1", "bayern"),
    "bvb": ("BL1", "dortmund"), "dortmund": ("BL1", "dortmund"), "leverkusen": ("BL1", "leverkusen"),
    "leipzig": ("BL1", "leipzig"), "juve": ("SA", "juventus"), "juventus": ("SA", "juventus"),
    "inter": ("SA", "inter"), "inter milan": ("SA", "inter"), "ac milan": ("SA", "milan"),
    "milan": ("SA", "milan"), "naples": ("SA", "napoli"), "napoli": ("SA", "napoli"),
    "rome": ("SA", "roma"), "as rome": ("SA", "roma"), "lazio": ("SA", "lazio"),
}
GENERIC_TEAM_WORDS = {
    "fc", "cf", "ac", "as", "sc", "ssc", "afc", "rc", "ogc", "club", "de", "del", "la", "le", "les",
    "football", "olympique", "sporting", "stade", "ss", "us", "vfb", "vfl", "tsg", "sv", "1", "bc",
    "calcio", "real", "cd", "ud", "rcd", "ca", "osc", "hsc", "aj", "ea", "fk", "the",
}
TEAM_SYNONYMS = {"munchen": "munich", "koln": "cologne", "monchengladbach": "gladbach"}

STOPWORDS = set("""
a ai as au aux avec avait avoir c ca ce ces cet cette ceux chez combien comme d dans de des du
deja depuis donc donne donner dit dis elle en encore est et etre eu il ils j je jusqu l la le les leur
lui m ma mais me mes moi mon n ne ni nombre nous on ont ou par pas pendant peux peut plus pour pourrais
quand que quel quelle quelles quels qui sa sans se ses si son sont sur t ta te tes toi ton tous tout
toute toutes tu un une vos votre vous y svp stp merci bonjour salut hello please what how many
goals goal scored has have is the in of for this season much
but buts marque marques marquee marquees inscrit inscrits score scores
saison saisons cours actuelle actuel annee competition competitions confondues compets total
verifie verifier verifiez sources source deux moins recentes recente recent fiable fiables
championnat match matchs joue joues jouer joueur joueurs attaquant milieu defenseur gardien club
actuellement maintenant aujourd hui dernier derniere prochain prochaine classe classement
""".split())

SECRET_PATTERNS = [
    r"\bcles? (api|secretes?|d acces|d api|privees?|anthropic|groq|football data|du serveur|de l api|du site)\b",
    r"\bapi ?keys?\b", r"\b(token|tokens|jeton|jetons)\b", r"\bmots? de passe\b", r"\bpasswords?\b",
    r"\b(code|valeur|information|donnee)s? secret", r"\bsecrets? (du|de l|des|de la) (serveur|site|api|application)\b",
    r"(^| )env( |$)", r"\bvariables? d environnement\b", r"\benvironment variables?\b",
    r"\bsystem prompt\b", r"\bprompt systeme\b", r"\btes instructions\b", r"\btes consignes\b",
    r"\b(ignore|oublie)\w* (les|tes|toutes|vos|previous|all|your)\b",
    r"\b(football data key|groq api key|anthropic api key)\b",
]
PREDICTION_WORDS = [" pronostic", " prono ", "qui va gagner", " va gagner", " gagnera ", " prediction",
                    " predire ", " parier ", " pari ", " paris sportif"]

KEY_LIKE = [
    re.compile(r"gsk_[A-Za-z0-9]{16,}"), re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"), re.compile(r"\b[a-f0-9]{32}\b"),
]


def redact(text):
    """Dernier filet : aucune valeur de clé ne peut sortir dans une réponse."""
    text = str(text)
    for name in ("FOOTBALL_DATA_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY"):
        value = os.environ.get(name, "").strip()
        if len(value) >= 8:
            text = text.replace(value, "[masqué]")
    for pattern in KEY_LIKE:
        text = pattern.sub("[masqué]", text)
    return text


# --------------------------------------------------------------------- analyse
class Query:
    def __init__(self):
        self.intent = None
        self.league = None
        self.team_text = None
        self.player = None
        self.season = None          # "current" | "other" | None
        self.season_label = None
        self.competition = None     # "LEAGUE" | "CL" | "ALL" | None
        self.unsupported = None
        self.text = ""
        self.raw = ""


def parse_season(t):
    current = src.current_season_start()
    if any(has_phrase(t, p) for p in ("cette saison", "saison en cours", "saison actuelle",
                                       "cette annee", "en ce moment", "actuellement", "this season")):
        return "current", src.season_label(current)
    m = re.search(r"(?<!\d)(20\d{2})\s+(20\d{2}|\d{2})(?!\d)", t)
    if m:
        start = int(m.group(1))
        return ("current" if start == current else "other"), f"{start}-{start + 1}"
    m = re.search(r"(?<!\d)(\d{2})\s+(\d{2})(?!\d)", t)
    if m and int(m.group(2)) == (int(m.group(1)) + 1) % 100:
        start = 2000 + int(m.group(1))
        return ("current" if start == current else "other"), f"{start}-{start + 1}"
    m = re.search(r"(?<!\d)(20\d{2})(?!\d)", t)
    if m:
        year = int(m.group(1))
        if year in (current, current + 1):
            return "current", src.season_label(current)
        return "other", str(year)
    return None, None


def detect_intent(t):
    if any(re.search(p, t) for p in SECRET_PATTERNS):
        return "secret"
    if any(w in f" {t} " for w in PREDICTION_WORDS):
        return "prediction"
    if any(has_phrase(t, p) for p in ("meilleur buteur", "meilleurs buteurs", "top buteur", "top buteurs",
                                       "classement des buteurs", "top scorer", "top scorers",
                                       "qui a marque le plus", "plus de buts")):
        return "top_scorers"
    if any(has_phrase(t, p) for p in ("prochain match", "prochaine rencontre", "joue quand",
                                       "quand joue", "prochain adversaire", "next match")):
        return "next_match"
    if any(has_phrase(t, p) for p in ("dernier match", "dernier resultat", "derniere rencontre",
                                       "resultat du match", "score du match", "last match")):
        return "last_match"
    if re.search(r"\bbuts?\b|\bgoals?\b", t):
        return "goals"
    if any(has_phrase(t, p) for p in ("classement", "premier du", "leader", "en tete", "position",
                                       "quelle place", "combien de points", "standings", "table")):
        return "standings"
    if has_phrase(t, "score") or has_phrase(t, "resultat"):
        return "last_match"
    return None


def parse_question(text):
    q = Query()
    t = norm(text)
    q.text = t
    q.raw = text
    q.intent = detect_intent(t)
    for name, label in UNSUPPORTED_COMPETITIONS.items():
        if has_phrase(t, name):
            q.unsupported = label
            break
    if any(has_phrase(t, a) for a in ALL_COMP_ALIASES):
        q.competition = "ALL"
    elif any(has_phrase(t, a) for a in CL_ALIASES):
        q.competition = "CL"
    for code, aliases in LEAGUE_ALIASES.items():
        if any(has_phrase(t, a) for a in aliases):
            q.league = code
            if q.competition is None:
                q.competition = "LEAGUE"
            break
    q.season, q.season_label = parse_season(t)
    return q


def display_name(raw_question, normalized_name):
    """Retrouve l'écriture d'origine (accents, majuscules) d'un nom détecté."""
    wanted = normalized_name.split()
    raw_words = re.findall(r"[^\s,;:!?«»\"()]+", raw_question or "")
    for i in range(len(raw_words) - len(wanted) + 1):
        if [norm(w) for w in raw_words[i:i + len(wanted)]] == wanted:
            return " ".join(raw_words[i:i + len(wanted)])
    return normalized_name.title()


def residual_name(t, team_words):
    """Ce qui reste de la question une fois retirés les mots connus : le joueur."""
    text = f" {t} "
    removable = (
        [a for aliases in LEAGUE_ALIASES.values() for a in aliases]
        + CL_ALIASES + ALL_COMP_ALIASES + list(UNSUPPORTED_COMPETITIONS) + list(team_words)
    )
    for phrase in sorted(removable, key=len, reverse=True):
        if phrase:
            text = re.sub(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", " ", text)
    words = [w for w in text.split() if w not in STOPWORDS and not w.isdigit() and len(w) > 1]
    return " ".join(words[:4]) or None


# ------------------------------------------------------------ IA gratuite (Groq)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
AI_QUOTA = src.Quota(
    per_minute=int(os.environ.get("FREE_AI_PER_MINUTE", "20") or 20),
    per_day=int(os.environ.get("FREE_AI_PER_DAY", "500") or 500),
)
INTENTS = ["standings", "top_scorers", "goals", "next_match", "last_match", "prediction"]


def ai_available():
    return bool(os.environ.get("GROQ_API_KEY", "").strip())


def _groq(messages, json_mode=False, max_tokens=200):
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    AI_QUOTA.acquire("IA gratuite (Groq)")
    body = {
        "model": os.environ.get("FREE_AI_MODEL", "llama-3.1-8b-instant"),
        "messages": messages,
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    request = urllib.request.Request(
        GROQ_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": src.USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read(200_000))
    except urllib.error.HTTPError as error:
        if error.code == 429:
            AI_QUOTA.block(60)
            raise QuotaExceeded("IA gratuite (Groq)", 60)
        return None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None
    try:
        return str(data["choices"][0]["message"]["content"] or "")[:2000]
    except (KeyError, IndexError, TypeError):
        return None


def ai_understand(question):
    """Secours quand les règles ne comprennent pas : l'IA ne fait que classer."""
    if not ai_available():
        return None
    system = (
        "Tu classes des questions de football. Réponds uniquement en JSON avec les clés "
        '"intent" (une de: standings, top_scorers, goals, next_match, last_match, prediction, null), '
        '"league" (FL1, PL, PD, SA, BL1 ou null), "team" (texte ou null), "player" (texte ou null). '
        "N'invente rien, ne réponds pas à la question."
    )
    try:
        raw = _groq([{"role": "system", "content": system}, {"role": "user", "content": question[:500]}],
                    json_mode=True, max_tokens=120)
    except QuotaExceeded:
        return None
    try:
        data = json.loads(raw or "")
    except ValueError:
        return None
    if not isinstance(data, dict) or data.get("intent") not in INTENTS:
        return None
    league = data.get("league") if data.get("league") in LEAGUES else None
    team = data.get("team") if isinstance(data.get("team"), str) else None
    player = data.get("player") if isinstance(data.get("player"), str) else None
    return {"intent": data["intent"], "league": league,
            "team": norm(team)[:60] if team else None, "player": norm(player)[:60] if player else None}


def _numbers(text):
    return set(re.findall(r"\d+", text))


def ai_phrase(facts_text, template):
    """Demande à l'IA une phrase simple ; rejetée au moindre chiffre inventé."""
    if not ai_available():
        return template, "modèle"
    system = (
        "Tu rédiges UNE phrase courte en français (moins de 35 mots) qui résume les faits fournis. "
        "Utilise uniquement les faits fournis, sans ajouter de chiffre, de nom, d'opinion ni de lien."
    )
    try:
        raw = _groq([{"role": "system", "content": system}, {"role": "user", "content": facts_text[:3000]}],
                    max_tokens=120)
    except QuotaExceeded:
        return template, "quota"
    sentence = re.sub(r"\s+", " ", raw or "").strip().strip('"')
    if (not sentence or len(sentence) > 300 or "http" in sentence or "[" in sentence
            or not _numbers(sentence) <= _numbers(facts_text)):
        return template, "modèle"
    return sentence, "ia"


# ---------------------------------------------------------- outils de réponse
def fmt_dt(iso):
    try:
        return datetime.fromisoformat(iso).astimezone(src.PARIS).strftime("%d/%m/%Y à %H:%M")
    except (TypeError, ValueError):
        return "date inconnue"


def team_label(team):
    return team.get("shortName") or team.get("name") or "?"


def distinctive(name):
    words = []
    for w in tokens(name):
        w = TEAM_SYNONYMS.get(w, w)
        if w not in GENERIC_TEAM_WORDS:
            words.append(w)
    return set(words)


def best_team_match(name, candidates, key):
    """Associe une équipe entre deux fournisseurs (noms écrits différemment)."""
    target = distinctive(name)
    scored = []
    for item in candidates:
        other = distinctive(key(item))
        if not target or not other:
            continue
        inter = len(target & other)
        if not inter:
            continue
        scored.append((inter / len(target | other), inter / min(len(target), len(other)), item))
    if not scored:
        return None
    scored.sort(key=lambda s: s[0], reverse=True)
    if scored[0][1] < 0.5 or (len(scored) > 1 and scored[0][0] == scored[1][0]):
        return None
    return scored[0][2]


class Answer:
    def __init__(self):
        self.sources = []
        self.fetched = []

    def cite(self, source):
        for i, existing in enumerate(self.sources):
            if existing["url"] == source["url"] and existing["title"] == source["title"]:
                return i + 1
        self.sources.append(source)
        if source.get("fetchedAt"):
            self.fetched.append(source["fetchedAt"])
        return len(self.sources)

    def result(self, short, facts, comparison=None, limits=None, analysis=None, conflict=False,
               facts_for_ai=None):
        sentence, mode = ai_phrase(facts_for_ai or "\n".join(facts), short)
        lines = [f"**Réponse courte :** {sentence}", "", "## Faits vérifiés", *[f"- {f}" for f in facts]]
        if analysis:
            lines += ["", "## Analyse (calcul à partir des faits)", *[f"- {a}" for a in analysis]]
        lines += ["", "## Comparaison des sources"]
        lines += [f"- {c}" for c in (comparison or ["Une seule source gratuite disponible pour cette donnée."])]
        all_limits = list(limits or [])
        if mode == "quota":
            all_limits.append("Quota gratuit de l'IA atteint : réponse rédigée automatiquement à partir des données.")
        lines += ["", "## Limites", *[f"- {item}" for item in (all_limits or ["Aucune limite particulière."])]]
        providers = {s["provider"] for s in self.sources}
        verified_at = min(self.fetched) if self.fetched else src.now_paris().isoformat()
        return {
            "reply": redact("\n".join(lines)),
            "sources": [
                {"title": s["title"], "url": s["url"], "domain": s["url"].split("/")[2],
                 "pageAge": f"données du {fmt_dt(s['fetchedAt'])}" if s.get("fetchedAt") else ""}
                for s in self.sources
            ],
            "research": {
                "status": "verified",
                "engine": "free",
                "searchedWeb": True,
                "sourceCount": len(self.sources),
                "independentDomains": len(providers),
                "singleSource": len(providers) < 2,
                "conflict": conflict,
                "verifiedAt": verified_at,
                "phrasing": mode,
            },
        }


def simple(status, reply, **extra):
    research = {"status": status, "engine": "free", "searchedWeb": False, "sourceCount": 0, **extra}
    return {"reply": redact(reply), "sources": [], "research": research}


def clarification(questions, reason):
    body = "\n".join(f"- {q}" for q in questions)
    return simple("clarification", f"{CLARIFY_PREFIX} : {reason}\n\n{body}")


def help_message():
    return simple(
        "clarification",
        f"{HELP_PREFIX}, pour la saison en cours ({src.season_label()}) et les 5 grands championnats "
        "(+ Ligue des champions pour les buts) :\n"
        "- « Classement de la Ligue 1 » ou « Quelle place pour l'OM ? »\n"
        "- « Meilleurs buteurs de Premier League »\n"
        "- « Combien de buts a marqué [joueur] de [club] cette saison en Liga ? »\n"
        "- « Prochain match du PSG » ou « Dernier résultat du Bayern »\n"
        "Reformule ta question avec l'un de ces modèles.",
    )


# ------------------------------------------------------------ accès aux données
def standings_table(code):
    entry = src.fd_standings(code)
    data = entry["data"]
    table = next((s["table"] for s in data.get("standings", []) if s.get("type") == "TOTAL"), None)
    if not table:
        raise SourceUnavailable("football-data.org", "classement absent de la réponse")
    return entry, table, data.get("season") or {}


def find_teams(q, require=True):
    """Équipes citées dans la question → [(code, ligne du classement, entrée)]."""
    t = q.text
    hint_league, search = None, None
    for nick in sorted(TEAM_NICKNAMES, key=len, reverse=True):
        if has_phrase(t, nick):
            hint_league, search = TEAM_NICKNAMES[nick]
            break
    if q.league:
        hint_league = q.league
    found = []
    leagues_to_scan = [hint_league] if hint_league else list(LEAGUES)
    for code in leagues_to_scan:
        entry, table, _ = standings_table(code)
        for row in table:
            team = row["team"]
            names = {norm(team.get("name")), norm(team.get("shortName"))}
            words = set().union(*(distinctive(n) for n in names if n))
            if search:
                if any(has_phrase(n, search) for n in names if n):
                    found.append((code, row, entry))
                continue
            if any(n and has_phrase(t, n) for n in names) or any(
                    len(w) >= 4 and has_phrase(t, w) for w in words):
                found.append((code, row, entry))
        if found and not hint_league:
            break
    return found


def team_words_in(q, teams):
    words = set()
    for nick in TEAM_NICKNAMES:
        if has_phrase(q.text, nick):
            words.add(nick)
    for _, row, _ in teams:
        for n in (row["team"].get("name"), row["team"].get("shortName")):
            if n:
                words.add(norm(n))
                words |= distinctive(n)
    return words


# --------------------------------------------------------------------- réponses
def answer_standings(q):
    teams = find_teams(q) if not q.league or detect_team_hint(q) else []
    if not q.league and not teams:
        return clarification(["De quel championnat parles-tu (Ligue 1, Premier League, Liga, Serie A, Bundesliga) ?"],
                             "le championnat n'est pas précisé.")
    if len({row["team"]["id"] for _, row, _ in teams}) > 1:
        names = ", ".join(sorted({team_label(row["team"]) for _, row, _ in teams}))
        return clarification([f"De quelle équipe parles-tu : {names} ?"], "plusieurs équipes correspondent.")
    code = teams[0][0] if teams else q.league
    entry, table, season = standings_table(code)
    ans = Answer()
    n_fd = ans.cite(src.fd_source(entry, f"classement {LEAGUES[code]['name']}"))
    league = LEAGUES[code]["name"]
    comparison, conflict = [], False
    rows = table[:5]
    facts = [f"{r['position']}. {team_label(r['team'])} — {r['points']} pts, {r['playedGames']} matchs [{n_fd}]"
             for r in rows]
    if teams:
        row = teams[0][1]
        short = (f"{team_label(row['team'])} est {ordinal(row['position'])} de {league} avec {row['points']} points "
                 f"après {row['playedGames']} matchs.")
        facts = [f"{team_label(row['team'])} : {ordinal(row['position'])}, {row['points']} pts, {row['playedGames']} matchs, "
                 f"{row['goalsFor']} buts marqués, {row['goalsAgainst']} encaissés [{n_fd}]"]
        rows = [row]
    else:
        leader = table[0]
        short = (f"{team_label(leader['team'])} est en tête de {league} avec {leader['points']} points "
                 f"après {leader['playedGames']} matchs.")
    comparison, conflict = compare_standings(code, rows, ans)
    limits = [f"Saison {src.season_label()} uniquement."]
    if season.get("currentMatchday"):
        limits.append(f"Journée en cours selon football-data.org : {season['currentMatchday']}.")
    return ans.result(short, facts, comparison, limits, conflict=conflict)


def detect_team_hint(q):
    return any(has_phrase(q.text, n) for n in TEAM_NICKNAMES) or any(
        has_phrase(q.text, w) for w in ("place", "position", "classe", "rang"))


def ordinal(n):
    return "1er" if n == 1 else f"{n}e"


def compare_standings(code, rows, ans):
    comparison, conflict = [], False
    try:
        tsdb_entry, tsdb_src = src.tsdb_table(code)
        tsdb_rows = (tsdb_entry["data"] or {}).get("table") or []
    except QuotaExceeded:
        return ["Seconde source non consultée : quota gratuit de TheSportsDB atteint."], False
    except SourceUnavailable as e:
        return [f"Seconde source indisponible ({e.reason})."], False
    n = ans.cite(tsdb_src)
    updated = tsdb_rows[0].get("dateUpdated") if tsdb_rows else None
    for row in rows:
        other = best_team_match(row["team"].get("name") or "", tsdb_rows, lambda r: r.get("strTeam", ""))
        label = team_label(row["team"])
        if not other:
            comparison.append(f"{label} : absent des 5 premières places fournies gratuitement par TheSportsDB [{n}].")
            continue
        pts, played = int(other.get("intPoints") or -1), int(other.get("intPlayed") or -1)
        if pts == row["points"] and played == row["playedGames"]:
            comparison.append(f"{label} : TheSportsDB indique aussi {pts} pts en {played} matchs → concordant [{n}].")
        else:
            conflict = True
            comparison.append(
                f"⚠ {label} : TheSportsDB indique {pts} pts en {played} matchs (mise à jour du "
                f"{updated or 'date inconnue'}) contre {row['points']} pts en {row['playedGames']} matchs → "
                f"les sources ne concordent pas, probablement un décalage de mise à jour [{n}].")
    if code == "BL1":
        more, extra_conflict = compare_openliga_table(rows, ans)
        comparison += more
        conflict = conflict or extra_conflict
    return comparison, conflict


def compare_openliga_table(rows, ans):
    try:
        entry, source = src.openliga("getbltable")
    except (QuotaExceeded, SourceUnavailable):
        return ["OpenLigaDB indisponible pour le moment."], False
    n = ans.cite(source)
    out, conflict = [], False
    for row in rows:
        other = best_team_match(row["team"].get("name") or "", entry["data"] or [], lambda r: r.get("teamName", ""))
        if not other:
            continue
        if other.get("points") == row["points"] and other.get("matches") == row["playedGames"]:
            out.append(f"{team_label(row['team'])} : OpenLigaDB indique aussi {other['points']} pts → concordant [{n}].")
        else:
            conflict = True
            out.append(f"⚠ {team_label(row['team'])} : OpenLigaDB indique {other.get('points')} pts en "
                       f"{other.get('matches')} matchs → les sources ne concordent pas [{n}].")
    return out, conflict


def answer_top_scorers(q):
    if not q.league:
        return clarification(["Pour quel championnat (Ligue 1, Premier League, Liga, Serie A, Bundesliga) ?"],
                             "le championnat n'est pas précisé.")
    try:
        entry = src.fd_scorers(q.league)
    except SourceUnavailable as error:
        if q.league == "BL1":
            return bundesliga_scorers_from_openliga()
        return scorers_not_available(error)
    scorers = (entry["data"] or {}).get("scorers") or []
    if not scorers:
        return simple("unavailable", "football-data.org ne fournit pas encore de buteurs pour ce championnat. "
                                     "Je préfère ne pas répondre plutôt que d'inventer.")
    ans = Answer()
    n = ans.cite(src.fd_source(entry, f"buteurs {LEAGUES[q.league]['name']}"))
    top = scorers[:5]
    facts = [f"{p['player']['name']} ({team_label(p['team'])}) — {p['goals']} buts en {p.get('playedMatches', '?')} matchs [{n}]"
             for p in top]
    short = (f"{top[0]['player']['name']} ({team_label(top[0]['team'])}) est le meilleur buteur de "
             f"{LEAGUES[q.league]['name']} avec {top[0]['goals']} buts.")
    comparison, conflict = None, False
    if q.league == "BL1":
        comparison, conflict = compare_openliga_scorers(top, ans)
    return ans.result(short, facts, comparison, [f"Saison {src.season_label()}, championnat uniquement."],
                      conflict=conflict)


def scorers_not_available(error):
    return simple("unavailable",
                  f"Les statistiques de buteurs ne sont pas accessibles avec la clé gratuite actuelle "
                  f"({error.provider} : {error.reason}). Je ne peux donc pas vérifier ce chiffre et je "
                  "n'en donne pas. Classements et matchs restent disponibles.")


def bundesliga_scorers_from_openliga():
    """Repli Bundesliga : OpenLigaDB (gratuit, sans clé) comme source unique."""
    entry, source = src.openliga("getgoalgetters")
    goals = [g for g in entry["data"] or [] if isinstance(g.get("goalCount"), int)][:5]
    if not goals:
        return simple("unavailable", "OpenLigaDB ne fournit pas encore de buteurs pour la Bundesliga.")
    ans = Answer()
    n = ans.cite(source)
    facts = [f"{g['goalGetterName']} — {g['goalCount']} buts [{n}]" for g in goals]
    short = f"{goals[0]['goalGetterName']} est le meilleur buteur de Bundesliga avec {goals[0]['goalCount']} buts."
    return ans.result(short, facts, ["Une seule source gratuite disponible pour les buteurs (OpenLigaDB)."],
                      [f"Saison {src.season_label()}, championnat uniquement.",
                       "OpenLigaDB ne précise pas le club des buteurs."])


def compare_openliga_scorers(players, ans):
    try:
        entry, source = src.openliga("getgoalgetters")
    except (QuotaExceeded, SourceUnavailable):
        return ["OpenLigaDB indisponible pour le moment."], False
    n = ans.cite(source)
    out, conflict = [], False
    for p in players:
        last = norm(p["player"].get("lastName") or p["player"]["name"].split()[-1])
        match = [g for g in entry["data"] or [] if norm(g.get("goalGetterName", "")).split()[-1:] == [last.split()[-1]]]
        if len(match) != 1:
            out.append(f"{p['player']['name']} : non identifié avec certitude dans OpenLigaDB [{n}].")
            continue
        goals = match[0].get("goalCount")
        if goals == p["goals"]:
            out.append(f"{p['player']['name']} : OpenLigaDB indique aussi {goals} buts → concordant [{n}].")
        else:
            conflict = True
            out.append(f"⚠ {p['player']['name']} : OpenLigaDB indique {goals} buts contre {p['goals']} → "
                       f"les sources ne concordent pas [{n}].")
    return out, conflict


def answer_goals(q):
    teams = find_teams(q)
    team_words = team_words_in(q, teams)
    player = q.player or residual_name(q.text, team_words)
    if not player:
        # « Combien de buts a marqué le PSG ? » → buts de l'équipe (classement)
        if teams:
            return answer_standings(q)
        return clarification(["De quel joueur ou de quelle équipe parles-tu ?"], "la question ne cite personne.")
    missing = []
    if not teams:
        missing.append(f"De quel « {display_name(q.raw, player)} » parles-tu (nom complet, nationalité ou poste) ?")
        missing.append("Dans quel club joue-t-il ?")
    elif len({row["team"]["id"] for _, row, _ in teams}) > 1:
        names = ", ".join(sorted({team_label(row["team"]) for _, row, _ in teams}))
        missing.append(f"Dans quel club joue-t-il : {names} ?")
    if q.season is None:
        missing.append(f"Pour quelle saison ? (seule la saison en cours, {src.season_label()}, est disponible)")
    if q.competition is None and not q.unsupported:
        missing.append("En championnat seulement, en Ligue des champions, ou toutes compétitions confondues ?")
    if missing:
        return clarification(missing, "plusieurs joueurs peuvent porter ce nom et le total dépend du club, "
                                      "de la saison et des compétitions.")
    if q.season == "other":
        return simple("unavailable", f"Les sources gratuites configurées ne couvrent que la saison en cours "
                                     f"({src.season_label()}). Je ne peux pas vérifier la saison {q.season_label}, "
                                     "donc je ne donne pas de chiffre.")
    if q.unsupported and q.competition != "ALL":
        return unsupported_competition(q.unsupported)
    code, row, _ = teams[0]
    club = team_label(row["team"])
    competitions = {"LEAGUE": [code], "CL": ["CL"], "ALL": [code, "CL"]}[q.competition or "LEAGUE"]
    if q.competition == "LEAGUE" and q.league and q.league != code:
        competitions = [q.league]
    ans, facts, found, total = Answer(), [], [], 0
    not_found = []
    for comp in competitions:
        comp_name = LEAGUES.get(comp, {}).get("name") or "Ligue des champions"
        try:
            entry = src.fd_scorers(comp)
        except SourceUnavailable as error:
            return scorers_not_available(error)
        n = ans.cite(src.fd_source(entry, f"buteurs {comp_name}"))
        matches = [p for p in (entry["data"] or {}).get("scorers") or []
                   if name_matches(player, p["player"]) and same_team(p["team"], row["team"])]
        if len(matches) > 1:
            return clarification([f"Lequel : {', '.join(p['player']['name'] for p in matches)} ?"],
                                 "plusieurs joueurs de ce club correspondent.")
        if not matches:
            not_found.append(comp_name)
            facts.append(f"{comp_name} : joueur absent de la liste des 100 meilleurs buteurs fournie par "
                         f"football-data.org → total non vérifiable [{n}]")
            continue
        p = matches[0]
        found.append((comp_name, p, n))
        total += int(p["goals"] or 0)
        facts.append(f"{comp_name} : {p['goals']} buts en {p.get('playedMatches', '?')} matchs "
                     f"({p['player']['name']}, {club}) [{n}]")
    if not found:
        return simple("unavailable",
                      f"Je n'ai trouvé « {display_name(q.raw, player)} » ({club}) dans aucune liste de buteurs vérifiable "
                      f"pour {', '.join(not_found)}. Sans source, je ne donne pas de chiffre.",
                      sourceCount=len(ans.sources))
    full_name = found[0][1]["player"]["name"]
    limits = [f"Saison {src.season_label()}."]
    if q.competition == "ALL":
        limits.append("Coupes nationales, Ligue Europa et autres compétitions non couvertes par les sources "
                      "gratuites : le vrai total toutes compétitions peut être plus élevé.")
        short = (f"{full_name} ({club}) a marqué au moins {total} buts vérifiables cette saison "
                 f"(championnat et Ligue des champions seulement).")
    else:
        short = f"{full_name} ({club}) a marqué {total} buts en {found[0][0]} cette saison."
    if not_found:
        limits.append(f"Non vérifiable pour : {', '.join(not_found)}.")
    analysis = []
    p0 = found[0][1]
    if p0.get("playedMatches"):
        ratio = f"{p0['goals'] / p0['playedMatches']:.2f}".replace(".", ",")
        analysis.append(f"{found[0][0]} : {ratio} but par match en moyenne.")
    comparison, conflict = None, False
    if code == "BL1" and any(c == "Bundesliga" for c, _, _ in found):
        comparison, conflict = compare_openliga_scorers([p for c, p, _ in found if c == "Bundesliga"], ans)
    return ans.result(short, facts, comparison, limits, analysis=analysis, conflict=conflict)


def name_matches(query, player):
    q = [w for w in norm(query).split() if len(w) > 1]
    full = set(norm(" ".join(filter(None, [player.get("name"), player.get("firstName"), player.get("lastName")]))).split())
    return bool(q) and all(w in full for w in q)


def same_team(a, b):
    return a.get("id") == b.get("id") or norm(a.get("name")) == norm(b.get("name"))


def unsupported_competition(label):
    return simple("unavailable", f"Les sources gratuites configurées ne couvrent pas {label}. "
                                 "Je ne peux donc pas vérifier cette information et je ne donne pas de chiffre.")


def answer_match(q, upcoming):
    teams = find_teams(q)
    if not teams:
        return clarification(["De quelle équipe parles-tu ?"], "l'équipe n'est pas précisée.")
    if len({row["team"]["id"] for _, row, _ in teams}) > 1:
        names = ", ".join(sorted({team_label(row["team"]) for _, row, _ in teams}))
        return clarification([f"De quelle équipe parles-tu : {names} ?"], "plusieurs équipes correspondent.")
    code, row, _ = teams[0]
    today = src.now_paris().date()
    entry = src.fd_matches(code, (today - timedelta(days=21)).isoformat(), (today + timedelta(days=28)).isoformat())
    ans = Answer()
    n = ans.cite(src.fd_source(entry, f"matchs {LEAGUES[code]['name']}"))
    team_id = row["team"]["id"]
    games = [m for m in (entry["data"] or {}).get("matches") or []
             if team_id in ((m.get("homeTeam") or {}).get("id"), (m.get("awayTeam") or {}).get("id"))]
    club = team_label(row["team"])
    if upcoming:
        games = sorted((m for m in games if m.get("status") in ("SCHEDULED", "TIMED")), key=lambda m: m["utcDate"])
        if not games:
            return simple("unavailable", f"Aucun match de {club} en {LEAGUES[code]['name']} trouvé dans les 4 "
                                         "prochaines semaines chez football-data.org.")
        m = games[0]
        when = datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00")).astimezone(src.PARIS)
        hour = when.strftime("%H:%M") if m.get("status") == "TIMED" else "horaire à confirmer"
        fact = (f"Journée {m.get('matchday')} : {team_label(m['homeTeam'])} – {team_label(m['awayTeam'])}, "
                f"le {when.strftime('%d/%m/%Y')} ({hour}, heure de Paris) [{n}]")
        short = f"Prochain match de {club} : {team_label(m['homeTeam'])} – {team_label(m['awayTeam'])} le {when.strftime('%d/%m/%Y')}."
        limits = ["Championnat uniquement (coupes non couvertes).", "Horaires susceptibles d'évoluer."]
    else:
        games = sorted((m for m in games if m.get("status") == "FINISHED"), key=lambda m: m["utcDate"])
        if not games:
            return simple("unavailable", f"Aucun match terminé de {club} en {LEAGUES[code]['name']} trouvé sur les "
                                         "3 dernières semaines chez football-data.org.")
        m = games[-1]
        ft = (m.get("score") or {}).get("fullTime") or {}
        when = datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00")).astimezone(src.PARIS)
        fact = (f"Journée {m.get('matchday')}, le {when.strftime('%d/%m/%Y')} : {team_label(m['homeTeam'])} "
                f"{ft.get('home')} – {ft.get('away')} {team_label(m['awayTeam'])} [{n}]")
        short = (f"Dernier match de {club} : {team_label(m['homeTeam'])} {ft.get('home')} – {ft.get('away')} "
                 f"{team_label(m['awayTeam'])} le {when.strftime('%d/%m/%Y')}.")
        limits = ["Championnat uniquement (coupes non couvertes).",
                  "Offre gratuite : les scores sont transmis avec un léger différé."]
    return ans.result(short, [fact], None, limits)


# ------------------------------------------------------------------ point d'entrée
def _clean(messages):
    if not isinstance(messages, list) or not messages or len(messages) > MAX_MESSAGES:
        raise ValueError("Conversation invalide ou trop longue.")
    clean = []
    for m in messages[-12:]:
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
            text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", m["content"]).strip()
            if text:
                clean.append({"role": m["role"], "content": text[:4000]})
    if not clean or clean[-1]["role"] != "user":
        raise ValueError("Le dernier message doit venir de l'utilisateur.")
    if len(clean[-1]["content"]) > MAX_USER_CHARS:
        raise ValueError(f"Question trop longue ({MAX_USER_CHARS} caractères maximum).")
    return clean


def question_with_context(clean):
    """Assemble la question et les réponses aux demandes de précisions."""
    parts = [clean[-1]["content"]]
    i = len(clean) - 2
    while i >= 1 and clean[i]["role"] == "assistant" and clean[i]["content"].startswith(CLARIFY_PREFIX) \
            and clean[i - 1]["role"] == "user" and len(parts) < 4:
        parts.insert(0, clean[i - 1]["content"])
        i -= 2
    return " ; ".join(parts)


def answer(messages):
    clean = _clean(messages)
    latest = norm(clean[-1]["content"])
    if detect_intent(latest) == "secret":
        return simple("refused", "Je ne communique aucune clé, aucun mot de passe ni aucune information interne "
                                 "du serveur. Pose-moi une question sur le football.")
    q = parse_question(question_with_context(clean))
    if q.intent is None:
        understood = ai_understand(clean[-1]["content"])
        if understood:
            q.intent = understood["intent"]
            q.league = q.league or understood["league"]
            if understood["team"]:
                q.text += f" {understood['team']}"
            if understood["player"]:
                q.player = understood["player"]
    try:
        if q.intent == "secret":
            return simple("refused", "Je ne communique aucune clé, aucun mot de passe ni aucune information "
                                     "interne du serveur. Pose-moi une question sur le football.")
        if q.intent == "prediction":
            return simple("no_research", "Je ne fais pas de prédiction : elle ne serait pas vérifiable. "
                                         "L'onglet « Pronostics » du site donne une estimation statistique "
                                         "(modèle de Poisson), présentée comme une simple probabilité.")
        if q.intent == "standings":
            return answer_standings(q)
        if q.intent == "top_scorers":
            return answer_top_scorers(q)
        if q.intent == "goals":
            return answer_goals(q)
        if q.intent in ("next_match", "last_match"):
            return answer_match(q, upcoming=q.intent == "next_match")
        return help_message()
    except QuotaExceeded as quota:
        wait = f"Réessaie dans environ {quota.retry_after} secondes." if quota.retry_after else "Réessaie demain."
        return simple("unavailable", f"Le quota gratuit de {quota.provider} est atteint pour le moment. {wait} "
                                     "Je n'affiche aucune donnée non vérifiée et rien n'est facturé.",
                      quota=quota.provider)
    except SourceUnavailable as error:
        return simple("unavailable", f"La source {error.provider} est indisponible ({error.reason}). "
                                     "Je préfère ne pas répondre plutôt que d'inventer.")


def status():
    return {
        "engine": "free",
        "footballData": bool(src.football_data_key()),
        "ai": ai_available(),
        "quotas": {**src.quota_status(), "IA gratuite (Groq)": AI_QUOTA.status()},
    }
