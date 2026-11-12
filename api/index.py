from __future__ import annotations

import json
import logging
import math
import os
import re
import threading
import time
import uuid
from collections import Counter
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    from groq import Groq
except ImportError:  # The API can still run with Gemini only.
    Groq = None

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # The API can still run with Groq only.
    genai = None
    genai_types = None


APP_VERSION = "4.2.0"
SITE_HOSTS = {"e-marketingreviews.com", "www.e-marketingreviews.com"}
KNOWLEDGE_BASE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "knowledge_base.json"
)
MODEL_CACHE_TTL_SECONDS = 15 * 60
PERMANENT_MODEL_COOLDOWN_SECONDS = 6 * 60 * 60
TRANSIENT_MODEL_COOLDOWN_SECONDS = 45
MAX_MODELS_PER_PROVIDER = 3
MAX_CONTEXT_ARTICLES = 5
MAX_CONTEXT_CHARS_PER_ARTICLE = 1_600

logger = logging.getLogger("e-marketing-ai")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


def _csv_env(name: str, default: Sequence[str]) -> List[str]:
    raw = os.getenv(name, "")
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values or list(default)


def _bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(value, maximum))


DEFAULT_GROQ_MODELS = (
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
)
DEFAULT_GEMINI_MODELS = (
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
)

BOILERPLATE_PATHS = (
    "/p/privacy-policy.html",
    "/p/terms-conditions.html",
    "/p/editorial-policy.html",
    "/p/contact-us.html",
    "/p/about-us.html",
)
BOILERPLATE_QUERY_HINTS = {
    "privacy", "policy", "terms", "conditions", "editorial",
    "contact", "about", "cookie", "gdpr", "legal", "author",
}
PAGE_SUMMARY_PATTERNS = re.compile(
    r"\b(summarize\s+this\s+(page|article|post|guide)|what\s+is\s+this\s+(page|article|post)\s+about|"
    r"key\s+takeaways\s+(from|of)\s+this\s+(page|article)|tl;?dr|"
    r"action\s+steps\s+from\s+this\s+article|discussed\s+on\s+this\s+page|"
    r"checklist\s+from\s+this\s+article)\b|"
    r"(لخص|تلخيص|ملخص|اشرح)\s*(هذه\s+الصفحة|هذا\s+المقال|المقال|الصفحة)?",
    re.IGNORECASE,
)
GREETING_PATTERNS = re.compile(
    r"^\s*(hi|hello|hey|good\s+(morning|afternoon|evening)|thanks|thank\s+you|"
    r"مرحبا|أهلا|اهلا|السلام\s+عليكم|صباح\s+الخير|مساء\s+الخير|شكرا|شكراً|كيف\s+حالك)\s*[!?.،؟]*\s*$",
    re.IGNORECASE,
)
THINK_BLOCK_RE = re.compile(r"<think>[\s\S]*?</think>", re.IGNORECASE)
FOLLOWUP_LINE_RE = re.compile(
    r"^(?:FOLLOW_UPS|SUGGESTED_QUESTIONS|أسئلة_مقترحة)\s*:\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)


def _allowed_origins() -> List[str]:
    return _csv_env(
        "ALLOWED_ORIGINS",
        (
            "https://www.e-marketingreviews.com",
            "https://e-marketingreviews.com",
        ),
    )


app = FastAPI(
    title="e-MarketingReviews AI Engine",
    description="Resilient multi-provider assistant with grounded website search and live page context.",
    version=APP_VERSION,
    docs_url=None,
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
    max_age=86_400,
)


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4_000)


class LiveArticleItem(BaseModel):
    title: str = Field(default="", max_length=300)
    url: str = Field(default="", max_length=500)
    summary: str = Field(default="", max_length=1_200)


class PageContext(BaseModel):
    url: str = Field(default="", max_length=500)
    title: str = Field(default="", max_length=300)
    excerpt: str = Field(default="", max_length=6_000)
    category: str = Field(default="", max_length=120)
    headings: List[str] = Field(default_factory=list)
    recent_posts: List[LiveArticleItem] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4_000)
    history: List[ConversationMessage] = Field(default_factory=list)
    page_context: Optional[PageContext] = None


class ArticleSource(BaseModel):
    title: str
    url: str


