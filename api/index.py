def generate_ai_response(user_query: str, context_articles: list) -> tuple[str, list]:
    """توليد الإجابة مع طباعة تفاصيل الخطأ الدقيقة لتسهيل التشخيص"""
    
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

Based on the following relevant context from the website:
---
{context_text if context_text else "No specific context available."}
---
"""

    groq_api_key = os.getenv("GROQ_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    errors = []

    # 1. تجربة Groq API
    if groq_api_key:
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
            errors.append(f"Groq Exception: {str(e)}")

    # 2. تجربة Gemini API
    if gemini_api_key:
        try:
            genai.configure(api_key=gemini_api_key.strip())
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(f"{system_prompt}\n\nUser Question: {user_query}")
            return response.text, sources
        except Exception as e:
            errors.append(f"Gemini Exception: {str(e)}")

    # في حال عدم وجود أي مفتاح بيئة
    if not groq_api_key and not gemini_api_key:
        return "Debug Error: Vercel is not reading GROQ_API_KEY or GEMINI_API_KEY from Environment Variables.", []

    # إرجاع تفاصيل الخطأ الحقيقية المرتجعة من الـ API
    return f"Debug Info: {' | '.join(errors)}", []
