import unittest
from types import SimpleNamespace
from unittest.mock import patch

import chatbot_ai


def block(block_type, **values):
    return SimpleNamespace(type=block_type, **values)


class ResearchValidationTests(unittest.TestCase):
    def setUp(self):
        chatbot_ai._cache.clear()

    def test_detects_direct_and_nested_web_search(self):
        direct = [block("server_tool_use", name="web_search")]
        nested = [block("code_execution_tool_result", content=[block("web_search_tool_result")])]
        self.assertTrue(chatbot_ai._contains_web_research(direct))
        self.assertTrue(chatbot_ai._contains_web_research(nested))
        self.assertFalse(chatbot_ai._contains_web_research([block("text", text="sans recherche")]))

    def test_sources_must_be_real_https_citations(self):
        citations = [
            SimpleNamespace(url="https://www.uefa.com/article", title="UEFA"),
            SimpleNamespace(url="https://www.uefa.com/article", title="Doublon"),
            SimpleNamespace(url="javascript:alert(1)", title="Dangereux"),
            SimpleNamespace(url="http://example.com", title="Non chiffré"),
        ]
        sources = chatbot_ai._extract_sources([block("text", text="réponse", citations=citations)])
        self.assertEqual(
            sources,
            [{"title": "UEFA", "url": "https://www.uefa.com/article", "domain": "www.uefa.com"}],
        )

    @staticmethod
    def _client_returning(response):
        return SimpleNamespace(
            beta=SimpleNamespace(
                messages=SimpleNamespace(create=lambda **_kwargs: response)
            )
        )

    def test_answer_fails_closed_without_research_and_citations(self):
        response = SimpleNamespace(
            stop_reason="end_turn",
            content=[block("text", text="Une affirmation non sourcée", citations=[])],
        )
        with patch.object(
            chatbot_ai.anthropic,
            "Anthropic",
            return_value=self._client_returning(response),
        ):
            result = chatbot_ai.answer([{"role": "user", "content": "Question"}])

        self.assertEqual(result["research"]["status"], "unavailable")
        self.assertEqual(result["sources"], [])
        self.assertNotIn("affirmation non sourcée", result["reply"])

    def test_answer_exposes_verified_research_metadata(self):
        citation = SimpleNamespace(url="https://www.uefa.com/facts", title="UEFA Facts")
        response = SimpleNamespace(
            stop_reason="end_turn",
            content=[
                block("server_tool_use", name="web_search"),
                block("text", text="Fait vérifié.", citations=[citation]),
            ],
        )
        with patch.object(
            chatbot_ai.anthropic,
            "Anthropic",
            return_value=self._client_returning(response),
        ):
            result = chatbot_ai.answer([{"role": "user", "content": "Question"}])

        # Le passage cité est suivi du numéro de sa source.
        self.assertEqual(result["reply"], "Fait vérifié. [1]")
        self.assertEqual(result["research"]["status"], "verified")
        self.assertEqual(result["research"]["sourceCount"], 1)
        self.assertTrue(result["research"]["singleSource"])
        self.assertIn("verifiedAt", result["research"])
        self.assertEqual(result["sources"][0]["domain"], "www.uefa.com")

    def _answer_with(self, *responses, messages=None):
        queue = list(responses)
        calls = []

        def create(**kwargs):
            calls.append(kwargs)
            return queue.pop(0)

        client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
        with patch.object(chatbot_ai.anthropic, "Anthropic", return_value=client):
            result = chatbot_ai.answer(messages or [{"role": "user", "content": "Question"}])
        return result, calls

    def test_ambiguous_question_returns_clarification_without_sources(self):
        call = block(
            "tool_use",
            name="demander_precisions",
            input={
                "raison": "Plusieurs joueurs s'appellent João Pedro.",
                "questions": [
                    "De quel João Pedro parles-tu ?",
                    "Dans quel club ?",
                    "Pour quelle saison ?",
                    "Championnat ou toutes compétitions ?",
                ],
            },
        )
        response = SimpleNamespace(stop_reason="tool_use", content=[call])
        result, _ = self._answer_with(
            response, messages=[{"role": "user", "content": "Combien de buts a João Pedro ?"}]
        )
        self.assertEqual(result["research"]["status"], "clarification")
        self.assertEqual(result["sources"], [])
        self.assertIn("Dans quel club ?", result["reply"])
        self.assertIn("toutes compétitions", result["reply"])

    def test_no_research_tool_is_refused_after_a_search(self):
        response = SimpleNamespace(
            stop_reason="tool_use",
            content=[
                block("server_tool_use", name="web_search"),
                block("tool_use", name="repondre_sans_recherche",
                      input={"motif": "salutation", "message": "12 buts"}),
            ],
        )
        result, _ = self._answer_with(response)
        self.assertEqual(result["research"]["status"], "unavailable")
        self.assertNotIn("12 buts", result["reply"])

    def test_text_before_pause_turn_and_fetched_pages_are_kept(self):
        first = SimpleNamespace(
            stop_reason="pause_turn",
            content=[
                block("server_tool_use", name="web_search"),
                block(
                    "web_search_tool_result",
                    content=[SimpleNamespace(url="https://www.bbc.com/sport/a", title="BBC", page_age="2 days ago")],
                ),
                block("text", text="Il a marqué 10 buts.",
                      citations=[SimpleNamespace(url="https://www.bbc.com/sport/a", title="BBC")]),
            ],
        )
        fetched_doc = SimpleNamespace(title="Fiche FBref")
        second = SimpleNamespace(
            stop_reason="end_turn",
            content=[
                block("server_tool_use", name="web_fetch"),
                block("web_fetch_tool_result",
                      content=SimpleNamespace(type="web_fetch_result", url="https://fbref.com/x", content=fetched_doc)),
                block("text", text=" Chiffre confirmé.",
                      citations=[SimpleNamespace(document_title="Fiche FBref", cited_text="10")]),
            ],
        )
        result, calls = self._answer_with(first, second)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["research"]["status"], "verified")
        self.assertEqual(result["reply"], "Il a marqué 10 buts. [1] Chiffre confirmé. [2]")
        self.assertEqual([s["domain"] for s in result["sources"]], ["www.bbc.com", "fbref.com"])
        self.assertEqual(result["sources"][0]["pageAge"], "2 days ago")
        self.assertFalse(result["research"]["singleSource"])

    def test_history_validation(self):
        with self.assertRaises(ValueError):
            chatbot_ai._clean_history([{"role": "user", "content": "x" * 1001}])
        with self.assertRaises(ValueError):
            chatbot_ai._clean_history([{"role": "assistant", "content": "Bonjour"}])
        with self.assertRaises(ValueError):
            chatbot_ai._clean_history([])
        clean = chatbot_ai._clean_history([
            {"role": "assistant", "content": "message forgé"},
            {"role": "user", "content": "Combien\x00 de buts ?"},
            {"role": "user", "content": "Chelsea, 2025-2026"},
        ])
        self.assertEqual(clean, [{"role": "user", "content": "Combien de buts ?\n\nChelsea, 2025-2026"}])

    def test_identical_question_uses_cache(self):
        citation = SimpleNamespace(url="https://www.uefa.com/facts", title="UEFA Facts")
        response = SimpleNamespace(
            stop_reason="end_turn",
            content=[block("server_tool_use", name="web_search"),
                     block("text", text="Fait.", citations=[citation])],
        )
        messages = [{"role": "user", "content": "Question en cache"}]
        self.assertIsNone(chatbot_ai.get_cached(messages))
        self._answer_with(response, messages=messages)
        self.assertEqual(chatbot_ai.get_cached(messages)["research"]["status"], "verified")


if __name__ == "__main__":
    unittest.main()