class ChatResponse(BaseModel):
    reply: str
    sources: List[ArticleSource]
    follow_ups: List[str] = Field(default_factory=list)


class AIServiceUnavailable(RuntimeError):
    """Raised after every configured provider has failed."""


_knowledge_cache: Optional[List[Dict[str, str]]] = None
_model_cache: Dict[str, Tuple[float, List[str]]] = {}
_model_cooldowns: Dict[Tuple[str, str], float] = {}
_state_lock = threading.Lock()


STOP_WORDS = {
    "a", "about", "an", "and", "are", "as", "at", "be", "best", "by",
    "can", "do", "does", "for", "from", "how", "i", "in", "is", "it",
    "me", "my", "of", "on", "or", "our", "page", "please", "summarize",
    "tell", "that", "the", "this", "to", "tool", "using", "what", "when",
    "where", "which", "with", "you", "your",
}
TOKEN_RE = re.compile(r"[\w][\w+.'-]*", re.UNICODE)


def _stem_token(token: str) -> str:
    if len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("ing") and len(token) > 5:
        return token[:-3]
    if token.endswith("ed") and len(token) > 4:
        return token[:-2]
    if token.endswith("es") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and not token.endswith("ss") and len(token) > 3:
        return token[:-1]
    return token


def load_knowledge_base() -> List[Dict[str, str]]:
    """Load, validate, and cache the website knowledge base."""
    global _knowledge_cache
    if _knowledge_cache is not None:
        return _knowledge_cache

    paths = (
        KNOWLEDGE_BASE_PATH,
        os.path.join(os.getcwd(), "data", "knowledge_base.json"),
        os.path.join(os.path.dirname(__file__), "knowledge_base.json"),
    )
    for path in paths:
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as handle:
                raw_items = json.load(handle)
            if not isinstance(raw_items, list):
                raise ValueError("knowledge base root must be a list")

            cleaned: List[Dict[str, str]] = []
            for item in raw_items:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                url = str(item.get("url", "")).strip()
                content = str(item.get("content", "")).strip()
                if title and content and _is_safe_source_url(url):
                    cleaned.append({"title": title, "url": url, "content": content})
            _knowledge_cache = cleaned
            logger.info("Knowledge base loaded with %d valid documents", len(cleaned))
            return cleaned
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            logger.error("Could not load knowledge base: %s", exc.__class__.__name__)

    logger.warning("No valid knowledge base was found")
    _knowledge_cache = []
    return _knowledge_cache


def _is_safe_source_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in {"http", "https"} and parsed.hostname in SITE_HOSTS
    except ValueError:
        return False


def _normalise(text: str) -> str:
    return " ".join(TOKEN_RE.findall(text.casefold()))


def _query_terms(query: str) -> List[str]:
    tokens = [token for token in TOKEN_RE.findall(query.casefold()) if len(token) > 1]
    useful = [token for token in tokens if token not in STOP_WORDS]
    base_terms = list(dict.fromkeys(useful or tokens))[:16]
    expanded: List[str] = []
    for term in base_terms:
        expanded.append(term)
        stemmed = _stem_token(term)
        if stemmed != term and len(stemmed) > 2:
            expanded.append(stemmed)
    return list(dict.fromkeys(expanded))[:20]


def _is_boilerplate_url(url: str) -> bool:
    lower = url.casefold()
    return any(part in lower for part in BOILERPLATE_PATHS)


def _merge_live_posts(
    articles: List[Dict[str, Any]], page_context: Optional[PageContext]
) -> List[Dict[str, Any]]:
    if not page_context or not page_context.recent_posts:
        return articles
    merged = list(articles)
    existing_urls = {str(a.get("url", "")).rstrip("/") for a in merged}
    for post in page_context.recent_posts:
        u = post.url.strip()
        t = post.title.strip()
        s = post.summary.strip()
        if t and u and _is_safe_source_url(u) and u.rstrip("/") not in existing_urls:
            merged.insert(0, {"title": t, "url": u, "content": s or t})
            existing_urls.add(u.rstrip("/"))
    return merged


