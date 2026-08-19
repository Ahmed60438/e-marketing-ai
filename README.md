# e-MarketingReviews AI Assistant

A Blogger-friendly AI assistant backed by FastAPI, Groq, Gemini, and a local knowledge base built from e-MarketingReviews articles.

## What changed in v3

- Discovers active provider models at runtime and caches the result.
- Uses current production fallback preferences for Groq and Gemini.
- Temporarily removes retired or unavailable models from rotation instead of retrying them on every message.
- Fails over between providers without exposing raw provider errors to visitors.
- Includes recent conversation history and improved source ranking.
- Validates article URLs and treats crawled content as untrusted reference material.
- Ships a responsive, accessible Shadow DOM widget that cannot disturb Blogger theme CSS.
- Adds friendly timeout, rate-limit, and service-unavailable states.
- Rebuilds the knowledge base atomically and respects robots.txt.

## Environment variables

Create environment variables in Vercel using `.env.example` as a guide. At least one of `GROQ_API_KEY` or `GEMINI_API_KEY` is required. Configure both for reliable failover.

The model lists are preferences, not a brittle hard-coded dependency. The API asks each provider for the models available to the configured account, intersects that result with the preferred list, and can use another suitable active text model when necessary.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
uvicorn api.index:app --reload
```

Useful endpoints:

- `GET /api/health` checks configuration and knowledge-base availability.
- `POST /api/chat` accepts `message` plus up to eight recent `history` items.
- `GET /widget.js` serves the embeddable assistant.

Example request:

```json
{
  "message": "Compare AI tools for keyword research",
  "history": [
    {"role": "user", "content": "I run a small content site"},
    {"role": "assistant", "content": "What is your main SEO goal?"}
  ]
}
```

## Blogger installation

Deploy the project to Vercel, confirm that `/api/health` works, then paste the contents of `blogger-snippet.html` immediately before the closing `</body>` tag in the Blogger theme. Change the Vercel hostname in that snippet if the project URL is different.

## Knowledge base

Run `python scraper.py` to refresh `data/knowledge_base.json`. The GitHub Actions workflow runs this daily, commits only real changes, and preserves the previous database if crawling returns no documents.

## Tests

```bash
python -m pytest -q
node --check public/widget.js
```
