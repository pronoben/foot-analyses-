"""
Serveur FootAnalyse
-------------------
- Sert le site (index.html, css/, js/)
- Expose /api/league?code=FL1|PL|PD|SA|BL1 : classement, prochains matchs et
  buteurs d'un championnat (Ligue 1, Premier League, Liga, Serie A, Bundesliga),
  récupérés sur football-data.org avec TA clé API (jamais envoyée au navigateur)
- Garde les données en cache 10 minutes (offre gratuite : 10 requêtes/minute)

Lancement :
    python3 server.py
puis ouvrir http://localhost:8765

- Expose /api/chat : le chatbot (Claude), voir chatbot_ai.py
- Expose /api/lineup : compositions probables d'un match, voir lineups_ai.py

Les clés API se mettent dans un fichier .env (voir .env.example) :
    FOOTBALL_DATA_KEY=...
    ANTHROPIC_API_KEY=...

Le chatbot a besoin du SDK Anthropic : pip install -r requirements.txt
(le reste du site fonctionne sans).
"""

import json
import os
import threading
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 8765))
API_BASE = "https://api.football-data.org/v4/competitions/"
GLOBAL_API_BASE = "https://api.football-data.org/v4"
# Codes football-data.org des championnats proposés par le site (tous gratuits)
LEAGUE_CODES = {"FL1", "PL", "PD", "SA", "BL1"}
CACHE_SECONDS = 600
LIVE_CACHE_SECONDS = 30
NEWS_CACHE_SECONDS = 300
PARIS = ZoneInfo("Europe/Paris")

PUBLIC_FILES = {
    "index.html",
    "style.css",
    "config.js",
    "data.js",
    "lineups-data.js",
    "players-data.js",
    "leagues.js",
    "ligue1.js",
    "premier-league.js",
    "liga.js",
    "serie-a.js",
    "bundesliga.js",
    "analysis.js",
    "chat-players.js",
    "chat-local.js",
    "chatbot.js",
    "app.js",
    "live.js",
    "training.js",
}
PUBLIC_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff2"}


def load_env():
    """Lit le fichier .env (format CLE=valeur) sans bibliothèque externe."""
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
API_KEY = os.environ.get("FOOTBALL_DATA_KEY", "")
AI_PUBLIC_ENABLED = os.environ.get("ENABLE_PUBLIC_AI", "false").lower() == "true"
TRUST_PROXY = os.environ.get("TRUST_PROXY", "false").lower() == "true"
ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.environ.get(
        "ALLOWED_ORIGINS", "http://localhost:8765,http://127.0.0.1:8765"
    ).split(",")
    if origin.strip()
}
NEWS_FEEDS = [
    url.strip()
    for url in os.environ.get("NEWS_FEEDS", "").split(",")
    if url.strip().startswith("https://")
][:5]

_cache = {}  # code du championnat -> {"time": ..., "data": ...}
_live_cache = {"time": 0.0, "data": None}
_news_cache = {"time": 0.0, "data": None}


class RateLimiter:
    """Limiteur simple en mémoire, adapté à un petit déploiement mono-processus."""

    def __init__(self):
        self._events = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key, limit, period_seconds):
        now = time.time()
        with self._lock:
            events = self._events[key]
            while events and events[0] <= now - period_seconds:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True


RATE_LIMITER = RateLimiter()
RATE_LIMITS = {
    "/api/league": (60, 60),
    "/api/live": (120, 60),
    "/api/news": (30, 60),
    "/api/chat": (10, 300),
    "/api/lineup": (4, 600),
}