def search_relevant_context(
    query: str,
    articles: List[Dict[str, Any]],
    top_k: int = MAX_CONTEXT_ARTICLES,
    history: Optional[Sequence[ConversationMessage]] = None,
    page_context: Optional[PageContext] = None,
) -> List[Dict[str, Any]]:
    """Rank local and live articles using phrase, coverage, stem, title, and context signals."""
    effective_query = query.strip()
    if GREETING_PATTERNS.match(effective_query):
        return []

    combined_articles = _merge_live_posts(articles, page_context)

    if page_context and PAGE_SUMMARY_PATTERNS.search(effective_query):
        if page_context.title:
            effective_query = f"{page_context.title} {page_context.category}".strip()
    elif history and len(effective_query.split()) <= 5:
        recent_user = [m.content for m in history[-4:] if m.role == "user"]
        if recent_user:
            effective_query = f"{recent_user[-1]} {effective_query}"

    terms = _query_terms(effective_query)
    if not terms or not combined_articles:
        return []

    wants_boilerplate = any(t in BOILERPLATE_QUERY_HINTS for t in terms)
    phrase = _normalise(query)
    page_url_clean = (
        page_context.url.strip().rstrip("/")
        if page_context and page_context.url
        else ""
    )
    scored: List[Tuple[float, int, Dict[str, Any]]] = []

    for index, article in enumerate(combined_articles):
        title = str(article.get("title", ""))
        content = str(article.get("content", ""))
        url = str(article.get("url", ""))
        if not title or not content:
            continue

        if _is_boilerplate_url(url) and not wants_boilerplate:
            continue

        raw_title_tokens = TOKEN_RE.findall(title.casefold())
        raw_content_tokens = TOKEN_RE.findall(content.casefold())
        title_tokens = Counter(raw_title_tokens)
        content_tokens = Counter(raw_content_tokens)
        for tok in raw_title_tokens:
            st = _stem_token(tok)
            if st != tok:
                title_tokens[st] += 1
        for tok in raw_content_tokens:
            st = _stem_token(tok)
            if st != tok:
                content_tokens[st] += 1

        title_norm = _normalise(title)
        content_norm = _normalise(content)
        matched = 0
        score = 0.0

        for term in terms:
            title_count = title_tokens.get(term, 0)
            content_count = content_tokens.get(term, 0)
            if title_count or content_count:
                matched += 1
            score += min(title_count, 3) * 12.0
            score += math.log1p(content_count) * 3.5

        if page_url_clean and url.rstrip("/") == page_url_clean:
            score += 45.0
            matched = max(matched, 1)

        if matched == 0:
            continue

        score += (matched / len(terms)) * 18.0
        if len(phrase) >= 5 and phrase in title_norm:
            score += 32.0
        elif len(phrase) >= 5 and phrase in content_norm:
            score += 10.0

        if url.rstrip("/") in {
            "https://www.e-marketingreviews.com",
            "https://e-marketingreviews.com",
        }:
            score -= 6.0

        scored.append((score, -index, article))

    scored.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [article for _, _, article in scored[: max(1, min(top_k, 8))]]


def _contextual_snippet(content: str, terms: Sequence[str]) -> str:
    compact = re.sub(r"\s+", " ", content).strip()
    lower = compact.casefold()
    positions = [lower.find(term) for term in terms if lower.find(term) >= 0]
    pivot = min(positions) if positions else 0
    start = max(0, pivot - 220)
    end = min(len(compact), start + MAX_CONTEXT_CHARS_PER_ARTICLE)
    snippet = compact[start:end]
    if start:
        snippet = "…" + snippet
    if end < len(compact):
        snippet += "…"
    return snippet


