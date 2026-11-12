from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from api import index as api


@pytest.fixture(autouse=True)
def reset_runtime_state(monkeypatch):
    api._model_cache.clear()
    api._model_cooldowns.clear()
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_MODELS", raising=False)
    monkeypatch.delenv("GEMINI_MODELS", raising=False)
    monkeypatch.delenv("AI_PROVIDER_ORDER", raising=False)


def test_title_and_phrase_match_rank_first():
    articles = [
        {
            "title": "General marketing guide",
            "url": "https://www.e-marketingreviews.com/general",
            "content": "Keyword research appears many times. Keyword research basics.",
        },
        {
            "title": "Keyword research tools compared",
            "url": "https://www.e-marketingreviews.com/keyword-tools",
            "content": "A focused comparison of tools for SEO teams.",
        },
    ]
    result = api.search_relevant_context("keyword research tools", articles)
    assert result[0]["url"].endswith("keyword-tools")


def test_boilerplate_pages_excluded_from_general_queries():
    articles = [
        {
            "title": "Privacy Policy",
            "url": "https://www.e-marketingreviews.com/p/privacy-policy.html",
            "content": "Marketing SEO tools privacy policy and cookies.",
        },
        {
            "title": "Best AI SEO Tools",
            "url": "https://www.e-marketingreviews.com/2026/06/best-ai-marketing-tools-2026.html",
            "content": "Comprehensive review of AI SEO tools for agencies.",
        },
    ]
    result = api.search_relevant_context("AI SEO tools", articles)
    assert len(result) == 1
    assert "privacy-policy" not in result[0]["url"]


def test_page_context_prioritized_on_summarize_request():
    articles = [
        {
            "title": "Vector SEO Guide",
            "url": "https://www.e-marketingreviews.com/2026/06/vector-seo.html",
            "content": "Embeddings and semantic search for modern SEO.",
        },
        {
            "title": "Generative Commerce",
            "url": "https://www.e-marketingreviews.com/2026/09/generative-commerce.html",
            "content": "How brands win with AI buying agents in digital commerce.",
        },
    ]
    page_ctx = api.PageContext(
        url="https://www.e-marketingreviews.com/2026/09/generative-commerce.html",
        title="Generative Commerce: How Brands Win With AI Buying Agents",
        excerpt="Commerce is shifting from B2C to A2A with autonomous buying agents.",
        category="AI Marketing",
    )
    result = api.search_relevant_context(
        "Summarize this page", articles, page_context=page_ctx
    )
    assert result[0]["url"].endswith("generative-commerce.html")
    context_text, sources = api._build_grounding(
        result, "Summarize this page", page_context=page_ctx
    )
    assert "CURRENT PAGE VIEWED BY USER:" in context_text
    assert sources[0].url.endswith("generative-commerce.html")


def test_raw_provider_errors_are_not_returned(monkeypatch):
    client = TestClient(api.app)
    response = client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 503
    body = response.json()
    assert "briefly unavailable" in body["detail"]
    assert "GROQ_API_KEY" not in response.text
    assert "Provider Errors" not in response.text


def test_decommissioned_groq_model_falls_through(monkeypatch):
    calls = []

    class FakeModels:
        def list(self):
            return SimpleNamespace(
                data=[
                    SimpleNamespace(id="retired-model"),
                    SimpleNamespace(id="openai/gpt-oss-20b"),
                ]
            )

    class FakeCompletions:
        def create(self, **kwargs):
            model = kwargs["model"]
            calls.append(model)
            if model == "retired-model":
                raise RuntimeError("model_decommissioned: no longer supported")
            message = SimpleNamespace(content="A working answer")
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    class FakeGroqClient:
        def __init__(self, **kwargs):
            self.models = FakeModels()
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(api, "Groq", FakeGroqClient)
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("AI_PROVIDER_ORDER", "groq")
    monkeypatch.setenv("GROQ_MODELS", "retired-model,openai/gpt-oss-20b")

    reply, _ = api.generate_ai_response("Which tool is best?", [], request_id="test")
    assert reply == "A working answer"
    assert calls == ["retired-model", "openai/gpt-oss-20b"]


def test_unavailable_gemini_model_falls_through(monkeypatch):
    calls = []

    class FakeGoogleModels:
        def list(self):
            return [
                SimpleNamespace(
                    name="models/gemini-retired",
                    supported_actions=["generateContent"],
                ),
                SimpleNamespace(
                    name="models/gemini-3.6-flash",
                    supported_actions=["generateContent"],
                ),
            ]

        def generate_content(self, **kwargs):
            model = kwargs["model"]
            calls.append(model)
            if model == "gemini-retired":
                raise RuntimeError("This model is no longer available")
            return SimpleNamespace(text="Gemini fallback answer")

    class FakeGoogleClient:
        def __init__(self, **kwargs):
            self.models = FakeGoogleModels()

        def close(self):
            pass

    fake_types = SimpleNamespace(
        HttpOptions=lambda **kwargs: kwargs,
        GenerateContentConfig=lambda **kwargs: kwargs,
    )
    monkeypatch.setattr(api, "genai", SimpleNamespace(Client=FakeGoogleClient))
    monkeypatch.setattr(api, "genai_types", fake_types)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("AI_PROVIDER_ORDER", "gemini")
    monkeypatch.setenv("GEMINI_MODELS", "gemini-retired,gemini-3.6-flash")

    reply, _ = api.generate_ai_response("Help me choose", [], request_id="test")
    assert reply == "Gemini fallback answer"
    assert calls == ["gemini-retired", "gemini-3.6-flash"]