def call_api(path, code="FL1"):
    req = urllib.request.Request(API_BASE + code + path, headers={"X-Auth-Token": API_KEY})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def fetch_league(code):
    """Récupère et simplifie les données pour le site."""
    standings_raw = call_api("/standings", code)
    today = datetime.now(PARIS).date()
    matches_raw = call_api(
        f"/matches?dateFrom={today.isoformat()}&dateTo={(today + timedelta(days=21)).isoformat()}", code
    )

    table = next(s for s in standings_raw["standings"] if s["type"] == "TOTAL")["table"]

    teams, standings = [], []
    for row in table:
        t = row["team"]
        tid = t.get("tla") or str(t["id"])
        teams.append({"id": tid, "name": t.get("shortName") or t["name"], "crest": t.get("crest")})
        standings.append({
            "id": tid,
            "P": row["playedGames"], "W": row["won"], "D": row["draw"], "L": row["lost"],
            "GF": row["goalsFor"], "GA": row["goalsAgainst"], "pts": row["points"],
            "form": row.get("form"),
        })

    upcoming = []
    for m in matches_raw.get("matches", []):
        if m["status"] not in ("SCHEDULED", "TIMED"):
            continue
        kickoff = datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00")).astimezone(PARIS)
        home = m["homeTeam"].get("tla") or str(m["homeTeam"]["id"])
        away = m["awayTeam"].get("tla") or str(m["awayTeam"]["id"])
        upcoming.append({
            "id": f"J{m['matchday']}-{home}-{away}",
            "day": m["matchday"],
            "date": kickoff.strftime("%Y-%m-%d"),
            # TIMED = horaire officiel ; SCHEDULED = horaire pas encore fixé
            "time": kickoff.strftime("%H:%M") if m["status"] == "TIMED" else "À fixer",
            "home": home,
            "away": away,
        })
    upcoming.sort(key=lambda x: (x["date"], x["time"]))

    # Classement des buteurs (optionnel : le site marche sans)
    players = []
    try:
        for row in call_api("/scorers?limit=60", code).get("scorers", []):
            t = row.get("team") or {}
            players.append({
                "name": row["player"]["name"],
                "team": t.get("tla") or str(t.get("id")),
                "goals": row.get("goals"),
                "assists": row.get("assists"),
                "penalties": row.get("penalties"),
                "matches": row.get("playedMatches"),
            })
    except Exception:
        players = []

    season = standings_raw.get("season", {})
    start_year = (season.get("startDate") or "")[:4]
    end_year = (season.get("endDate") or "")[:4]
    return {
        "source": "api",
        "info": {
            "season": f"{start_year}-{end_year}",
            "currentMatchday": season.get("currentMatchday"),
            "fetchedAt": datetime.now(PARIS).strftime("%d/%m/%Y %H:%M"),
        },
        "teams": teams,
        "standings": standings,
        "upcoming": upcoming,
        "players": players,
    }


def get_league_data(code):
    """Retourne les données d'un championnat avec le cache partagé du serveur."""
    cached = _cache.get(code)
    if cached and time.time() - cached["time"] < CACHE_SECONDS:
        return cached["data"]
    data = fetch_league(code)
    _cache[code] = {"time": time.time(), "data": data}
    return data


