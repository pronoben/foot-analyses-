import unittest
from types import SimpleNamespace
from unittest.mock import patch

import chatbot_ai


def block(block_type, **values):
    return SimpleNamespace(type=block_type, **values)


class ResearchValidationTests(unittest.TestCase):
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

        self.assertEqual(result["reply"], "Fait vérifié.")
        self.assertEqual(result["research"]["status"], "verified")
        self.assertEqual(result["research"]["sourceCount"], 1)
        self.assertEqual(result["sources"][0]["domain"], "www.uefa.com")


if __name__ == "__main__":
    unittest.main()
