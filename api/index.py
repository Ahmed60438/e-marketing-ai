import os
import json
import re
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import groq
import google.generativeai as genai

# إنشاء تطبيق FastAPI
app = FastAPI(title="e-MarketingReviews AI Engine", version="1.0.0")

# إعداد حماية CORS للسماح لموقعك بطلب الـ API دون مشاكل
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # يمكن تخصيصها لـ ["https://www.e-marketingreviews.com"] للأمان العالي
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# نماذج البيانات (Pydantic Schemas)
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
    """تحميل مقالات الموقع من ملف JSON"""
    if os.path.exists(KNOWLEDGE_BASE_PATH):
        try:
            with open(KNOWLEDGE_BASE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ خطأ أثناء قراءة knowledge_base.json: {e}")
            return []
    return []

def search_relevant_context(query: str, articles: list, top_k: int = 3) -> list:
    """محرك RAG مبسط وذكي لمطابقة الكلمات المفتاحية واستخراج المقالات الأكثر صلة"""
    if not articles:
        return []
    
    # استخراج الكلمات المفتاحية من سؤال المستخدم
    query_words = set(re.findall(r'\w+', query.lower()))
    scored_articles = []
    
    for art in articles:
        title = art.get("title", "")
        content = art.get("content", "")
        combined_text = f"{title} {content}".lower()
        
        # حساب درجة التطابق بناءً على تكرار الكلمات
        score = 0
        for word in query_words:
            if len(word) > 2: # تجاهل الكلمات القصيرة جداً
                score += combined_text.count(word)
                if word in title.lower():
                    score += 5 # إعطاء وزن أكبر للتطابق في العنوان
                    
        if score > 0:
            scored_articles.append((score, art))
            
    # ترتيب المقالات حسب درجة التطابق
    scored_articles.sort(key=lambda x: x[0], reverse=True)
    return [art for score, art in scored_articles[:top_k]]

def generate_ai_response(user_query: str, context_articles: list) -> tuple[str, list]:
    """إرسال النص والسياق للذكاء الاصطناعي لتوليد الإجابة"""
    
    # إعداد نص السياق والمصادر
    context_text = ""
    sources = []
    
    if context_articles:
        context_text = "\n\n".join([
            f"المقال: {art['title']}\nالرابط: {art['url']}\nالمحتوى: {art['content'][:1500]}..."
            for art in context_articles
        ])
        for art in context_articles:
            sources.append(ArticleSource(title=art['title'], url=art['url']))
            
    system_prompt = f"""أنت المساعد الذكي المخصص لموقع e-MarketingReviews (المتخصص في التسويق الرقمي، أدوات الذكاء الاصطناعي، ومراجعات البرامج).
مهمتك إجابة الزائر بأسلوب احترافي، ودود، ومشجع باللغة العربية.

بناءً على مقالات الموقع التالية المتاحة لك:
---
{context_text if context_text else "لا توجد مقالات مباشرة متعلقة بهذا السؤال في قاعدة البيانات حالياً."}
---

تعليمات مهمة للإجابة:
1. استخدم المعلومات الموجودة في المقالات أعلاه قدر الإمكان للرد على سؤال المستخدم.
2. إذا كان السؤال يتعلق بإنشاء محتوى أو أدوات تسويق، قدّم نصائح واضحة وعملية.
3. كن دقيقاً ومختصراً ولا تبتدع معلومات غير موجودة في مجال الموقع.
4. رحب بالزائر بلطف ودائماً وجهه للاستفادة من المراجعات المتاحة على الموقع.
"""

    groq_api_key = os.getenv("GROQ_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    # الخيار الأول: استخدام Groq (نموذج Llama 3.3)
    if groq_api_key:
        try:
            client = groq.Groq(api_key=groq_api_key)
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
            print(f"⚠️ خطأ في Groq API: {e}")

    # الخيار الثاني التلقائي (الاحتياطي): استخدام Gemini API
    if gemini_api_key:
        try:
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(f"{system_prompt}\n\nسؤال الزائر: {user_query}")
            return response.text, sources
        except Exception as e:
            print(f"⚠️ خطأ في Gemini API: {e}")

    return "عذراً، لم أتمكن من الاتصال بمحرك الذكاء الاصطناعي حالياً. يرجى التأكد من ضبط مفاتيح الـ API.", []

# ==========================================
# Endpoints - المسارات المتعددة والمحدثة لـ Vercel
# ==========================================

@app.get("/")
@app.get("/api")
def read_root():
    return {"status": "online", "message": "e-MarketingReviews AI API is running!"}

@app.get("/widget.js")
@app.get("/public/widget.js")
def serve_widget():
    """تقديم ملف widget.js مباشرة لعرض شباك الدردشة في الموقع"""
    widget_path = os.path.join(os.path.dirname(__file__), "..", "public", "widget.js")
    if os.path.exists(widget_path):
        with open(widget_path, "r", encoding="utf-8") as f:
            content = f.read()
        return Response(content=content, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="Widget file not found")

@app.post("/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="الرسالة فارغة!")
        
    knowledge_base = load_knowledge_base()
    relevant_articles = search_relevant_context(request.message, knowledge_base)
    reply, sources = generate_ai_response(request.message, relevant_articles)
    
    return ChatResponse(reply=reply, sources=sources)