def call_global_api(path):
    req = urllib.request.Request(
        GLOBAL_API_BASE + path,
        headers={"X-Auth-Token": API_KEY, "User-Agent": "FootAnalyse/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def fetch_live_matches():
    """Matchs du jour, y compris les scores en cours selon l'offre du fournisseur."""
    today = datetime.now(PARIS).date().isoformat()
    raw = call_global_api(f"/matches?dateFrom={today}&dateTo={today}")
    matches = []
    for match in raw.get("matches", []):
        competition = match.get("competition") or {}
        code = competition.get("code")
        if code not in LEAGUE_CODES:
            continue
        score = match.get("score") or {}
        full_time = score.get("fullTime") or {}
        half_time = score.get("halfTime") or {}
        utc_date = match.get("utcDate") or ""
        kickoff = None
        if utc_date:
            kickoff = datetime.fromisoformat(utc_date.replace("Z", "+00:00")).astimezone(PARIS)
        matches.append(
            {
                "id": match.get("id"),
                "competition": {"code": code, "name": competition.get("name")},
                "status": match.get("status"),
                "minute": match.get("minute"),
                "injuryTime": match.get("injuryTime"),
                "kickoff": kickoff.isoformat() if kickoff else None,
                "home": {
                    "id": (match.get("homeTeam") or {}).get("id"),
                    "name": (match.get("homeTeam") or {}).get("shortName")
                    or (match.get("homeTeam") or {}).get("name"),
                    "crest": (match.get("homeTeam") or {}).get("crest"),
                },
                "away": {
                    "id": (match.get("awayTeam") or {}).get("id"),
                    "name": (match.get("awayTeam") or {}).get("shortName")
                    or (match.get("awayTeam") or {}).get("name"),
                    "crest": (match.get("awayTeam") or {}).get("crest"),
                },
                "score": {
                    "home": full_time.get("home"),
                    "away": full_time.get("away"),
                    "halfTime": [half_time.get("home"), half_time.get("away")],
                },
            }
        )
    matches.sort(key=lambda item: item.get("kickoff") or "")
    return {
        "source": "football-data.org",
        "fetchedAt": datetime.now(PARIS).isoformat(),
        "matches": matches,
    }


def get_live_data():
    if _live_cache["data"] and time.time() - _live_cache["time"] < LIVE_CACHE_SECONDS:
        return _live_cache["data"]
    data = fetch_live_matches()
    _live_cache.update(time=time.time(), data=data)
    return data


def _xml_text(element, name):
    for child in list(element):
        if child.tag.rsplit("}", 1)[-1] == name and child.text:
            return child.text.strip()
    return ""


def fetch_news():
    """Lit des flux RSS/Atom configurés, sans recopier le contenu des articles."""
    items = []
    for feed_url in NEWS_FEEDS:
        request = urllib.request.Request(feed_url, headers={"User-Agent": "FootAnalyse/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                root = ET.fromstring(response.read(1_000_000))
        except Exception:
            continue
        source = urlparse(feed_url).hostname or "Source sportive"
        entries = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1] in {"item", "entry"}]
        for entry in entries[:10]:
            title = _xml_text(entry, "title")[:180]
            link = _xml_text(entry, "link")
            if not link:
                link_node = next(
                    (node for node in list(entry) if node.tag.rsplit("}", 1)[-1] == "link"),
                    None,
                )
                link = (link_node.attrib.get("href", "") if link_node is not None else "")
            published = _xml_text(entry, "pubDate") or _xml_text(entry, "published") or _xml_text(entry, "updated")
            parsed = urlparse(link)
            if title and parsed.scheme == "https" and parsed.netloc:
                items.append(
                    {"title": title, "url": link, "publishedAt": published[:80], "source": source}
                )
    return {
        "configured": bool(NEWS_FEEDS),
        "fetchedAt": datetime.now(PARIS).isoformat(),
        "items": items[:30],
    }


def get_news_data():
    if _news_cache["data"] and time.time() - _news_cache["time"] < NEWS_CACHE_SECONDS:
        return _news_cache["data"]
    data = fetch_news()
    _news_cache.update(time=time.time(), data=data)
    return data


def is_public_path(path):
    """Autorise uniquement les ressources nécessaires au frontend."""
    clean = unquote(path).split("?", 1)[0].lstrip("/") or "index.html"
    parts = Path(clean).parts
    if not parts or any(part.startswith(".") or part == ".." for part in parts):
        return False
    # Les fichiers du site sont tous à la racine. Cette contrainte évite qu'un
    # futur fichier ajouté dans tests/ ou un dossier interne devienne public.
    return len(parts) == 1 and (
        clean in PUBLIC_FILES or Path(clean).suffix.lower() in PUBLIC_SUFFIXES
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' https: data:; connect-src 'self' https:; "
            "font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        )
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin and origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        super().end_headers()

    def client_key(self, route):
        forwarded = ""
        if TRUST_PROXY:
            forwarded = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        address = forwarded or self.client_address[0]
        return address, route

    def rate_limit(self, route):
        limit = RATE_LIMITS.get(route)
        if not limit:
            return True
        allowed = RATE_LIMITER.allow(self.client_key(route), *limit)
        if not allowed:
            self.send_json(429, {"error": "Trop de requêtes. Réessaie dans quelques instants."})
        return allowed

    def origin_allowed(self):
        origin = self.headers.get("Origin", "").rstrip("/")
        return not origin or origin in ALLOWED_ORIGINS

    def do_OPTIONS(self):
        if not self.origin_allowed():
            return self.send_error(403)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        route = self.path.split("?")[0]
        if route == "/api/league":
            if not self.rate_limit(route):
                return
            query = parse_qs(urlparse(self.path).query)
            return self.api_league((query.get("code") or ["FL1"])[0].upper())
        if route == "/api/ligue1":  # ancienne adresse, gardée pour compatibilité
            if not self.rate_limit("/api/league"):
                return
            return self.api_league("FL1")
        if route == "/api/live":
            if not self.rate_limit(route):
                return
            return self.api_live()
        if route == "/api/news":
            if not self.rate_limit(route):
                return
            return self.api_news()
        if not is_public_path(self.path):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        route = self.path.split("?")[0]
        if route not in ("/api/chat", "/api/lineup"):
            return self.send_error(404)
        if not self.origin_allowed():
            return self.send_json(403, {"error": "Origine non autorisée."})
        if not self.rate_limit(route):
            return
        if not AI_PUBLIC_ENABLED:
            return self.send_json(
                503,
                {"error": "Fonctions IA publiques désactivées tant que l'authentification n'est pas configurée."},
            )
        if not os.environ.get("ANTHROPIC_API_KEY"):
            return self.send_json(503, {"error": "Clé ANTHROPIC_API_KEY manquante dans .env."})
        try:
            import anthropic
            import chatbot_ai
            import lineups_ai
        except ImportError:
            return self.send_json(503, {"error": "SDK Anthropic non installé : pip install -r requirements.txt"})
        try:
            if "application/json" not in self.headers.get("Content-Type", ""):
                return self.send_json(415, {"error": "Content-Type application/json obligatoire."})
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 64_000:
                return self.send_json(413, {"error": "Message trop long."})
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError("Le corps JSON doit être un objet.")
            if route == "/api/chat":
                code = str(body.get("league") or "FL1").upper()
                if code not in LEAGUE_CODES:
                    raise ValueError("Championnat inconnu.")
                messages = body.get("messages")
                if not isinstance(messages, list) or not all(
                    isinstance(message, dict) for message in messages
                ):
                    raise ValueError("La conversation doit être une liste de messages.")
                trusted_context = ""
                if API_KEY:
                    trusted_context = json.dumps(
                        get_league_data(code), ensure_ascii=False, separators=(",", ":")
                    )
                result = chatbot_ai.answer(messages, trusted_context)
            else:
                fields = [str(body.get(k, ""))[:80] for k in ("id", "home", "away", "date")]
                if not all(fields):
                    raise ValueError("Champs id, home, away et date obligatoires.")
                league = str(body.get("league") or "Ligue 1")[:40]
                result = lineups_ai.get_lineups(*fields, league=league)
        except (ValueError, json.JSONDecodeError) as e:
            return self.send_json(400, {"error": str(e)})
        except anthropic.AuthenticationError:
            return self.send_json(502, {"error": "Clé Anthropic invalide."})
        except anthropic.RateLimitError:
            return self.send_json(429, {"error": "Trop de questions d'un coup, réessaie dans quelques secondes."})
        except anthropic.APIStatusError as e:
            return self.send_json(502, {"error": f"Erreur de l'API Claude ({e.status_code})."})
        except anthropic.APIConnectionError:
            return self.send_json(502, {"error": "Impossible de joindre l'API Claude (connexion internet ?)."})
        except RuntimeError as e:
            return self.send_json(502, {"error": str(e)})
        self.send_json(200, result)

    def api_league(self, code):
        if code not in LEAGUE_CODES:
            return self.send_json(400, {"error": f"Championnat inconnu : {code}"})
        if not API_KEY:
            return self.send_json(503, {"error": "Clé API manquante : crée le fichier .env (voir .env.example)."})
        try:
            data = get_league_data(code)
        except urllib.error.HTTPError as e:
            msg = {401: "Clé API invalide.", 403: "Accès refusé par l'API.", 429: "Trop de requêtes, réessaie dans une minute."}
            return self.send_json(502, {"error": msg.get(e.code, f"Erreur API ({e.code}).")})
        except Exception:  # réseau coupé, format inattendu…
            return self.send_json(502, {"error": "Impossible de joindre le fournisseur de données."})
        self.send_json(200, data)

    def api_live(self):
        if not API_KEY:
            return self.send_json(503, {"error": "Clé FOOTBALL_DATA_KEY manquante."})
        try:
            return self.send_json(200, get_live_data())
        except urllib.error.HTTPError as error:
            return self.send_json(502, {"error": f"Fournisseur de scores indisponible ({error.code})."})
        except Exception:
            return self.send_json(502, {"error": "Impossible de récupérer les matchs en direct."})

    def api_news(self):
        try:
            return self.send_json(200, get_news_data())
        except Exception:
            return self.send_json(502, {"error": "Impossible de récupérer les actualités."})


if __name__ == "__main__":
    print(f"FootAnalyse → http://localhost:{PORT}")
    print("Clé football-data :", "trouvée ✅" if API_KEY else "absente ❌ (le site utilisera les données enregistrées)")
    print("Clé Anthropic (chatbot) :", "trouvée ✅" if os.environ.get("ANTHROPIC_API_KEY") else "absente ❌ (chatbot en mode simple)")
    print("IA publique :", "activée ⚠️" if AI_PUBLIC_ENABLED else "désactivée ✅")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
