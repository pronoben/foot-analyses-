"""Serveur MCP en lecture seule pour FootAnalyse.

Ce serveur expose les données publiques de football de l'application aux
assistants compatibles MCP. Les clés restent côté serveur et ne sont jamais
renvoyées par les outils.
"""

from __future__ import annotations

import os
from typing import Any

from mcp.server.mcpserver import MCPServer

import server as footanalyse


LEAGUES = {
    "FL1": {"name": "Ligue 1", "country": "France"},
    "PL": {"name": "Premier League", "country": "Angleterre"},
    "PD": {"name": "Liga", "country": "Espagne"},
    "SA": {"name": "Serie A", "country": "Italie"},
    "BL1": {"name": "Bundesliga", "country": "Allemagne"},
}

mcp = MCPServer(
    "FootAnalyse",
    instructions=(
        "Utilise ces outils pour consulter les championnats, classements, "
        "prochains matchs et meilleurs buteurs de FootAnalyse. Les outils sont "
        "en lecture seule et les données proviennent de football-data.org."
    ),
)


def _normalise_code(code: str) -> str:
    normalised = code.strip().upper()
    if normalised not in LEAGUES:
        allowed = ", ".join(LEAGUES)
        raise ValueError(f"Championnat inconnu : {code}. Codes autorisés : {allowed}.")
    return normalised


def _league_data(code: str) -> dict[str, Any]:
    normalised = _normalise_code(code)
    if not footanalyse.API_KEY:
        raise RuntimeError(
            "FOOTBALL_DATA_KEY n'est pas configurée sur le serveur FootAnalyse."
        )
    try:
        return footanalyse.get_league_data(normalised)
    except Exception as exc:
        raise RuntimeError(
            f"Impossible de récupérer les données du championnat {normalised}."
        ) from exc


def _bounded_limit(limit: int, maximum: int = 50) -> int:
    return max(1, min(int(limit), maximum))


def _league_identity(code: str) -> dict[str, str]:
    normalised = _normalise_code(code)
    return {"code": normalised, **LEAGUES[normalised]}


@mcp.tool()
def list_leagues() -> dict[str, Any]:
    """Liste les championnats disponibles et les codes acceptés par les outils."""
    return {
        "leagues": [
            {"code": code, **details} for code, details in LEAGUES.items()
        ]
    }


@mcp.tool()
def get_league_overview(code: str) -> dict[str, Any]:
    """Retourne le classement, les prochains matchs et les buteurs d'un championnat."""
    return {"league": _league_identity(code), **_league_data(code)}


@mcp.tool()
def get_standings(code: str) -> dict[str, Any]:
    """Retourne le classement actuel d'un championnat."""
    data = _league_data(code)
    return {
        "league": _league_identity(code),
        "info": data.get("info", {}),
        "standings": data.get("standings", []),
        "teams": data.get("teams", []),
    }


@mcp.tool()
def get_upcoming_matches(code: str, limit: int = 10) -> dict[str, Any]:
    """Retourne les prochains matchs d'un championnat, dans l'ordre chronologique."""
    data = _league_data(code)
    return {
        "league": _league_identity(code),
        "info": data.get("info", {}),
        "matches": data.get("upcoming", [])[: _bounded_limit(limit)],
    }


@mcp.tool()
def get_top_scorers(code: str, limit: int = 10) -> dict[str, Any]:
    """Retourne les meilleurs buteurs disponibles pour un championnat."""
    data = _league_data(code)
    players = sorted(
        data.get("players", []),
        key=lambda player: player.get("goals") or 0,
        reverse=True,
    )
    return {
        "league": _league_identity(code),
        "info": data.get("info", {}),
        "players": players[: _bounded_limit(limit)],
    }


if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host=os.environ.get("MCP_HOST", "127.0.0.1"),
        port=int(os.environ.get("MCP_PORT", "8000")),
        streamable_http_path="/mcp",
        stateless_http=True,
        json_response=True,
    )

