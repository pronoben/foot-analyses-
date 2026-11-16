"""
Chatbot FootAnalyse – cerveau du chatbot
----------------------------------------
Utilise Claude (API Anthropic) pour répondre aux questions sur le football.
- Recherche web obligatoire pour toute information susceptible de changer
  (statistiques, scores, classements, actualités, compositions, transferts).
- Chaque réponse factuelle renvoie la date de vérification et les sources
  réellement consultées (liens HTTPS cliquables côté site).
- Une question ambiguë (« combien de buts a João Pedro ? ») déclenche d'abord
  une demande de précisions, sans recherche ni affirmation.
- Échec fermé : sans recherche réelle et sans source exploitable, aucune
  affirmation factuelle n'est envoyée au navigateur.

Clé nécessaire dans l'environnement du serveur :  ANTHROPIC_API_KEY=...
"""

import hashlib
import json
import os
import re
import threading
import time
from datetime import datetime
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import anthropic

MODEL = os.environ.get("CHAT_MODEL", "claude-opus-5-5")
MAX_HISTORY = 12             # nombre de messages gardés dans la conversation
MAX_USER_CHARS = 1000        # longueur max de la question posée
MAX_MESSAGE_CHARS = 4000     # longueur max d'un ancien message de l'historique
MAX_HISTORY_CHARS = 16000    # longueur totale max de la conversation envoyée
MAX_CONTEXT_CHARS = 40000    # longueur max des données du site
MAX_SOURCES = 8
MAX_API_ROUNDS = 4           # relances après une pause de la recherche web
CACHE_SECONDS = 600          # réponse identique réutilisée pendant 10 minutes
CACHE_MAX_ENTRIES = 200
PARIS = ZoneInfo("Europe/Paris")

CLARIFY_TOOL = "demander_precisions"
NO_SEARCH_TOOL = "repondre_sans_recherche"

SYSTEM_PROMPT = """Tu es l'assistant de recherche football du site FootAnalyse.

Ton rôle : répondre aux questions sur le football, quel que soit le championnat ou l'époque — résultats, classements, joueurs, transferts, tactique, règles, histoire, statistiques, pronostics, compétitions internationales, football féminin.

Étape 1 — Question ambiguë : précisions AVANT toute recherche
- Pour une statistique, un score, un classement, une composition, un transfert ou une actualité, vérifie que la question précise : l'identité exacte du joueur ou de l'équipe, son club, la saison, la compétition (ou « toutes compétitions »).
- Si l'un de ces éléments manque ou si le nom désigne plusieurs personnes ou équipes (homonymes fréquents : João Pedro, Rodri, Danilo, Paulinho, Raphinha, Ronaldo…), n'effectue aucune recherche et appelle l'outil demander_precisions.
- Pose uniquement les questions utiles (1 à 4), courtes, sans citer de chiffre ni de fait.
- Exemple : « Combien de buts a João Pedro ? » → demander_precisions avec : « De quel João Pedro parles-tu (nom complet, nationalité ou poste) ? », « Dans quel club ? », « Pour quelle saison ? », « En championnat seulement ou toutes compétitions confondues ? ».
- Si l'utilisateur répond « saison en cours », utilise la saison en cours à la date du jour.

Étape 2 — Recherche obligatoire
- Toute information qui peut changer (statistiques, scores, classements, actualités, blessures, compositions, transferts, calendrier, effectifs) exige une recherche web récente. Ne réponds jamais de mémoire sur ces sujets.
- Recoupe au moins deux sources indépendantes et récentes. Privilégie dans cet ordre : organisme officiel de la compétition, club ou fédération ; fournisseur de statistiques reconnu ; média sportif établi. Un réseau social, un forum, un agrégateur ou un extrait de moteur de recherche ne suffit pas seul.
- Ouvre les pages importantes avec web_fetch quand le résultat de recherche ne permet pas de lire le chiffre exact.
- Pour un total de buts « toutes compétitions », vérifie la date de mise à jour de chaque source et le dernier match pris en compte.
- Si les sources se contredisent, donne chaque valeur avec sa source et explique la différence probable (date de mise à jour, compétitions incluses, matchs amicaux…). Ne choisis pas une valeur au hasard.
- Si tu ne trouves pas de source fiable, dis clairement « Je n'ai pas pu vérifier cette information » et n'avance aucun chiffre.
- N'invente jamais une source, une statistique, une blessure, une composition ou une déclaration.

Étape 3 — Format obligatoire d'une réponse factuelle (en français, sans remplissage)
**Réponse courte :** une ou deux phrases avec la conclusion vérifiée.

## Faits vérifiés
- Chaque fait avec sa valeur et la date à laquelle la source le donne. Uniquement ce que disent les sources.

## Analyse
- Ton interprétation, présentée comme telle (facultatif).

## Prédiction
- Uniquement si un pronostic est demandé : tendance ou probabilité, jamais une certitude. N'encourage pas les paris d'argent.

## Limites
- Désaccords entre sources, informations non confirmées, ancienneté des données. Écris « Aucune limite particulière » si tout concorde.

N'écris pas toi-même de liste de sources ni d'URL : le site affiche automatiquement la date de vérification et les sources consultées à partir de tes citations.

Données du site
- Le site couvre 5 championnats : Ligue 1, Premier League, Liga, Serie A et Bundesliga. Des données du site peuvent t'être fournies avec la question (classement, prochains matchs, buteurs). Ce sont des points de comparaison, jamais une preuve d'actualité : vérifie-les sur le web avant de les reprendre.
- Le modèle de pronostic du site est une loi de Poisson : force offensive et défensive de chaque équipe par rapport à la moyenne de la ligue (lissée vers la moyenne car peu de matchs joués), avantage du terrain de 12 %. Il ne tient pas compte des absences, de la forme récente ni du calendrier.

Réponses sans recherche (outil repondre_sans_recherche, jamais pour un fait qui peut changer)
- motif « fonctionnement_du_site » : expliquer le modèle de pronostic du site ou le fonctionnement de l'assistant.
- motif « hors_sujet » : la question n'a aucun rapport avec le football → réponds en une phrase que tu es spécialisé dans le football et propose une question football.
- motif « salutation » : simple bonjour ou remerciement."""

