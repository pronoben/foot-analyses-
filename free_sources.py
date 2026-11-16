"""
Sources de données gratuites du chatbot FootAnalyse
---------------------------------------------------
Toutes les statistiques affichées par le chatbot viennent d'ici, jamais de la
mémoire d'une IA.

- football-data.org : source principale (clé gratuite, 10 requêtes/minute,
  12 compétitions dont les 5 grands championnats et la Ligue des champions).
- TheSportsDB : seconde source pour le haut du classement (clé publique « 123 »,
  30 requêtes/minute, 5 premières places seulement en accès gratuit).
- OpenLigaDB : seconde source pour la Bundesliga (gratuite, sans clé).

Chaque fournisseur a son propre quota, tenu côté serveur un peu en dessous de la
limite officielle : quand il est atteint, on lève QuotaExceeded au lieu
d'appeler le fournisseur. Aucune de ces offres ne peut facturer : au pire, le
fournisseur refuse la requête.
"""

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")
USER_AGENT = "FootAnalyse/1.0 (+https://pronoben.github.io/foot-analyses-/)"
MAX_RESPONSE_BYTES = 3_000_000

FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"
TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123"
OPENLIGA_BASE = "https://api.openligadb.de"

# Championnats couverts : code football-data → informations utiles.
LEAGUES = {
    "FL1": {"name": "Ligue 1", "tsdb": "4334", "country": "France"},
    "PL": {"name": "Premier League", "tsdb": "4328", "country": "Angleterre"},
    "PD": {"name": "Liga", "tsdb": "4335", "country": "Espagne"},
    "SA": {"name": "Serie A", "tsdb": "4332", "country": "Italie"},
    "BL1": {"name": "Bundesliga", "tsdb": "4331", "country": "Allemagne", "openliga": "bl1"},
}
CHAMPIONS_LEAGUE = {"CL": {"name": "Ligue des champions"}}


class QuotaExceeded(Exception):
    """Le quota gratuit d'un fournisseur est atteint : aucun appel n'est fait."""

    def __init__(self, provider, retry_after):
        super().__init__(provider)
        self.provider = provider
        self.retry_after = retry_after


class SourceUnavailable(Exception):
    """Le fournisseur est indisponible, non configuré ou refuse la donnée."""

    def __init__(self, provider, reason):
        super().__init__(f"{provider} : {reason}")
        self.provider = provider
        self.reason = reason


class Quota:
    """Quota glissant par minute + plafond quotidien (heure de Paris)."""

    def __init__(self, per_minute, per_day=None):
        self.per_minute = per_minute
        self.per_day = per_day
        self._events = deque()
        self._day = None
        self._day_count = 0
        self._blocked_until = 0.0
        self._lock = threading.Lock()

    def acquire(self, provider):
        now = time.time()
        today = datetime.now(PARIS).date()
        with self._lock:
            if now < self._blocked_until:
                raise QuotaExceeded(provider, int(self._blocked_until - now) + 1)
            if self._day != today:
                self._day, self._day_count = today, 0
            while self._events and self._events[0] <= now - 60:
                self._events.popleft()
            if self.per_day is not None and self._day_count >= self.per_day:
                raise QuotaExceeded(provider, None)
            if len(self._events) >= self.per_minute:
                raise QuotaExceeded(provider, int(60 - (now - self._events[0])) + 1)
            self._events.append(now)
            self._day_count += 1

    def block(self, seconds):
        """Le fournisseur a répondu 429 : on arrête de l'appeler un moment."""
        with self._lock:
            self._blocked_until = max(self._blocked_until, time.time() + seconds)

    def status(self):
        now = time.time()
        with self._lock:
            used = sum(1 for t in self._events if t > now - 60)
            return {
                "perMinute": self.per_minute,
                "usedLastMinute": used,
                "perDay": self.per_day,
                "usedToday": self._day_count if self._day == datetime.now(PARIS).date() else 0,
                "blocked": now < self._blocked_until,
            }


def _env_int(name, default):
    try:
        return max(1, int(os.environ.get(name, default)))
    except ValueError:
        return default


QUOTAS = {
    # Limite officielle : 10/minute. On garde une marge.
    "football-data.org": Quota(per_minute=_env_int("FOOTBALL_DATA_PER_MINUTE", 9)),
    # Limite officielle : 30/minute avec la clé publique.
    "TheSportsDB": Quota(per_minute=25),
    # Pas de limite publiée : on reste raisonnable.
    "OpenLigaDB": Quota(per_minute=30),
}

_cache = {}
_cache_lock = threading.Lock()
# Un verrou par URL : plusieurs visiteurs qui demandent la même donnée au même
# moment ne déclenchent qu'un seul appel au fournisseur.
_url_locks = {}


def _url_lock(key):
    with _cache_lock:
        return _url_locks.setdefault(key, threading.Lock())


