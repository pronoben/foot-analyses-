"""
Compositions probables
----------------------
Aucune API gratuite ne fournit les compositions *probables* (elles sont publiées
par la presse quelques jours avant le match). On demande donc à Claude de
chercher sur le web, puis de remplir un formulaire structuré (outil
« enregistrer_compositions ») que le site sait afficher sur un terrain.

Les résultats sont gardés en cache 6 heures par match pour limiter les coûts.
"""

import time
from datetime import date

import anthropic

from chatbot_ai import MODEL

CACHE_SECONDS = 6 * 3600
_cache = {}

PLAYER = {
    "type": "object",
    "properties": {
        "nom": {"type": "string"},
        "poste": {"type": "string", "description": "Abréviation : G, DD, DC, DG, MDC, MC, MOC, AD, AG, BU…"},
    },
    "required": ["nom", "poste"],
    "additionalProperties": False,
}

TEAM = {
    "type": "object",
    "properties": {
        "schema_tactique": {"type": "string", "description": "Ex : 4-3-3"},
        "lignes": {
            "type": "array",
            "description": "Les 11 titulaires, ligne par ligne, du gardien vers l'attaque. "
                           "Chaque ligne est listée de la gauche vers la droite du terrain.",
            "items": {"type": "array", "items": PLAYER},
        },
        "absents": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nom": {"type": "string"},
                    "raison": {"type": "string", "description": "Blessure, suspension, incertain…"},
                },
                "required": ["nom", "raison"],
                "additionalProperties": False,
            },
        },
        "entraineur": {"type": "string"},
    },
    "required": ["schema_tactique", "lignes", "absents", "entraineur"],
    "additionalProperties": False,
}

TOOL = {
    "name": "enregistrer_compositions",
    "description": "Enregistre les compositions probables des deux équipes pour l'affichage sur le site. "
                   "À appeler une seule fois, quand la recherche est terminée.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "domicile": TEAM,
            "exterieur": TEAM,
            "fiabilite": {
                "type": "string",
                "enum": ["élevée", "moyenne", "faible"],
                "description": "élevée = compositions publiées par la presse pour ce match ; "
                               "faible = déduites des derniers matchs, sans source récente.",
            },
            "note": {"type": "string", "description": "Une ou deux phrases : d'où viennent les infos, incertitudes."},
            "sources": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"titre": {"type": "string"}, "url": {"type": "string"}},
                    "required": ["titre", "url"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["domicile", "exterieur", "fiabilite", "note", "sources"],
        "additionalProperties": False,
    },
}

SYSTEM = """Tu prépares les compositions probables de matchs de football pour le site FootAnalyse.

Méthode :
1. Cherche sur le web les compositions probables publiées pour ce match précis (presse sportive : L'Équipe, Foot Mercato, presse du pays du championnat, sites des clubs…).
2. Si rien n'est encore publié, reconstitue le onze le plus probable à partir des derniers matchs de chaque équipe et des absences connues (blessures, suspensions, sélections), et indique fiabilite = "faible".
3. Termine en appelant l'outil enregistrer_compositions avec exactement 11 titulaires par équipe.

Règles :
- N'invente jamais un joueur : n'utilise que des joueurs dont tu as vérifié qu'ils font partie de l'effectif actuel.
- Le nombre de joueurs par ligne doit correspondre au schéma tactique (ex : 4-3-3 → lignes de 1, 4, 3, 3).
- Dans "sources", mets uniquement des pages que tu as réellement consultées.
- Écris en français."""


def _web_urls(content):
    """URLs réellement renvoyées par la recherche web (pour filtrer les sources)."""
    urls = set()
    for block in content:
        results = getattr(block, "content", None)
        if getattr(block, "type", "") == "web_search_tool_result" and isinstance(results, list):
            urls.update(getattr(r, "url", None) for r in results)
        for c in getattr(block, "citations", None) or []:
            urls.add(getattr(c, "url", None))
    urls.discard(None)
    return urls


def _valid(data):
    try:
        for side in ("domicile", "exterieur"):
            n = sum(len(line) for line in data[side]["lignes"])
            if n < 10 or n > 11:
                return False
        return True
    except (KeyError, TypeError):
        return False


def get_lineups(match_id, home, away, match_date, league="Ligue 1"):
    match_id = f"{league}:{match_id}"
    cached = _cache.get(match_id)
    if cached and time.time() - cached["time"] < CACHE_SECONDS:
        return cached["data"]

    client = anthropic.Anthropic()
    question = (
        f"Date du jour : {date.today().isoformat()}.\n"
        f"Match de {league} : {home} (domicile) contre {away} (extérieur), prévu le {match_date}.\n"
        "Trouve les compositions probables des deux équipes."
    )
    messages = [{"role": "user", "content": question}]
    seen_urls = set()

    for _ in range(6):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 6}, TOOL],
            tool_choice={"type": "auto"},  # Opus 5.5 n'accepte pas l'appel forcé d'un outil
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=messages,
        )
        seen_urls |= _web_urls(response.content)
        if response.stop_reason == "refusal":
            raise RuntimeError("La recherche des compositions a été refusée.")

        call = next((b for b in response.content
                     if b.type == "tool_use" and b.name == TOOL["name"]), None)
        if call is not None:
            data = call.input
            if not _valid(data):
                raise RuntimeError("Compositions incomplètes, réessaie plus tard.")
            # On ne garde que les sources réellement trouvées par la recherche
            if seen_urls:
                data["sources"] = [s for s in data["sources"] if s["url"] in seen_urls]
            data["generee_le"] = time.strftime("%d/%m/%Y %H:%M")
            _cache[match_id] = {"time": time.time(), "data": data}
            return data

        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason != "pause_turn":
            # Claude a répondu sans appeler l'outil : on lui rappelle de le faire
            messages.append({"role": "user", "content":
                             "Appelle maintenant l'outil enregistrer_compositions avec ce que tu as trouvé."})

    raise RuntimeError("Impossible d'obtenir les compositions, réessaie plus tard.")