def _build_grounding(
    articles: List[Dict[str, Any]],
    query: str,
    page_context: Optional[PageContext] = None,
) -> Tuple[str, List[ArticleSource]]:
    is_greeting = bool(GREETING_PATTERNS.match(query.strip()))
    terms = _query_terms(query)
    blocks: List[str] = []
    sources: List[ArticleSource] = []
    seen_urls = set()

    if page_context and page_context.title and (page_context.excerpt or page_context.url):
        clean_page_url = page_context.url.strip()
        safe_page_url = clean_page_url if _is_safe_source_url(clean_page_url) else ""
        excerpt = re.sub(r"\s+", " ", page_context.excerpt).strip()[:2_800]
        headings_str = (
            " | ".join(h.strip() for h in page_context.headings[:12] if h.strip())
            if page_context.headings
            else ""
        )
        if excerpt or safe_page_url:
            blocks.append(
                f"ACTIVE PAGE CURRENTLY OPEN IN USER'S BROWSER:\n"
                f"TITLE: {page_context.title.strip()}\n"
                f"URL: {safe_page_url or 'https://www.e-marketingreviews.com/'}\n"
                f"CATEGORY: {page_context.category.strip() or 'Digital Marketing & SEO'}\n"
                + (f"HEADINGS: {headings_str}\n" if headings_str else "")
                + f"PAGE CONTENT: {excerpt or 'Homepage overview'}"
            )
            if (
                not is_greeting
                and PAGE_SUMMARY_PATTERNS.search(query)
                and safe_page_url
                and safe_page_url.rstrip("/")
                not in {
                    "https://www.e-marketingreviews.com",
                    "https://e-marketingreviews.com",
                }
            ):
                seen_urls.add(safe_page_url)
                sources.append(
                    ArticleSource(title=page_context.title.strip(), url=safe_page_url)
                )

    if page_context and page_context.recent_posts and not is_greeting:
        catalog_lines = []
        for post in page_context.recent_posts[:10]:
            if post.title and _is_safe_source_url(post.url):
                catalog_lines.append(f"- {post.title.strip()} ({post.url.strip()})")
        if catalog_lines:
            blocks.append(
                "LATEST PUBLISHED ARTICLES ON E-MARKETING REVIEWS:\n"
                + "\n".join(catalog_lines)
            )

    if not is_greeting:
        for article in articles[:MAX_CONTEXT_ARTICLES]:
            title = str(article.get("title", "Untitled")).strip()
            url = str(article.get("url", "")).strip()
            if not _is_safe_source_url(url) or url in seen_urls:
                continue
            seen_urls.add(url)
            snippet = _contextual_snippet(str(article.get("content", "")), terms)
            blocks.append(f"SOURCE: {title}\nURL: {url}\nEXCERPT: {snippet}")
            sources.append(ArticleSource(title=title, url=url))

    return "\n\n".join(blocks), sources[:4]


def _system_prompt(context: str) -> str:
    return f"""You are the official **e-marketing reviews AI Copilot**, the embedded intelligence engine for https://www.e-marketingreviews.com/ specializing in SEO, Generative Engine Optimization (GEO/AEO), AI marketing tools, keyword clustering, and growth strategy.

Strict Formatting & Readability Rules (CRITICAL for compact chat UI):
1. **NO Markdown Tables (`| ... |`)**: NEVER use pipe tables (`| col | col |`). Because the chat window is compact, tables squeeze text vertically. Always present tool comparisons, feature breakdowns, or checklists as clean **numbered or bulleted sections**:
   - Example format for comparing tools or strategies:
     ### 1. Tool / Strategy Name
     - **Best for:** ...
     - **Core strengths:** ...
     - **Key limitation:** ...
2. **Language Matching**: Reply in the exact language of the user's message (natural, fluent Arabic if the user writes in Arabic; crisp, authoritative English if in English).
3. **Direct, High-Value Answers**:
   - Start immediately with the answer. Never write meta-disclaimers like "Based on the provided sources" or "The website sources do not mention".
   - Keep paragraphs short (2-3 sentences max) and use **bold** lead-ins on bullet points for easy scanning.
4. **Deep Website Integration**:
   - You have access to `ACTIVE PAGE CURRENTLY OPEN IN USER'S BROWSER`, `LATEST PUBLISHED ARTICLES ON E-MARKETING REVIEWS`, and `SOURCE` excerpts below.
   - When the user asks about "this page", "this article", or clicks summarize/checklist/compare, use the `ACTIVE PAGE` content directly and thoroughly.
   - Reference relevant guides from `e-marketing reviews` naturally when helpful, and never invent fake URLs or fake pricing.
5. **Follow-up Suggestions**:
   - At the very end of your response, add a single line starting with `FOLLOW_UPS:` followed by 3 concise follow-up questions separated by `|` in the same language as your reply (each under 42 characters).

WEBSITE CONTEXT & KNOWLEDGE BASE:
{context or "No specific article excerpt matched; answer as the senior SEO & AI marketing strategist for e-marketing reviews."}
"""


