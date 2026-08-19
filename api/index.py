import os
import json
import re
import logging
from typing import List, Tuple, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ------------------------------------------------------------------------------
# Logging Setup
# ------------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("e-marketing-ai")

# ------------------------------------------------------------------------------
# Safe Dynamic Imports for AI Providers
# ------------------------------------------------------------------------------
try:
    import groq
except ImportError:
    groq = None
    logger.warning("Groq SDK is not installed.")

try:
    import google.generativeai as genai
except ImportError:
    genai = None
    logger.warning("Google Generative AI SDK is not installed.")

# ------------------------------------------------------------------------------
# FastAPI Application Initialization
# ------------------------------------------------------------------------------
app = FastAPI(
    title="e-MarketingReviews AI Engine",
    description="Production-grade AI Assistant API with automated model failover and RAG context extraction.",
    version="2.2.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Data Schemas
# ------------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User query message")

class ArticleSource(BaseModel):
    title: str
    url: str

class ChatResponse(BaseModel):
    reply: str
    sources: List[ArticleSource]

# ------------------------------------------------------------------------------
# Global Memory Cache & RAG Search Logic
# ------------------------------------------------------------------------------
KNOWLEDGE_BASE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_base.json")
_knowledge_cache: Optional[List[Dict[str, Any]]] = None

def load_knowledge_base() -> List[Dict[str, Any]]:
    """Loads and caches the knowledge base in memory across warm serverless invocations."""
    global _knowledge_cache
    if _knowledge_cache is not None:
        return _knowledge_cache

    possible_paths = [
        KNOWLEDGE_BASE_PATH,
        os.path.join(os.getcwd(), "data", "knowledge_base.json"),
        os.path.join(os.path.dirname(__file__), "knowledge_base.json")
    ]

    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    _knowledge_cache = json.load(f)
                    logger.info(f"Successfully loaded {len(_knowledge_cache)} articles from {path}")
                    return _knowledge_cache
            except Exception as e:
                logger.error(f"Error reading knowledge base at {path}: {e}")

    logger.warning("Knowledge base JSON file not found or failed to load.")
    return []

STOP_WORDS = {"the", "a", "an", "is", "are", "and", "or", "in", "on", "at", "to", "for", "of", "with", "about", "what", "how", "which"}

def search_relevant_context(query: str, articles: List[Dict[str, Any]], top_k: int = 3) -> List[Dict[str, Any]]:
    """Enhanced keyword-matching algorithm with title weight boosting and stop-word filtering."""
    if not articles:
        return []

    tokens = [w.lower() for w in re.findall(r'\b\w+\b', query) if len(w) > 2 and w.lower() not in STOP_WORDS]
    if not tokens:
        tokens = [w.lower() for w in re.findall(r'\b\w+\b', query) if len(w) > 1]

    scored_articles = []
    for art in articles:
        title = art.get("title", "")
        content = art.get("content", "")
        title_lower = title.lower()
        content_lower = content.lower()

        score = 0
        for token in tokens:
            if token in title_lower:
                score += 10 + (title_lower.count(token) * 3)
            if token in content_lower:
                score += content_lower.count(token)

        if score > 0:
            scored_articles.append((score, art))

    scored_articles.sort(key=lambda x: x[0], reverse=True)
    return [art for _, art in scored_articles[:top_k]]

# ------------------------------------------------------------------------------
# Core AI Generation Engine with Active Updated Models
# ------------------------------------------------------------------------------
GROQ_MODEL_FALLBACKS = [
    "llama-3.3-70b-specdec",
    "gemma2-9b-it",
    "deepseek-r1-distill-qwen-32b",
    "llama-3.1-8b-instant"
]

GEMINI_MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
]

