import unittest
from unittest.mock import patch

from mcp import Client

import mcp_server


class FootAnalyseMCPTests(unittest.IsolatedAsyncioTestCase):
    async def test_tools_are_registered_and_list_leagues_works(self):
        async with Client(mcp_server.mcp) as client:
            tools = await client.list_tools()
            names = {tool.name for tool in tools.tools}
            self.assertEqual(
                names,
                {
                    "list_leagues",
                    "get_league_overview",
                    "get_standings",
                    "get_upcoming_matches",
                    "get_top_scorers",
                },
            )

            result = await client.call_tool("list_leagues", {})
            self.assertFalse(result.is_error)
            self.assertEqual(len(result.structured_content["leagues"]), 5)

    async def test_upcoming_matches_limit_is_enforced(self):
        fake_data = {
            "info": {"season": "2026-2027"},
            "upcoming": [{"id": f"match-{index}"} for index in range(5)],
            "standings": [],
            "teams": [],
            "players": [],
        }
        with (
            patch.object(mcp_server.footanalyse, "API_KEY", "test-key"),
            patch.object(mcp_server.footanalyse, "get_league_data", return_value=fake_data),
        ):
            async with Client(mcp_server.mcp) as client:
                result = await client.call_tool(
                    "get_upcoming_matches", {"code": "FL1", "limit": 2}
                )

        self.assertFalse(result.is_error)
        self.assertEqual(len(result.structured_content["matches"]), 2)
        self.assertEqual(result.structured_content["league"]["name"], "Ligue 1")


if __name__ == "__main__":
    unittest.main()