def _convert_markdown_tables_to_cards(text: str) -> str:
    """Convert any markdown pipe table into clean bulleted blocks so it never squeezes in narrow chat bubbles."""
    lines = text.splitlines()
    out: List[str] = []
    table_buf: List[str] = []

    def flush_table_buf() -> None:
        if not table_buf:
            return
        parsed_rows: List[List[str]] = []
        for raw_row in table_buf:
            cells = [c.strip() for c in raw_row.strip().strip("|").split("|")]
            if not cells or all(re.match(r"^[:\-\s]+$", c) for c in cells):
                continue
            parsed_rows.append(cells)
        if len(parsed_rows) >= 2:
            headers = parsed_rows[0]
            for row in parsed_rows[1:]:
                if not any(row):
                    continue
                title_cell = row[0] if row else "Item"
                out.append(f"### {title_cell}")
                for idx in range(1, len(row)):
                    val = row[idx].strip()
                    if not val:
                        continue
                    col_name = headers[idx].strip() if idx < len(headers) else f"Detail {idx}"
                    out.append(f"- **{col_name}:** {val}")
                out.append("")
        else:
            out.extend(table_buf)
        table_buf.clear()

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2:
            table_buf.append(stripped)
        else:
            flush_table_buf()
            out.append(line)
    flush_table_buf()
    return "\n".join(out).strip()


def _extract_dynamic_topics(text: str, user_query: str) -> List[str]:
    candidates: List[str] = []
    generic_skip = {
        "executive summary", "key takeaways", "action steps", "practical action steps",
        "overview", "summary", "conclusion", "introduction", "pros", "cons",
        "best for", "pricing", "key features", "main takeaways", "next steps",
        "recommended reading", "sources", "item", "detail 1", "detail 2", "detail 3",
        "ملخص تنفيذي", "أهم النقاط", "خطوات عملية", "الخلاصة", "مقدمة", "المميزات", "العيوب",
    }
    for m in re.finditer(r"^#{1,4}\s+(.+)$", text, flags=re.MULTILINE):
        h = re.sub(r"[*`#_~]", "", m.group(1)).strip(" :-•")
        if 4 <= len(h) <= 48 and h.lower() not in generic_skip and h not in candidates:
            candidates.append(h)
    for m in re.finditer(r"\*\*([^*]{4,44})\*\*", text):
        b = m.group(1).strip(" :-•.")
        if 4 <= len(b) <= 44 and b.lower() not in generic_skip and b not in candidates:
            candidates.append(b)
    q_clean = re.sub(
        r"^(what\s+is|what\s+are|how\s+to|how\s+do\s+i|how\s+does|can\s+you|explain|compare|summarize|ما\s+هو|ما\s+هي|كيف\s+يمكنني|كيف|اشرح|قارن|لخص)\s+",
        "",
        user_query.strip(),
        flags=re.IGNORECASE,
    ).strip(" ?!؟.")
    if 4 <= len(q_clean) <= 50 and q_clean not in candidates:
        candidates.append(q_clean)
    return candidates[:6]


def _clean_and_extract_followups(raw_text: str, user_query: str) -> Tuple[str, List[str]]:
    cleaned = THINK_BLOCK_RE.sub("", raw_text or "").strip()
    follow_ups: List[str] = []

    match = FOLLOWUP_LINE_RE.search(cleaned)
    if match:
        raw_items = match.group(1).split("|")
        for item in raw_items:
            q = item.strip().strip("-•*\"'` ")
            if 6 <= len(q) <= 85 and q not in follow_ups:
                follow_ups.append(q)
        cleaned = FOLLOWUP_LINE_RE.sub("", cleaned).strip()

    cleaned = _convert_markdown_tables_to_cards(cleaned)

    if len(follow_ups) < 3:
        is_arabic = bool(re.search(r"[\u0600-\u06FF]", user_query + " " + cleaned))
        topics = _extract_dynamic_topics(cleaned, user_query)
        if is_arabic:
            templates = [
                lambda t: f"كيف أطبق {t} عملياً خطوة بخطوة؟",
                lambda t: f"ما أشهر الأخطاء عند تطبيق {t} وكيف أتجنبها؟",
                lambda t: f"ما أفضل الأدوات لقياس وتحسين {t}؟",
            ]
        else:
            templates = [
                lambda t: f"How do I implement {t} step by step?",
                lambda t: f"What common mistakes should I avoid with {t}?",
                lambda t: f"Which metrics or tools best measure {t}?",
            ]
        for idx, topic in enumerate(topics):
            if len(follow_ups) >= 3:
                break
            candidate = templates[idx % len(templates)](topic)
            if candidate not in follow_ups:
                follow_ups.append(candidate)

    return cleaned, follow_ups[:3]