def generate_ai_response(user_query: str, context_articles: List[Dict[str, Any]]) -> Tuple[str, List[ArticleSource]]:
    """Executes AI generation across Groq and Gemini with multi-model fallback strategy."""
    context_text = ""
    sources: List[ArticleSource] = []

    if context_articles:
        formatted_blocks = []
        for art in context_articles:
            title = art.get("title", "Untitled")
            url = art.get("url", "#")
            snippet = art.get("content", "")[:1200]
            formatted_blocks.append(f"Title: {title}\nURL: {url}\nContent Snippet: {snippet}...")
            sources.append(ArticleSource(title=title, url=url))
        context_text = "\n\n".join(formatted_blocks)

    system_prompt = f"""You are the official AI Assistant for e-MarketingReviews (https://www.e-marketingreviews.com), a platform dedicated to digital marketing, AI tools, and software reviews.

RULES:
1. Provide accurate, clear, and professional answers exclusively in English.
2. Utilize the context provided below to give tailored recommendations.
3. Keep answers well-structured using short paragraphs and bullet points when necessary.
4. If the provided context does not contain direct information, draw upon general digital marketing knowledge while inviting the user to explore the website.

Relevant Website Context:
---
{context_text if context_text else "No direct article match found."}
---"""

    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    errors = []

    # 1. Attempt Groq Provider
    if groq_api_key and groq is not None:
        try:
            client = groq.Groq(api_key=groq_api_key)
            for model in GROQ_MODEL_FALLBACKS:
                try:
                    completion = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_query}
                        ],
                        temperature=0.5,
                        max_tokens=1000,
                    )
                    logger.info(f"Successfully generated response using Groq model: {model}")
                    return completion.choices[0].message.content, sources
                except Exception as e:
                    err_msg = f"Groq ({model}): {str(e)}"
                    logger.warning(err_msg)
                    errors.append(err_msg)
        except Exception as e:
            logger.error(f"Groq Initialization Error: {e}")

    # 2. Attempt Gemini Provider
    if gemini_api_key and genai is not None:
        try:
            genai.configure(api_key=gemini_api_key)
            for model_name in GEMINI_MODEL_FALLBACKS:
                try:
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(f"{system_prompt}\n\nUser Query: {user_query}")
                    logger.info(f"Successfully generated response using Gemini model: {model_name}")
                    return response.text, sources
                except Exception as e:
                    err_msg = f"Gemini ({model_name}): {str(e)}"
                    logger.warning(err_msg)
                    errors.append(err_msg)
        except Exception as e:
            logger.error(f"Gemini Initialization Error: {e}")

    if not groq_api_key and not gemini_api_key:
        return "System Configuration Error: Neither GROQ_API_KEY nor GEMINI_API_KEY environment variables are configured.", []

    return f"Service Temporarily Unavailable. Provider Errors: {' | '.join(errors)}", []

# ------------------------------------------------------------------------------
# Route Endpoints
# ------------------------------------------------------------------------------
@app.get("/")
@app.get("/api")
@app.get("/api/")
def root_status():
    return {
        "status": "online",
        "service": "e-MarketingReviews AI Engine",
        "version": "2.2.0"
    }

@app.get("/widget.js")
@app.get("/public/widget.js")
def serve_widget():
    """Serves widget.js statically with caching headers."""
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "widget.js"),
        os.path.join(os.path.dirname(__file__), "..", "public", "widget.js"),
        os.path.join(os.getcwd(), "public", "widget.js"),
        os.path.join(os.getcwd(), "api", "widget.js")
    ]
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return Response(
                    content=f.read(),
                    media_type="application/javascript",
                    headers={"Cache-Control": "public, max-age=3600"}
                )
    raise HTTPException(status_code=404, detail="Widget file not found.")

# معالجة طلبات GET لصفحة الـ Chat عند فتح الرابط بالمتصفح المباشر
@app.get("/chat")
@app.get("/api/chat")
@app.get("/chat/")
@app.get("/api/chat/")
def chat_get_info():
    return {
        "status": "online",
        "message": "Chat endpoint is active. Please send a POST request with a JSON payload {'message': 'your query'} to send messages.",
        "endpoint": "/api/chat"
    }

# استقبال طلبات POST من الشات بوت
@app.post("/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
@app.post("/chat/", response_model=ChatResponse)
@app.post("/api/chat/", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    user_msg = request.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message string cannot be empty.")

    knowledge_base = load_knowledge_base()
    relevant_articles = search_relevant_context(user_msg, knowledge_base)
    reply, sources = generate_ai_response(user_msg, relevant_articles)

    return ChatResponse(reply=reply, sources=sources)
