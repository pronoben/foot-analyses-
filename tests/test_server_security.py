import unittest
from unittest.mock import patch

import lineups_ai
import server


class PublicFilesTests(unittest.TestCase):
    def test_frontend_files_are_public(self):
        self.assertTrue(server.is_public_path("/"))
        self.assertTrue(server.is_public_path("/index.html"))
        self.assertTrue(server.is_public_path("/style.css"))
        self.assertTrue(server.is_public_path("/live.js"))
        self.assertTrue(server.is_public_path("/coach.js"))
        self.assertTrue(server.is_public_path("/training-data.js"))

    def test_internal_and_nested_files_are_private(self):
        for path in (
            "/.git/config",
            "/.env",
            "/server.py",
            "/tests/demo.js",
            "/../README.md",
        ):
            with self.subTest(path=path):
                self.assertFalse(server.is_public_path(path))


class RateLimiterTests(unittest.TestCase):
    def test_limit_is_enforced_per_key(self):
        limiter = server.RateLimiter()
        with patch.object(server.time, "time", return_value=1000):
            self.assertTrue(limiter.allow(("127.0.0.1", "/api/chat"), 2, 60))
            self.assertTrue(limiter.allow(("127.0.0.1", "/api/chat"), 2, 60))
            self.assertFalse(limiter.allow(("127.0.0.1", "/api/chat"), 2, 60))
            self.assertTrue(limiter.allow(("127.0.0.2", "/api/chat"), 2, 60))


class LineupValidationTests(unittest.TestCase):
    @staticmethod
    def _team(player_count):
        return {"lignes": [[{"nom": str(index)} for index in range(player_count)]]}

    def test_exactly_eleven_players_are_required(self):
        self.assertTrue(
            lineups_ai._valid(
                {"domicile": self._team(11), "exterieur": self._team(11)}
            )
        )
        self.assertFalse(
            lineups_ai._valid(
                {"domicile": self._team(10), "exterieur": self._team(11)}
            )
        )

    def test_only_seen_https_sources_are_allowed(self):
        seen = {"https://example.com/article"}
        self.assertTrue(lineups_ai._safe_source("https://example.com/article", seen))
        self.assertFalse(lineups_ai._safe_source("https://example.com/invented", seen))
        self.assertFalse(lineups_ai._safe_source("javascript:alert(1)", seen))


if __name__ == "__main__":
    unittest.main()