def _conversation_messages(
    system_prompt: str, history: Sequence[ConversationMessage], user_query: str
) -> List[Dict[str, str]]:
    messages = [{"role": "system", "content": system_prompt}]
    for item in history[-8:]:
        content = item.content.strip()
        if content:
            messages.append({"role": item.role, "content": content})
    messages.append({"role": "user", "content": user_query})
    return messages


def _gemini_transcript(history: Sequence[ConversationMessage], user_query: str) -> str:
    lines = ["RECENT CONVERSATION:"]
    for item in history[-8:]:
        label = "USER" if item.role == "user" else "ASSISTANT"
        lines.append(f"{label}: {item.content.strip()}")
    lines.append(f"USER: {user_query}")
    return "\n".join(lines)


def _cached_models(provider: str) -> Optional[List[str]]:
    with _state_lock:
        cached = _model_cache.get(provider)
        if cached and time.monotonic() - cached[0] < MODEL_CACHE_TTL_SECONDS:
            return list(cached[1])
    return None


def _store_models(provider: str, models: Sequence[str]) -> List[str]:
    unique = list(dict.fromkeys(model for model in models if model))
    with _state_lock:
        _model_cache[provider] = (time.monotonic(), unique)
    return unique


def _is_model_ready(provider: str, model: str) -> bool:
    with _state_lock:
        return _model_cooldowns.get((provider, model), 0) <= time.monotonic()


def _cool_down_model(provider: str, model: str, permanent: bool) -> None:
    duration = (
        PERMANENT_MODEL_COOLDOWN_SECONDS
        if permanent
        else TRANSIENT_MODEL_COOLDOWN_SECONDS
    )
    with _state_lock:
        _model_cooldowns[(provider, model)] = time.monotonic() + duration


def _is_general_text_model(model: str) -> bool:
    value = model.casefold()
    excluded = (
        "whisper", "guard", "safety", "moderation", "embed", "image", "tts",
        "audio", "live", "orpheus", "prompt-guard", "vision", "allam", "compound",
        "aqa", "imagen", "veo", "learnlm",
    )
    return not any(token in value for token in excluded)


def _select_available(preferred: Sequence[str], available: Sequence[str]) -> List[str]:
    available_set = set(available)
    ordered = [model for model in preferred if model in available_set]
    ordered.extend(
        sorted(
            model
            for model in available_set
            if model not in ordered and _is_general_text_model(model)
        )
    )
    return list(dict.fromkeys(ordered))[:6]


def _discover_groq_models(client: Any) -> List[str]:
    cached = _cached_models("groq")
    if cached is not None:
        return cached
    preferred = _csv_env("GROQ_MODELS", DEFAULT_GROQ_MODELS)
    try:
        response = client.models.list()
        available = [str(item.id) for item in getattr(response, "data", []) if item.id]
        selected = _select_available(preferred, available)
        if selected:
            return _store_models("groq", selected)
    except Exception as exc:
        logger.warning("Groq model discovery failed: %s", exc.__class__.__name__)
    return _store_models("groq", preferred)


def _discover_gemini_models(client: Any) -> List[str]:
    cached = _cached_models("gemini")
    if cached is not None:
        return cached
    preferred = _csv_env("GEMINI_MODELS", DEFAULT_GEMINI_MODELS)
    try:
        available: List[str] = []
        for item in client.models.list():
            name = str(getattr(item, "name", "")).removeprefix("models/")
            actions = (
                getattr(item, "supported_actions", None)
                or getattr(item, "supported_generation_methods", None)
                or []
            )
            actions_text = {str(action).casefold() for action in actions}
            supports_generate = not actions_text or any(
                "generatecontent" in action.replace("_", "") for action in actions_text
            )
            if name.startswith("gemini-") and supports_generate and _is_general_text_model(name):
                available.append(name)
        selected = _select_available(preferred, available)
        if selected:
            return _store_models("gemini", selected)
    except Exception as exc:
        logger.warning("Gemini model discovery failed: %s", exc.__class__.__name__)
    return _store_models("gemini", preferred)


