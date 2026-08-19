import os
import json
import re
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# استدعاء آمن لمكتبات الذكاء الاصطناعي لتفادي أخطاء البناء
try:
    import groq
except ImportError:
    groq = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

# إنشاء تطبيق FastAPI
app = FastAPI(title="e-MarketingReviews AI Engine", version="1.0.0")

# إعداد حماية CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# نماذج البيانات
class ChatRequest(BaseModel):
    message: str

class ArticleSource(BaseModel):
    title: str
    url: str

class ChatResponse(BaseModel):
    reply: str
    sources: List[ArticleSource]

# تحميل الذاكرة وقاعدة البيانات
KNOWLEDGE_BASE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_base.json")

def load_knowledge_base():
    if os.path.exists(KNOWLEDGE_BASE_PATH):
        try:
            with open(KNOWLEDGE_BASE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def search_relevant_context(query: str, articles: list, top_k: int = 3) -> list:
    if not articles:
        return []
    
    query_words = set(re.findall(r'\w+', query.lower()))
    scored_articles = []
    
    for art in articles:
        title = art.get("title", "")
        content = art.get("content", "")
        combined_text = f"{title} {content}".lower()
        
        score = 0
        for word in query_words:
            if len(word) > 2:
                score += combined_text.count(word)
                if word in title.lower():
                    score += 5
                    
        if score > 0:
            scored_articles.append((score, art))
            
    scored_articles.sort(key=lambda x: x[0], reverse=True)
    return [art for score, art in scored_articles[:top_k]]

def generate_ai_response(user_query: str, context_articles: list):
    context_text = ""
    sources = []
    
    if context_articles:
        context_text = "\n\n".join([
            f"Article: {art['title']}\nURL: {art['url']}\nContent: {art['content'][:1500]}..."
            for art in context_articles
        ])
        for art in context_articles:
            sources.append(ArticleSource(title=art['title'], url=art['url']))
            
    system_prompt = f"""You are the official AI assistant for e-MarketingReviews (specialized in digital marketing, AI tools, and software reviews).
Respond professionally and concisely in English.

Context from website:
---
{context_text if context_text else "No specific context available."}
---
"""

    groq_api_key = os.getenv("GROQ_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    errors = []

    # 1. تجربة Groq
    if groq_api_key and groq is not None:
        try:
            client = groq.Groq(api_key=groq_api_key.strip())
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query}
                ],
                temperature=0.6,
                max_tokens=1000,
            )
            return completion.choices[0].message.content, sources
        except Exception as e:
            errors.append(f"Groq Error: {str(e)}")

    # 2. تجربة Gemini
    if gemini_api_key and genai is not None:
        try:
            genai.configure(api_key=gemini_api_key.strip())
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(f"{system_prompt}\n\nUser Question: {user_query}")
            return response.text, sources
        except Exception as e:
            errors.append(f"Gemini Error: {str(e)}")

    if not groq_api_key and not gemini_api_key:
        return "Error: API Keys (GROQ_API_KEY / GEMINI_API_KEY) are missing in Vercel Environment Variables.", []

    return f"API Exception: {' | '.join(errors)}", []

# Endpoints
@app.get("/")
@app.get("/api")
def read_root():
    return {"status": "online", "message": "e-MarketingReviews AI API is running!"}

@app.get("/widget.js")
@app.get("/public/widget.js")
def serve_widget():
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "widget.js"),
        os.path.join(os.path.dirname(__file__), "..", "public", "widget.js"),
        os.path.join(os.getcwd(), "public", "widget.js"),
        os.path.join(os.getcwd(), "api", "widget.js")
    ]
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return Response(content=f.read(), media_type="application/javascript")
    raise HTTPException(status_code=404, detail="Widget file not found")

@app.post("/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message is empty")
        
    knowledge_base = load_knowledge_base()
    relevant_articles = search_relevant_context(request.message, knowledge_base)
    reply, sources = generate_ai_response(request.message, relevant_articles)
    
    return ChatResponse(reply=reply, sources=sources)
