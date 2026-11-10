"""
Chatbot FootAnalyse – cerveau du chatbot
----------------------------------------
Utilise Claude (API Anthropic) pour répondre à toutes les questions sur le football.
- Recherche web activée : Claude peut chercher les infos récentes
  (résultats d'hier, transferts, blessures…) et cite ses sources.
- Il reçoit aussi les données affichées sur le site (classement, prochains matchs).
- Il refuse poliment les sujets qui n'ont rien à voir avec le football.

Clé nécessaire dans .env :  ANTHROPIC_API_KEY=...
"""

from datetime import date

import anthropic

MODEL = "claude-opus-5-5"
MAX_HISTORY = 12          # nombre de messages gardés dans la conversation
MAX_MESSAGE_CHARS = 4000  # longueur max d'un message
MAX_CONTEXT_CHARS = 40000  # longueur max des données du site

SYSTEM_PROMPT = """Tu es l'assistant football du site FootAnalyse, un projet étudiant d'analyse de matchs.

Ton rôle : répondre à toutes les questions sur le football, quel que soit le championnat ou l'époque — résultats, classements, joueurs, transferts, tactique, règles, histoire, statistiques, pronostics, compétitions internationales, football féminin.

Comment répondre :
- Réponds en français, de façon claire et assez courte (quelques phrases ou une petite liste), sauf si on te demande plus de détails.
- Pour tout ce qui peut avoir changé récemment (scores, classements, blessures, transferts, entraîneurs, calendrier), utilise la recherche web plutôt que ta mémoire, et indique la date de l'information quand c'est utile.
- Le site couvre 5 championnats : Ligue 1, Premier League, Liga, Serie A et Bundesliga. Les données te sont fournies avec la question (championnat affiché en détail, les autres en résumé) : classement, prochains matchs, pronostics du modèle du site (probabilités, buts attendus, plus de 2,5 buts, les deux équipes marquent, scores probables), analyse d'avant-match et compositions probables avec absents. Appuie-toi dessus pour toute question d'analyse des matchs de ces championnats, en citant les chiffres du site, et précise si elles semblent dater.

Analyse de match (c'est la spécialité du site) :
- Quand on te demande d'analyser un match, structure ta réponse : rapport de forces (classement, points, buts marqués/encaissés par match), pronostic du modèle, joueurs clés et absents, scénario probable, puis ton avis.
- Tu peux aussi comparer des équipes, classer les matchs de la journée (le plus serré, le plus offensif, la plus grosse surprise possible), expliquer une statistique ou une notion (xG, pressing, bloc bas…).
- Le modèle du site est une loi de Poisson : force offensive et défensive de chaque équipe par rapport à la moyenne de la ligue (lissée vers la moyenne car peu de matchs joués), avantage du terrain de 12 %. Explique-le simplement si on te le demande, avec ses limites (ne tient pas compte des absences, de la forme récente ni du calendrier).
- Statistiques des joueurs : les données du site contiennent buts, passes décisives, penalties et matchs joués des meilleurs joueurs du championnat affiché. Utilise-les en priorité et cite la date. Pour un joueur absent de cette liste, une stat plus détaillée (tirs, xG, minutes, notes) ou un autre championnat, utilise la recherche web et indique ta source. Tu peux calculer des ratios (buts par match, minutes par but) et comparer des joueurs.
- Si l'actualité peut changer l'analyse (blessure récente, changement d'entraîneur), vérifie-la avec la recherche web.
- Pour les pronostics, donne une analyse argumentée (forme, classement, buts marqués/encaissés) et rappelle qu'un pronostic n'est jamais une certitude. N'encourage pas les paris d'argent.
- Si tu ne sais pas ou que tu ne trouves pas l'information, dis-le franchement plutôt que d'inventer.
- Si la question n'a aucun rapport avec le football, réponds en une phrase que tu es spécialisé dans le football et propose une question football à la place."""


def _clean_history(messages):
    """Garde uniquement des messages valides (rôle user/assistant, texte)."""
    clean = []
    for m in messages[-MAX_HISTORY:]:
        role, content = m.get("role"), m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            clean.append({"role": role, "content": content.strip()[:MAX_MESSAGE_CHARS]})
    # La conversation doit commencer par un message de l'utilisateur
    while clean and clean[0]["role"] != "user":
        clean.pop(0)
    if not clean or clean[-1]["role"] != "user":
        raise ValueError("Le dernier message doit venir de l'utilisateur.")
    return clean


def answer(messages, site_context=""):
    """Renvoie {"reply": texte, "sources": [{"title", "url"}]}."""
    history = _clean_history(messages)

    # On ajoute la date du jour et les données du site au dernier message
    # (et pas dans le prompt système, pour garder celui-ci stable et en cache).
    extra = f"<date_du_jour>{date.today().isoformat()}</date_du_jour>\n"
    if site_context:
        extra += f"<donnees_du_site>\n{site_context[:MAX_CONTEXT_CHARS]}\n</donnees_du_site>\n"
    history[-1] = {"role": "user", "content": extra + "\n" + history[-1]["content"]}

    client = anthropic.Anthropic()  # lit ANTHROPIC_API_KEY
    request = dict(
        model=MODEL,
        max_tokens=16000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 4}],
        output_config={"effort": "low"},  # conversation : réponses rapides
        # Si Claude Opus 5.5 refuse par prudence, l'API réessaie automatiquement
        # avec un autre modèle adapté.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )

    # La recherche web peut mettre la réponse « en pause » (pause_turn) :
    # on relance alors la requête pour que Claude termine.
    for _ in range(4):
        response = client.beta.messages.create(messages=history, **request)
        if response.stop_reason != "pause_turn":
            break
        history.append({"role": "assistant", "content": response.content})

    if response.stop_reason == "refusal":
        return {"reply": "Désolé, je ne peux pas répondre à cette question. Pose-moi une autre question sur le football !", "sources": []}

    text_parts, sources, seen = [], [], set()
    for block in response.content:
        if block.type != "text":
            continue
        text_parts.append(block.text)
        for c in getattr(block, "citations", None) or []:
            url = getattr(c, "url", None)
            if url and url not in seen:
                seen.add(url)
                sources.append({"title": getattr(c, "title", None) or url, "url": url})

    reply = "".join(text_parts).strip() or "Je n'ai pas réussi à formuler une réponse, peux-tu reformuler ?"
    return {"reply": reply, "sources": sources[:5]}