def _status_code(exc: Exception) -> Optional[int]:
    for value in (
        getattr(exc, "status_code", None),
        getattr(getattr(exc, "response", None), "status_code", None),
        getattr(exc, "code", None),
    ):
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _permanent_model_error(exc: Exception) -> bool:
    message = str(exc).casefold()
    markers = (
        "model_decommissioned", "model_not_found", "does not exist",
        "no longer available", "no longer supported", "not found for api version",
        "not supported for generatecontent",
    )
    return any(marker in message for marker in markers)


def _safe_error_summary(exc: Exception) -> str:
    message = re.sub(
        r"(?i)(bearer\s+|api[_ -]?key[=: ]+)[^\s,'\"]+", r"\1[redacted]", str(exc)
    )
    message = re.sub(r"\s+", " ", message).strip()[:220]
    return f"{exc.__class__.__name__}: {message}"


def _try_groq(
    api_key: str,
    system_prompt: str,
    history: Sequence[ConversationMessage],
    user_query: str,
    request_id: str,
) -> str:
    if Groq is None:
        raise RuntimeError("Groq SDK is not installed")
    client = Groq(api_key=api_key, timeout=20.0, max_retries=1)
    models = _discover_groq_models(client)
    attempted = 0
    for model in models:
        if attempted >= MAX_MODELS_PER_PROVIDER or not _is_model_ready("groq", model):
            continue
        attempted += 1
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=_conversation_messages(system_prompt, history, user_query),
                temperature=0.35,
                max_completion_tokens=_bounded_int_env(
                    "AI_MAX_OUTPUT_TOKENS", 1_400, 256, 4_096
                ),
            )
            text = (completion.choices[0].message.content or "").strip()
            text = THINK_BLOCK_RE.sub("", text).strip()
            if not text:
                raise ValueError("provider returned an empty response")
            logger.info("request=%s provider=groq model=%s success", request_id, model)
            return text
        except Exception as exc:
            permanent = _permanent_model_error(exc)
            _cool_down_model("groq", model, permanent)
            logger.warning(
                "request=%s provider=groq model=%s failed: %s",
                request_id,
                model,
                _safe_error_summary(exc),
            )
            if _status_code(exc) in {401, 403, 429} and not permanent:
                break
    raise RuntimeError("Groq had no usable model")


def _try_gemini(
    api_key: str,
    system_prompt: str,
    history: Sequence[ConversationMessage],
    user_query: str,
    request_id: str,
) -> str:
    if genai is None or genai_types is None:
        raise RuntimeError("Google Gen AI SDK is not installed")
    client = genai.Client(
        api_key=api_key,
        http_options=genai_types.HttpOptions(timeout=20_000),
    )
    try:
        models = _discover_gemini_models(client)
        attempted = 0
        for model in models:
            if attempted >= MAX_MODELS_PER_PROVIDER or not _is_model_ready("gemini", model):
                continue
            attempted += 1
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=_gemini_transcript(history, user_query),
                    config=genai_types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.35,
                        max_output_tokens=_bounded_int_env(
                            "AI_MAX_OUTPUT_TOKENS", 1_400, 256, 4_096
                        ),
                    ),
                )
                text = (getattr(response, "text", "") or "").strip()
                text = THINK_BLOCK_RE.sub("", text).strip()
                if not text:
                    raise ValueError("provider returned an empty response")
                logger.info("request=%s provider=gemini model=%s success", request_id, model)
                return text
            except Exception as exc:
                permanent = _permanent_model_error(exc)
                _cool_down_model("gemini", model, permanent)
                logger.warning(
                    "request=%s provider=gemini model=%s failed: %s",
                    request_id,
                    model,
                    _safe_error_summary(exc),
                )
                if _status_code(exc) in {401, 403, 429} and not permanent:
                    break
    finally:
        try:
            client.close()
        except Exception:
            pass
    raise RuntimeError("Gemini had no usable model")