def now_paris():
    return datetime.now(PARIS)


def current_season_start(today=None):
    """Année de début de la saison en cours (juillet → juin)."""
    today = today or now_paris().date()
    return today.year if today.month >= 7 else today.year - 1


def season_label(start=None):
    start = current_season_start() if start is None else start
    return f"{start}-{start + 1}"


def _http_get_json(url, headers, provider, quota):
    quota.acquire(provider)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **headers})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as error:
        if error.code == 429:
            quota.block(60)
            raise QuotaExceeded(provider, 60)
        if error.code in (401, 403):
            raise SourceUnavailable(provider, "accès refusé (clé absente, invalide ou donnée hors offre gratuite)")
        raise SourceUnavailable(provider, f"erreur {error.code}")
    except (urllib.error.URLError, TimeoutError, OSError):
        raise SourceUnavailable(provider, "fournisseur injoignable")
    if len(raw) > MAX_RESPONSE_BYTES:
        raise SourceUnavailable(provider, "réponse trop volumineuse")
    try:
        return json.loads(raw)
    except ValueError:
        raise SourceUnavailable(provider, "réponse illisible")


def _cached(key, ttl, fetch):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() - entry["time"] < ttl:
            return entry
    with _url_lock(key):
        with _cache_lock:  # un autre visiteur vient peut-être de la récupérer
            entry = _cache.get(key)
            if entry and time.time() - entry["time"] < ttl:
                return entry
        data = fetch()
        entry = {"time": time.time(), "fetchedAt": now_paris().isoformat(), "data": data}
        with _cache_lock:
            if len(_cache) > 500:
                oldest = min(_cache, key=lambda k: _cache[k]["time"])
                _cache.pop(oldest, None)
            _cache[key] = entry
        return entry


def clear_cache():
    with _cache_lock:
        _cache.clear()


# ---------------------------------------------------------------- football-data
def football_data_key():
    return os.environ.get("FOOTBALL_DATA_KEY", "").strip()


def football_data(path, ttl=600):
    """GET {FOOTBALL_DATA_BASE}{path} avec cache, quota partagé et clé serveur."""
    key = football_data_key()
    if not key:
        raise SourceUnavailable("football-data.org", "clé FOOTBALL_DATA_KEY non configurée")
    url = FOOTBALL_DATA_BASE + path
    return _cached(
        "fd:" + path,
        ttl,
        lambda: _http_get_json(url, {"X-Auth-Token": key}, "football-data.org", QUOTAS["football-data.org"]),
    )


def fd_standings(code):
    return football_data(f"/competitions/{code}/standings")


def fd_scorers(code):
    return football_data(f"/competitions/{code}/scorers?limit=100")


def fd_matches(code, date_from, date_to):
    return football_data(
        f"/competitions/{code}/matches?dateFrom={date_from}&dateTo={date_to}", ttl=300
    )


def fd_source(entry, label):
    return {
        "title": f"football-data.org — {label}",
        "url": "https://www.football-data.org/coverage",
        "provider": "football-data.org",
        "fetchedAt": entry["fetchedAt"],
    }


# ------------------------------------------------------------------ TheSportsDB
def tsdb_table(code, season_start=None):
    league_id = LEAGUES[code]["tsdb"]
    season = season_label(season_start)
    query = urllib.parse.urlencode({"l": league_id, "s": season})
    url = f"{TSDB_BASE}/lookuptable.php?{query}"
    entry = _cached(
        "tsdb:" + query,
        1800,
        lambda: _http_get_json(url, {}, "TheSportsDB", QUOTAS["TheSportsDB"]),
    )
    return entry, {
        "title": f"TheSportsDB — classement {LEAGUES[code]['name']} {season} (5 premiers, données brutes)",
        "url": url,
        "provider": "TheSportsDB",
        "fetchedAt": entry["fetchedAt"],
    }


# ------------------------------------------------------------------- OpenLigaDB
def openliga(kind, season_start=None):
    if kind not in ("getbltable", "getgoalgetters"):
        raise ValueError("Ressource OpenLigaDB inconnue.")
    season = current_season_start() if season_start is None else season_start
    url = f"{OPENLIGA_BASE}/{kind}/bl1/{season}"
    entry = _cached(
        f"ol:{kind}:{season}",
        600,
        lambda: _http_get_json(url, {}, "OpenLigaDB", QUOTAS["OpenLigaDB"]),
    )
    label = "classement" if kind == "getbltable" else "buteurs"
    return entry, {
        "title": f"OpenLigaDB — {label} Bundesliga {season_label(season)} (données brutes)",
        "url": url,
        "provider": "OpenLigaDB",
        "fetchedAt": entry["fetchedAt"],
    }


def quota_status():
    return {name: quota.status() for name, quota in QUOTAS.items()}