TOOLS_CLIENT = [
    {
        "name": CLARIFY_TOOL,
        "description": (
            "Demande des précisions à l'utilisateur AVANT toute recherche quand la question "
            "est ambiguë (homonymes, club, saison ou compétition manquants). N'affirme aucun fait."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "raison": {
                    "type": "string",
                    "description": "Pourquoi la question est ambiguë, en une phrase courte.",
                },
                "questions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "1 à 4 questions courtes à poser à l'utilisateur.",
                },
            },
            "required": ["raison", "questions"],
            "additionalProperties": False,
        },
    },
    {
        "name": NO_SEARCH_TOOL,
        "description": (
            "Répond sans recherche web, uniquement pour une salutation, une question hors football "
            "ou une explication du fonctionnement du site. Interdit pour tout fait qui peut changer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "motif": {
                    "type": "string",
                    "enum": ["hors_sujet", "fonctionnement_du_site", "salutation"],
                },
                "message": {"type": "string", "description": "La réponse affichée à l'utilisateur."},
            },
            "required": ["motif", "message"],
            "additionalProperties": False,
        },
    },
]

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_cache = {}
_cache_lock = threading.Lock()


def _contains_web_research(content):
    """Détecte un véritable appel de recherche, y compris dans un bloc imbriqué."""
    for block in content or []:
        block_type = getattr(block, "type", "")
        if block_type in ("web_search_tool_result", "web_fetch_tool_result"):
            return True
        if block_type == "server_tool_use" and getattr(block, "name", "") in ("web_search", "web_fetch"):
            return True
        nested = getattr(block, "content", None)
        if isinstance(nested, list) and _contains_web_research(nested):
            return True
    return False


def _safe_https(url):
    url = str(url or "")[:500]
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    return url, parsed.netloc.lower()


def _consulted_pages(content):
    """Pages renvoyées par la recherche (date de publication) et pages ouvertes."""
    page_age, fetched = {}, []
    for block in content or []:
        block_type = getattr(block, "type", "")
        inner = getattr(block, "content", None)
        if block_type == "web_search_tool_result" and isinstance(inner, list):
            for result in inner:
                url = getattr(result, "url", None)
                if url and getattr(result, "page_age", None):
                    page_age[str(url)] = str(result.page_age)[:60]
        elif block_type == "web_fetch_tool_result" and inner is not None:
            url = getattr(inner, "url", None)
            document = getattr(inner, "content", None)
            title = getattr(document, "title", None) if document is not None else None
            if url:
                fetched.append({"url": str(url), "title": str(title or "")})
        if isinstance(inner, list) and block_type not in ("web_search_tool_result",):
            nested_age, nested_fetched = _consulted_pages(inner)
            page_age.update(nested_age)
            fetched.extend(nested_fetched)
    return page_age, fetched