def generate_ai_response(
    user_query: str,
    context_articles: List[Dict[str, Any]],
    history: Optional[Sequence[ConversationMessage]] = None,
    request_id: Optional[str] = None,
    page_context: Optional[PageContext] = None,
) -> Tuple[str, List[ArticleSource]]:
    """Generate a grounded answer with live model discovery and provider failover."""
    request_id = request_id or uuid.uuid4().hex[:12]
    history = history or []
    context, sources = _build_grounding(
        context_articles, user_query, page_context=page_context
    )
    prompt = _system_prompt(context)
    keys = {
        "groq": os.getenv("GROQ_API_KEY", "").strip(),
        "gemini": (
            os.getenv("GEMINI_API_KEY", "").strip()
            or os.getenv("GOOGLE_API_KEY", "").strip()
        ),
    }
    providers = _csv_env("AI_PROVIDER_ORDER", ("groq", "gemini"))

    if not any(keys.values()):
        logger.error("request=%s no AI provider key is configured", request_id)
        raise AIServiceUnavailable("No AI provider is configured")

    for provider in providers:
        if not keys.get(provider):
            continue
        try:
            if provider == "groq":
                return (
                    _try_groq(keys[provider], prompt, history, user_query, request_id),
                    sources,
                )
            if provider == "gemini":
                return (
                    _try_gemini(keys[provider], prompt, history, user_query, request_id),
                    sources,
                )
        except Exception as exc:
            logger.warning(
                "request=%s provider=%s unavailable: %s",
                request_id,
                provider,
                _safe_error_summary(exc),
            )

    raise AIServiceUnavailable("All configured AI providers failed")


@app.exception_handler(AIServiceUnavailable)
async def ai_unavailable_handler(
    request: Request, exc: AIServiceUnavailable
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", uuid.uuid4().hex[:12])
    return JSONResponse(
        status_code=503,
        content={
            "detail": "The AI assistant is briefly unavailable. Please try again in a moment.",
            "request_id": request_id,
        },
        headers={"Retry-After": "20", "Cache-Control": "no-store"},
    )


@app.middleware("http")
async def request_metadata(request: Request, call_next: Any) -> Response:
    request.state.request_id = uuid.uuid4().hex[:12]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.get("/")
@app.get("/api")
@app.get("/api/")
def root_status() -> Dict[str, Any]:
    return {
        "status": "online",
        "service": "e-MarketingReviews AI Engine",
        "version": APP_VERSION,
    }


@app.get("/health")
@app.get("/api/health")
def health_status() -> Dict[str, Any]:
    configured = bool(
        os.getenv("GROQ_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )
    return {
        "status": "ready" if configured else "configuration_required",
        "knowledge_documents": len(load_knowledge_base()),
        "ai_provider_configured": configured,
        "version": APP_VERSION,
    }


@app.get("/widget.js")
@app.get("/public/widget.js")
def serve_widget() -> Response:
    paths = (
        os.path.join(os.path.dirname(__file__), "..", "public", "widget.js"),
        os.path.join(os.getcwd(), "public", "widget.js"),
        os.path.join(os.path.dirname(__file__), "widget.js"),
    )
    for path in paths:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as handle:
                return Response(
                    content=handle.read(),
                    media_type="application/javascript",
                    headers={
                        "Cache-Control": "public, max-age=0, must-revalidate",
                        "X-Content-Type-Options": "nosniff",
                    },
                )
    raise HTTPException(status_code=404, detail="Widget file not found")


@app.get("/chat")
@app.get("/api/chat")
@app.get("/chat/")
@app.get("/api/chat/")
def chat_get_info() -> Dict[str, str]:
    return {
        "status": "online",
        "message": "Send a POST request with a message to use the assistant.",
        "endpoint": "/api/chat",
    }


@app.post("/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
@app.post("/chat/")
@app.post("/api/chat/")
def chat_endpoint(request: Request, payload: ChatRequest) -> ChatResponse:
    user_message = payload.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    knowledge_base = load_knowledge_base()
    articles = search_relevant_context(
        user_message,
        knowledge_base,
        history=payload.history,
        page_context=payload.page_context,
    )
    raw_reply, sources = generate_ai_response(
        user_message,
        articles,
        history=payload.history,
        request_id=request.state.request_id,
        page_context=payload.page_context,
    )
    clean_reply, follow_ups = _clean_and_extract_followups(raw_reply, user_message)
    return ChatResponse(reply=clean_reply, sources=sources, follow_ups=follow_ups)
