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
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 8765))
API_BASE = "https://api.football-data.org/v4/competitions/"
# Codes football-data.org des championnats proposés par le site (tous gratuits)
LEAGUE_CODES = {"FL1", "PL", "PD", "SA", "BL1"}
CACHE_SECONDS = 600
PARIS = ZoneInfo("Europe/Paris")


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

_cache = {}  # code du championnat -> {"time": ..., "data": ...}


def call_api(path, code="FL1"):
    req = urllib.request.Request(API_BASE + code + path, headers={"X-Auth-Token": API_KEY})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def fetch_league(code):
    """Récupère et simplifie les données pour le site."""
    standings_raw = call_api("/standings", code)
    today = date.today()
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

    def do_GET(self):
        route = self.path.split("?")[0]
        if route == "/api/league":
            query = parse_qs(urlparse(self.path).query)
            return self.api_league((query.get("code") or ["FL1"])[0].upper())
        if route == "/api/ligue1":  # ancienne adresse, gardée pour compatibilité
            return self.api_league("FL1")
        # Ne jamais servir le fichier contenant la clé
        if self.path.split("?")[0].lstrip("/").startswith(".env"):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        route = self.path.split("?")[0]
        if route not in ("/api/chat", "/api/lineup"):
            return self.send_error(404)
        if not os.environ.get("ANTHROPIC_API_KEY"):
            return self.send_json(503, {"error": "Clé ANTHROPIC_API_KEY manquante dans .env."})
        try:
            import anthropic
            import chatbot_ai
            import lineups_ai
        except ImportError:
            return self.send_json(503, {"error": "SDK Anthropic non installé : pip install -r requirements.txt"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 200_000:
                return self.send_json(413, {"error": "Message trop long."})
            body = json.loads(self.rfile.read(length) or b"{}")
            if route == "/api/chat":
                result = chatbot_ai.answer(body.get("messages", []), str(body.get("context", "")))
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
        cached = _cache.get(code)
        if cached and time.time() - cached["time"] < CACHE_SECONDS:
            return self.send_json(200, cached["data"])
        try:
            data = fetch_league(code)
        except urllib.error.HTTPError as e:
            msg = {401: "Clé API invalide.", 403: "Accès refusé par l'API.", 429: "Trop de requêtes, réessaie dans une minute."}
            return self.send_json(502, {"error": msg.get(e.code, f"Erreur API ({e.code}).")})
        except Exception as e:  # réseau coupé, format inattendu…
            return self.send_json(502, {"error": f"Impossible de joindre l'API : {e}"})
        _cache[code] = {"time": time.time(), "data": data}
        self.send_json(200, data)


if __name__ == "__main__":
    print(f"FootAnalyse → http://localhost:{PORT}")
    print("Clé football-data :", "trouvée ✅" if API_KEY else "absente ❌ (le site utilisera les données enregistrées)")
    print("Clé Anthropic (chatbot) :", "trouvée ✅" if os.environ.get("ANTHROPIC_API_KEY") else "absente ❌ (chatbot en mode simple)")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
