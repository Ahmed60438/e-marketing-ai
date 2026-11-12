# e-MarketingReviews AI Assistant (v4.0)

An enterprise-grade, Blogger-compatible AI Copilot powered by FastAPI, Groq, Gemini, and a grounded local knowledge base built from `https://www.e-marketingreviews.com/`.

## What's new in v4.0

- **Adaptive Light & Dark Mode Sync**: Automatically detects the website's active color theme via HTML/body attributes, `localStorage`, and real-time computed background luminance (`getComputedStyle`), plus provides an instant in-header theme switcher.
- **Responsive Desktop & Mobile Design**:
  - Compact, unobtrusive pill launcher (`44px` on desktop, `40px` on mobile) that automatically hides when the chat window is open so it never overlaps article cards or CTA buttons.
  - Optimized mobile bottom-sheet layout (`<= 640px`) with single-line header status, backdrop overlay, iOS zoom-safe `16px` input, and compact prompt pills.
  - Desktop Expand/Wide mode toggle (`388px` standard / `540px` wide) for reading detailed SEO comparisons.
- **Live Page Context Awareness**: Extracts the visitor's current article title, URL, category, and content excerpt so clicking `✦ Summarize this page` works even on newly published posts.
- **Session Persistence & Rich Markdown**: Preserves conversation state across page navigations in `sessionStorage` and renders headings, numbered lists, bullets, inline code, fenced code blocks, and clickable source links with automatic RTL/LTR text direction (`dir="auto"`).
- **Smarter Grounded Retrieval**: Stem-aware ranking, conversation-history query expansion for short follow-ups, and automatic filtering of legal/boilerplate pages from article recommendations.

## Environment variables

Configure environment variables in Vercel using `.env.example` as a guide. At least one of `GROQ_API_KEY` or `GEMINI_API_KEY` is required. Configure both for automatic cross-provider failover.

## Blogger installation

Deploy the project to Vercel, verify `/api/health`, and paste the contents of `blogger-snippet.html` immediately before `</body>` in your Blogger template.

## Programmatic JavaScript API

The widget exposes `window.EMarketingAI` on the host page:

```js
window.EMarketingAI.open();
window.EMarketingAI.close();
window.EMarketingAI.toggle();
window.EMarketingAI.ask("Summarize this page");
window.EMarketingAI.setTheme("dark"); // "light", "dark", or null for auto-sync
```