def _extract_sources(content, page_age=None, fetched=None):
    """Conserve uniquement les pages HTTPS réellement citées ou ouvertes."""
    page_age = page_age or {}
    fetched_by_title = {f["title"]: f["url"] for f in (fetched or []) if f.get("title")}
    sources, seen = [], set()

    def add(url, title):
        safe = _safe_https(url)
        if not safe or safe[0] in seen or len(sources) >= MAX_SOURCES:
            return
        url, domain = safe
        seen.add(url)
        source = {"title": str(title or domain)[:200], "url": url, "domain": domain}
        if url in page_age:
            source["pageAge"] = page_age[url]
        sources.append(source)

    for block in content or []:
        if getattr(block, "type", "") != "text":
            continue
        for citation in getattr(block, "citations", None) or []:
            url = getattr(citation, "url", None)
            title = getattr(citation, "title", None) or getattr(citation, "document_title", None)
            if not url and title in fetched_by_title:
                url = fetched_by_title[title]
            add(url, title)
    for page in fetched or []:
        add(page["url"], page.get("title"))
    return sources


def _reply_with_markers(content, sources):
    """Assemble le texte et ajoute [n] après chaque passage cité (n = n° de source)."""
    index = {s["url"]: i + 1 for i, s in enumerate(sources)}
    title_index = {s["title"]: i + 1 for i, s in enumerate(sources)}
    parts = []
    for block in content or []:
        if getattr(block, "type", "") != "text":
            continue
        text = getattr(block, "text", "") or ""
        markers = []
        for citation in getattr(block, "citations", None) or []:
            n = index.get(str(getattr(citation, "url", "") or "")) or title_index.get(
                str(getattr(citation, "document_title", "") or "")
            )
            if n and n not in markers:
                markers.append(n)
        if markers:
            stripped = text.rstrip()
            text = stripped + "".join(f" [{n}]" for n in markers) + text[len(stripped):]
        parts.append(text)
    return "".join(parts).strip()


def _clean_text(value, limit):
    text = _CONTROL_CHARS.sub("", value).strip()
    return text[:limit]


def _clean_history(messages):
    """Valide la conversation : rôles user/assistant, texte, longueurs bornées."""
    if not isinstance(messages, list) or not messages:
        raise ValueError("La conversation est vide.")
    if len(messages) > 40:
        raise ValueError("Conversation trop longue : recommence une nouvelle discussion.")
    clean = []
    for m in messages[-MAX_HISTORY:]:
        if not isinstance(m, dict):
            raise ValueError("Message invalide.")
        role, content = m.get("role"), m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            clean.append({"role": role, "content": _clean_text(content, MAX_MESSAGE_CHARS)})
    # La conversation doit commencer par un message de l'utilisateur
    while clean and clean[0]["role"] != "user":
        clean.pop(0)
    if not clean or clean[-1]["role"] != "user":
        raise ValueError("Le dernier message doit venir de l'utilisateur.")
    if len(clean[-1]["content"]) > MAX_USER_CHARS:
        raise ValueError(f"Question trop longue ({MAX_USER_CHARS} caractères maximum).")
    while sum(len(m["content"]) for m in clean) > MAX_HISTORY_CHARS and len(clean) > 1:
        clean.pop(0)
        while clean and clean[0]["role"] != "user":
            clean.pop(0)
    # Deux messages consécutifs du même rôle sont fusionnés (exigé par l'API).
    merged = []
    for m in clean:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] += "\n\n" + m["content"]
        else:
            merged.append(dict(m))
    return merged


