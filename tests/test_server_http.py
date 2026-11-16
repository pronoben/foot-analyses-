"""Tests HTTP du backend : CORS, validation, limites et plafond de dépense.

Aucun appel réel à l'API Claude : chatbot_ai.answer est remplacé par un faux.
"""

import http.client
import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import chatbot_ai
import server

ORIGIN = "https://pronoben.github.io"
FAKE_ANSWER = {
    "reply": "Fait vérifié. [1]",
    "sources": [{"title": "UEFA", "url": "https://www.uefa.com/a", "domain": "www.uefa.com"}],
    "research": {"status": "verified", "searchedWeb": True, "sourceCount": 1},
}


class BackendHTTPTests(unittest.TestCase):
    def setUp(self):
        chatbot_ai._cache.clear()
        self.patches = [
            patch.object(server, "AI_PUBLIC_ENABLED", True),
            patch.object(server, "TRUST_PROXY", True),
            patch.object(server, "ALLOWED_ORIGINS", {ORIGIN}),
            patch.object(server, "API_KEY", ""),
            patch.object(server, "RATE_LIMITER", server.RateLimiter()),
            patch.object(server, "SPENDING", server.SpendingGuard(daily_units=10, hourly_units=3, max_concurrent=2)),
            patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-sans-valeur-reelle"}),
            patch.object(chatbot_ai, "answer", side_effect=lambda *a, **k: FAKE_ANSWER),
        ]
        for p in self.patches:
            p.start()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        for p in reversed(self.patches):
            p.stop()

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        payload = json.dumps(body).encode() if isinstance(body, (dict, list)) else body
        conn.request(method, path, body=payload, headers=headers or {})
        res = conn.getresponse()
        data = res.read()
        conn.close()
        try:
            parsed = json.loads(data)
        except ValueError:
            parsed = None
        return res.status, dict(res.getheaders()), parsed

    def chat(self, question="Combien de buts ?", ip="1.2.3.4", origin=ORIGIN):
        headers = {"Content-Type": "application/json", "CF-Connecting-IP": ip}
        if origin:
            headers["Origin"] = origin
        return self.request(
            "POST", "/api/chat",
            {"messages": [{"role": "user", "content": question}], "league": "FL1"},
            headers,
        )

    def test_health_has_no_secret(self):
        status, headers, data = self.request("GET", "/api/health", headers={"Origin": ORIGIN})
        self.assertEqual(status, 200)
        self.assertTrue(data["ai"])
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), ORIGIN)
        self.assertNotIn("test-sans-valeur-reelle", json.dumps(data))

    def test_preflight_allowed_only_for_known_origin(self):
        status, headers, _ = self.request("OPTIONS", "/api/chat", headers={
            "Origin": ORIGIN, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"})
        self.assertEqual(status, 204)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), ORIGIN)
        status, _, _ = self.request("OPTIONS", "/api/chat", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)

    def test_chat_success_with_cors(self):
        status, headers, data = self.chat()
        self.assertEqual(status, 200)
        self.assertEqual(data["research"]["status"], "verified")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), ORIGIN)
        self.assertEqual(headers.get("Cache-Control"), "no-store")

    def test_chat_requires_allowed_origin(self):
        self.assertEqual(self.chat(origin=None)[0], 403)
        self.assertEqual(self.chat(origin="https://evil.example")[0], 403)

    def test_invalid_messages_are_rejected_before_spending(self):
        status, _, data = self.chat(question="x" * 1500)
        self.assertEqual(status, 400)
        self.assertIn("trop longue", data["error"])
        status, _, _ = self.request("POST", "/api/chat", b"pas du json", {
            "Content-Type": "application/json", "Origin": ORIGIN, "CF-Connecting-IP": "9.9.9.9"})
        self.assertEqual(status, 400)
        status, _, _ = self.request("POST", "/api/chat", b"{}", {
            "Content-Type": "text/plain", "Origin": ORIGIN, "CF-Connecting-IP": "9.9.9.8"})
        self.assertEqual(status, 415)
        self.assertEqual(server.SPENDING.status()["remainingToday"], 10)

    def test_global_budget_blocks_spending_across_ips(self):
        for i in range(3):
            self.assertEqual(self.chat(question=f"Question {i}", ip=f"10.0.0.{i}")[0], 200)
        status, headers, data = self.chat(question="Encore une", ip="10.0.0.99")
        self.assertEqual(status, 503)
        self.assertEqual(data["budget"], "hourly")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), ORIGIN)

    def test_identical_question_served_from_cache_without_budget(self):
        with patch.object(chatbot_ai, "answer", side_effect=lambda *a, **k: (chatbot_ai._store(
                chatbot_ai._clean_history(a[0]), "", FAKE_ANSWER) or FAKE_ANSWER)):
            self.assertEqual(self.chat(question="Même question", ip="5.5.5.1")[0], 200)
            status, _, data = self.chat(question="Même question", ip="5.5.5.2")
        self.assertEqual(status, 200)
        self.assertTrue(data["cached"])
        self.assertEqual(server.SPENDING.status()["remainingToday"], 9)

    def test_per_visitor_rate_limit(self):
        with patch.object(server, "SPENDING", server.SpendingGuard(1000, 1000, 2)):
            limit = server.RATE_LIMITS["/api/chat"][0]
            codes = [self.chat(question=f"Q{i}", ip="7.7.7.7")[0] for i in range(limit + 1)]
        self.assertEqual(codes[:limit], [200] * limit)
        self.assertEqual(codes[-1], 429)
        # Un autre visiteur n'est pas bloqué.
        self.assertEqual(self.chat(question="Autre", ip="8.8.8.8")[0], 200)

    def test_unexpected_error_returns_json(self):
        with patch.object(chatbot_ai, "answer", side_effect=KeyError("boom")):
            status, headers, data = self.chat(question="Erreur", ip="6.6.6.6")
        self.assertEqual(status, 500)
        self.assertIn("error", data)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), ORIGIN)

    def test_ai_disabled_returns_503(self):
        with patch.object(server, "AI_PUBLIC_ENABLED", False):
            status, _, data = self.chat(ip="4.4.4.4")
        self.assertEqual(status, 503)
        self.assertIn("ENABLE_PUBLIC_AI", data["error"])

    def test_spoofed_forwarded_for_is_ignored(self):
        # Sans en-tête Cloudflare, on ne prend pas la première valeur (falsifiable).
        handler = server.Handler.__new__(server.Handler)
        handler.client_address = ("10.1.1.1", 1234)
        handler.headers = {"X-Forwarded-For": "1.1.1.1, 203.0.113.9, 172.70.0.1"}
        self.assertEqual(handler.client_ip(), "203.0.113.9")


if __name__ == "__main__":
    unittest.main()