def _cache_key(history, site_context):
    payload = json.dumps([history, site_context[:200]], ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_cached(messages, site_context=""):
    """Réponse récente pour exactement la même conversation (ne coûte rien)."""
    try:
        key = _cache_key(_clean_history(messages), site_context)
    except ValueError:
        return None
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() - entry["time"] < CACHE_SECONDS:
            return entry["data"]
    return None


def _store(history, site_context, data):
    with _cache_lock:
        if len(_cache) >= CACHE_MAX_ENTRIES:
            oldest = min(_cache, key=lambda k: _cache[k]["time"])
            _cache.pop(oldest, None)
        _cache[_cache_key(history, site_context)] = {"time": time.time(), "data": data}


def _unavailable(reason, research_used=False):
    return {
        "reply": reason,
        "sources": [],
        "research": {"status": "unavailable", "searchedWeb": research_used, "sourceCount": 0},
    }


def _client_tool_reply(call):
    data = call.input if isinstance(call.input, dict) else {}
    if call.name == CLARIFY_TOOL:
        questions = [
            _clean_text(str(q), 200) for q in (data.get("questions") or []) if str(q).strip()
        ][:4]
        if not questions:
            return None
        reason = _clean_text(str(data.get("raison") or "Ta question peut désigner plusieurs réponses."), 300)
        reply = (
            f"Avant de lancer la recherche, j'ai besoin de précisions : {reason}\n\n"
            + "\n".join(f"- {q}" for q in questions)
        )
        return {
            "reply": reply,
            "sources": [],
            "research": {"status": "clarification", "searchedWeb": False, "sourceCount": 0},
        }
    if call.name == NO_SEARCH_TOOL:
        message = _clean_text(str(data.get("message") or ""), 1500)
        if not message:
            return None
        return {
            "reply": message,
            "sources": [],
            "research": {
                "status": "no_research",
                "reason": str(data.get("motif") or "")[:40],
                "searchedWeb": False,
                "sourceCount": 0,
            },
        }
    return None


def answer(messages, site_context="", use_cache=True):
    """Renvoie {"reply": texte, "sources": [...], "research": {...}}."""
    history = _clean_history(messages)
    cache_history = [dict(m) for m in history]

    # On ajoute la date du jour et les données du site au dernier message
    # (et pas dans le prompt système, pour garder celui-ci stable et en cache).
    verified_at = datetime.now(PARIS)
    extra = (
        f"<date_du_jour>{verified_at.date().isoformat()} "
        f"({verified_at.strftime('%H:%M')}, heure de Paris)</date_du_jour>\n"
    )
    if site_context:
        extra += f"<donnees_du_site>\n{site_context[:MAX_CONTEXT_CHARS]}\n</donnees_du_site>\n"
    history[-1] = {"role": "user", "content": extra + "\n" + history[-1]["content"]}

    client = anthropic.Anthropic(timeout=120.0, max_retries=1)  # lit ANTHROPIC_API_KEY
    request = dict(
        model=MODEL,
        max_tokens=6000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[
            {
                "type": "web_search_20260318",
                "name": "web_search",
                "max_uses": 5,
                "user_location": {
                    "type": "approximate",
                    "country": "FR",
                    "timezone": "Europe/Paris",
                },
            },
            {
                "type": "web_fetch_20260318",
                "name": "web_fetch",
                "max_uses": 3,
                "max_content_tokens": 8000,
                "citations": {"enabled": True},
                "use_cache": False,
            },
            *TOOLS_CLIENT,
        ],
        tool_choice={"type": "auto"},
        output_config={"effort": "medium"},
        # Si Claude Opus 5.5 refuse par prudence, l'API réessaie automatiquement
        # avec un autre modèle adapté.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )

    # La recherche web peut mettre la réponse « en pause » (pause_turn) :
    # on relance alors la requête pour que Claude termine. Tout le contenu
    # produit (y compris avant la pause) est conservé.
    all_content = []
    research_used = False
    response = None
    for _ in range(MAX_API_ROUNDS):
        response = client.beta.messages.create(messages=history, **request)
        all_content.extend(response.content or [])
        research_used = research_used or _contains_web_research(response.content)
        if response.stop_reason != "pause_turn":
            break
        history.append({"role": "assistant", "content": response.content})

    if response is None or response.stop_reason == "refusal":
        return _unavailable("Je n'ai pas pu effectuer une recherche vérifiable pour cette question.", research_used)

    # Question ambiguë ou réponse sans recherche (outils côté site).
    for block in response.content or []:
        if getattr(block, "type", "") == "tool_use" and getattr(block, "name", "") in (CLARIFY_TOOL, NO_SEARCH_TOOL):
            # Un message « sans recherche » n'est accepté que si aucune recherche n'a eu lieu.
            if block.name == NO_SEARCH_TOOL and research_used:
                continue
            result = _client_tool_reply(block)
            if result:
                if use_cache:
                    _store(cache_history, site_context, result)
                return result

    page_age, fetched = _consulted_pages(all_content)
    sources = _extract_sources(all_content, page_age, fetched)
    reply = _reply_with_markers(all_content, sources)

    # Échec fermé : aucune affirmation factuelle n'est envoyée au navigateur sans
    # preuve qu'une recherche a eu lieu et sans au moins une source exploitable.
    if not research_used or not sources or not reply:
        return _unavailable(
            "Je n'ai pas trouvé de source suffisamment vérifiable pour répondre sans risque "
            "d'inventer. Reformule la question ou réessaie plus tard.",
            research_used,
        )

    if response.stop_reason == "max_tokens":
        reply += "\n\n_(Réponse interrompue : elle était trop longue. Pose une question plus précise.)_"

    domains = {s["domain"].removeprefix("www.") for s in sources}
    result = {
        "reply": reply,
        "sources": sources,
        "research": {
            "status": "verified",
            "searchedWeb": True,
            "sourceCount": len(sources),
            "independentDomains": len(domains),
            "singleSource": len(domains) < 2,
            "verifiedAt": verified_at.isoformat(),
        },
    }
    if use_cache:
        _store(cache_history, site_context, result)
    return result
