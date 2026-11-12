(function () {
  "use strict";

  if (window.__EMR_AI_WIDGET_V60__) return;
  window.__EMR_AI_WIDGET_V60__ = true;
  window.__EMR_AI_WIDGET_V50__ = true;
  window.__EMR_AI_WIDGET_LOADED__ = true;

  const sourceScript = document.currentScript;
  const scriptOrigin =
    sourceScript && sourceScript.src
      ? new URL(sourceScript.src, window.location.href).origin
      : "https://e-marketing-ai.vercel.app";

  const userConfig = window.EMARKETING_AI_CONFIG || {};
  const config = Object.assign(
    {
      apiUrl: window.EMARKETING_AI_URL || scriptOrigin + "/api/chat",
      position: "left",
      title: "e-marketing reviews AI",
      subtitle: "SEO & AI Marketing Copilot",
      accent: "#5b5df0"
    },
    userConfig
  );
  config.title = "e-marketing reviews AI";
  config.subtitle = "SEO & AI Marketing Copilot";

  const STORAGE_KEY = "emr_ai_conversation_v60";
  const FEED_CACHE_KEY = "emr_ai_live_feed_v60";
  const BOOKMARK_KEY = "futuretech_saved_articles_v1";
  const RECENT_KEY = "futuretech_recent_articles_v1";

  const AI_COPILOT_ICON =
    '<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">' +
    "<defs>" +
    '<linearGradient id="emrAiGrad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>' +
    '<stop offset="100%" stop-color="#bae6fd" stop-opacity="0.95"/>' +
    "</linearGradient>" +
    "</defs>" +
    '<path d="M14 2.5v2.8M9.2 4.1l1.1 2M18.8 4.1l-1.1 2" stroke="url(#emrAiGrad)" stroke-width="1.8" stroke-linecap="round"/>' +
    '<rect x="5" y="6.5" width="18" height="14.2" rx="6.5" stroke="url(#emrAiGrad)" stroke-width="1.9" fill="rgba(255,255,255,0.12)"/>' +
    '<path d="M2.5 12.6h2.2M23.3 12.6h2.2" stroke="url(#emrAiGrad)" stroke-width="1.85" stroke-linecap="round"/>' +
    '<circle cx="10.6" cy="13.1" r="1.75" fill="#ffffff"/>' +
    '<circle cx="17.4" cy="13.1" r="1.75" fill="#ffffff"/>' +
    '<path d="M10.8 17c1.9 1.3 4.5 1.3 6.4 0" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round"/>' +
    '<path d="M10.6 20.8l-1.6 3h10l-1.6-3" stroke="url(#emrAiGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  function detectSiteTheme(systemTheme) {
    const html = document.documentElement;
    const body = document.body;
    const dataTheme =
      (html && html.getAttribute("data-theme")) ||
      (body && body.getAttribute("data-theme")) ||
      "";
    if (dataTheme === "dark" || dataTheme === "light") return dataTheme;

    try {
      const saved = (
        window.localStorage.getItem("emr_theme") ||
        window.localStorage.getItem("theme") ||
        ""
      )
        .toLowerCase()
        .trim();
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {}

    return systemTheme && systemTheme.matches ? "dark" : "light";
  }

  let liveFeedArticles = [];

  async function loadLiveSiteFeed() {
    try {
      const cached = window.sessionStorage.getItem(FEED_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          liveFeedArticles = parsed;
          return;
        }
      }
    } catch (e) {}

    try {
      const feedUrl =
        window.location.origin +
        "/feeds/posts/summary?alt=json&max-results=24&orderby=published";
      const response = await fetch(feedUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return;
      const data = await response.json();
      const entries = (data && data.feed && data.feed.entry) || [];
      const items = [];
      entries.forEach(function (entry) {
        const title =
          entry.title && entry.title.$t
            ? String(entry.title.$t).trim()
            : "";
        let linkUrl = "";
        (entry.link || []).forEach(function (l) {
          if (l.rel === "alternate" && l.href) linkUrl = l.href;
        });
        const rawBody =
          (entry.summary && entry.summary.$t) ||
          (entry.content && entry.content.$t) ||
          "";
        const temp = document.createElement("div");
        temp.innerHTML = rawBody;
        const cleanSummary = String(temp.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 650);
        if (title && linkUrl) {
          items.push({ title: title, url: linkUrl, summary: cleanSummary });
        }
      });
      if (items.length) {
        liveFeedArticles = items;
        try {
          window.sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(items));
        } catch (e) {}
      }
    } catch (e) {}
  }

  function extractVisiblePagePosts() {
    const posts = [];
    const seen = {};
    liveFeedArticles.forEach(function (item) {
      if (item.url && !seen[item.url]) {
        seen[item.url] = true;
        posts.push(item);
      }
    });

    document
      .querySelectorAll(".post-card[data-post-url], article a[href]")
      .forEach(function (el) {
        if (posts.length >= 15) return;
        const href =
          el.getAttribute("data-post-url") || (el.href ? el.href.split("#")[0] : "");
        if (!href || seen[href] || href.indexOf(window.location.hostname) === -1) {
          return;
        }
        const titleNode = el.querySelector ? el.querySelector(".post-title") : null;
        const titleText = String(
          (titleNode ? titleNode.textContent : el.textContent) || ""
        )
          .replace(/\s+/g, " ")
          .trim();
        if (titleText.length < 10) return;
        seen[href] = true;
        const summaryNode = el.querySelector ? el.querySelector(".resumo") : null;
        const summaryText = summaryNode
          ? String(summaryNode.textContent || "").replace(/\s+/g, " ").trim()
          : titleText;
        posts.push({
          title: titleText.slice(0, 200),
          url: href,
          summary: summaryText.slice(0, 450)
        });
      });

    return posts.slice(0, 15);
  }

  function getSavedAndRecentSummary() {
    const info = [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(BOOKMARK_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) {
        info.push(
          "USER SAVED ARTICLES (" +
            saved.length +
            "): " +
            saved
              .slice(0, 5)
              .map(function (s) {
                return s.title + " (" + s.url + ")";
              })
              .join(" | ")
        );
      }
    } catch (e) {}
    try {
      const recent = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
      if (Array.isArray(recent) && recent.length) {
        info.push(
          "RECENTLY VIEWED BY USER: " +
            recent
              .slice(0, 4)
              .map(function (r) {
                return r.title;
              })
              .join(" | ")
        );
      }
    } catch (e) {}
    return info.join("\n");
  }

  function extractPageContext() {
    const canonical = document.querySelector('link[rel="canonical"]');
    const url = canonical ? canonical.href : window.location.href.split("#")[0];
    const path = window.location.pathname || "/";
    const isHome = path === "/" || path === "/index.html";

    const headingEl = document.querySelector(
      ".item h1.post-title, .static_page h1.post-title, article h1, main h1"
    );
    const rawTitle = headingEl
      ? headingEl.textContent
      : document.title || "e-marketing reviews";
    const title = String(rawTitle || "")
      .replace(/\s*[|–—-]\s*e-marketing\s*reviews.*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const categoryEl = document.querySelector(
      ".breadcrumbs a:nth-of-type(2), .post-category a, a[rel='tag']"
    );
    const category = categoryEl
      ? String(categoryEl.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80)
      : "";

    const headings = [];
    document
      .querySelectorAll(".post-body h2, .post-body h3")
      .forEach(function (h) {
        const t = String(h.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (t && headings.length < 15) headings.push(t);
      });

    let excerpt = "";
    const contentRoot = document.querySelector(
      ".item .post-body, .static_page .post-body, article .post-body, main"
    );
    if (contentRoot) {
      const clone = contentRoot.cloneNode(true);
      clone
        .querySelectorAll(
          "script, style, nav, footer, header, form, button, iframe, noscript, #auto-toc-container, #pro-audio-player, #ai-roi-calculator, .pw-widget, .comments-shell, .related-posts, .share-art"
        )
        .forEach(function (node) {
          node.remove();
        });
      excerpt = String(clone.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4200);
    }

    const userLists = getSavedAndRecentSummary();
    if (userLists) {
      excerpt = (excerpt ? excerpt + "\n\n" : "") + userLists;
    }

    return {
      url: url,
      title: title || "e-marketing reviews",
      category: category,
      headings: headings,
      excerpt: excerpt.slice(0, 4800),
      recent_posts: extractVisiblePagePosts(),
      isArticle:
        document.body.classList.contains("item") ||
        (!isHome && path.indexOf("/20") === 0),
      isToolsPage: path.toLowerCase().indexOf("seo-tools") !== -1
    };
  }

  function copyTextGuaranteed(text) {
    return new Promise(function (resolve) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(text)
          .then(function () {
            resolve(true);
          })
          .catch(function () {
            resolve(fallbackCopyText(text));
          });
      } else {
        resolve(fallbackCopyText(text));
      }
    });
  }

  function fallbackCopyText(text) {
    try {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.top = "-9999px";
      temp.style.left = "-9999px";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.focus();
      temp.select();
      temp.setSelectionRange(0, temp.value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(temp);
      return Boolean(ok);
    } catch (e) {
      return false;
    }
  }

  function initialise() {
    if (!document.body) return;
    const staleHost = document.getElementById("emr-ai-widget-host");
    if (staleHost) staleHost.remove();

    loadLiveSiteFeed();

    const host = document.createElement("div");
    host.id = "emr-ai-widget-host";
    host.style.setProperty("--emr-accent", config.accent);
    host.dataset.position = config.position === "right" ? "right" : "left";
    document.body.appendChild(host);

    const root = host.attachShadow({ mode: "open" });
    const css = [
      // :host has NO fixed position and NO z-index so .shell (z-index: 1700) stays strictly below all site modals:
      // .drawer-overlay (1800), .mobile-drawer (1900), .bookmark-panel (1900), .search-overlay (2200), .media-lightbox (4200), #ai-roi-calculator (2147483200)
      ":host{all:initial;color-scheme:light dark;-webkit-text-size-adjust:100%;text-size-adjust:100%}",
      "*,*::before,*::after{box-sizing:border-box}",
      "button,textarea,input{font:inherit;color:inherit;margin:0;background:none;border:0;-webkit-appearance:none;appearance:none}",
      ".shell{",
      "--bg:#ffffff;",
      "--panel:#f5f7fb;",
      "--card:#ffffff;",
      "--card-hover:#eef2f8;",
      "--text:#101828;",
      "--text-soft:#475467;",
      "--muted:#667085;",
      "--line:rgba(15,23,42,.10);",
      "--line-strong:rgba(15,23,42,.18);",
      "--soft:rgba(91,93,240,.11);",
      "--soft-border:rgba(91,93,240,.24);",
      "--accent:#5b5df0;",
      "--accent-2:#00a6d6;",
      "--accent-text:#3730a3;",
      "--brand-fill:#4338ca;",
      "--brand-fill-2:#0369a1;",
      "--user-bg:linear-gradient(135deg,#4338ca 0%,#0369a1 100%);",
      "--user-text:#ffffff;",
      "--focus-ring:rgba(91,93,240,.18);",
      "--shadow:0 24px 64px -12px rgba(16,24,40,.22),0 8px 24px -6px rgba(16,24,40,.10),0 0 0 1px rgba(15,23,42,.06);",
      "--launcher-bg:linear-gradient(145deg,#4338ca 0%,#0369a1 100%);",
      "--launcher-border:rgba(255,255,255,.32);",
      "--launcher-shadow:0 10px 26px rgba(67,56,202,.34),0 3px 10px rgba(16,24,40,.14),inset 0 1px 1px rgba(255,255,255,.35);",
      "--launcher-hover-shadow:0 14px 32px rgba(67,56,202,.46),0 5px 14px rgba(3,105,161,.24),inset 0 1px 2px rgba(255,255,255,.45);",
      "--header-bg:linear-gradient(135deg,#101828 0%,#3730a3 55%,#0369a1 100%);",
      "--code-bg:#eef2f8;",
      "position:fixed;z-index:1700;bottom:max(20px,env(safe-area-inset-bottom));left:20px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;color:var(--text);direction:ltr;text-align:left;-webkit-font-smoothing:antialiased}",
      ":host([data-position=right]) .shell{left:auto;right:20px}",
      ":host([data-theme=dark]) .shell{",
      "--bg:#0d1727;",
      "--panel:#070d18;",
      "--card:#111f33;",
      "--card-hover:#172942;",
      "--text:#edf3ff;",
      "--text-soft:#b5c2d8;",
      "--muted:#8fa0ba;",
      "--line:rgba(203,213,225,.12);",
      "--line-strong:rgba(203,213,225,.22);",
      "--soft:rgba(129,140,248,.14);",
      "--soft-border:rgba(129,140,248,.30);",
      "--accent:#818cf8;",
      "--accent-2:#22d3ee;",
      "--accent-text:#c7d2fe;",
      "--brand-fill:#4338ca;",
      "--brand-fill-2:#075985;",
      "--user-bg:linear-gradient(135deg,#4338ca 0%,#075985 100%);",
      "--user-text:#ffffff;",
      "--focus-ring:rgba(129,140,248,.24);",
      "--shadow:0 28px 70px -10px rgba(0,0,0,.68),0 10px 28px -6px rgba(0,0,0,.45),0 0 0 1px rgba(203,213,225,.12);",
      "--launcher-bg:linear-gradient(145deg,#4338ca 0%,#075985 100%);",
      "--launcher-border:rgba(199,210,254,.30);",
      "--launcher-shadow:0 12px 28px rgba(0,0,0,.55),0 0 18px rgba(91,93,240,.32),inset 0 1px 1px rgba(255,255,255,.28);",
      "--launcher-hover-shadow:0 16px 34px rgba(0,0,0,.65),0 0 24px rgba(34,211,238,.38),inset 0 1px 2px rgba(255,255,255,.4);",
      "--header-bg:linear-gradient(135deg,#070d18 0%,#312e81 55%,#075985 100%);",
      "--code-bg:#070d18}",
      ".launcher{position:relative;width:52px;height:52px;padding:0;border:1.5px solid var(--launcher-border);border-radius:50%;display:grid;place-items:center;color:#ffffff;background:var(--launcher-bg);box-shadow:var(--launcher-shadow);cursor:pointer;user-select:none;transition:transform .22s cubic-bezier(.22,1,.36,1),box-shadow .22s ease,opacity .2s ease}",
      ".launcher::before{content:'';position:absolute;inset:3px;border-radius:50%;border:1px solid rgba(255,255,255,.16);pointer-events:none}",
      ".shell[data-open=true] .launcher{display:none}",
      ".launcher:hover{transform:translateY(-2px) scale(1.04);box-shadow:var(--launcher-hover-shadow)}",
      ".launcher:active{transform:translateY(0) scale(.95)}",
      ".launcher svg{width:26px;height:26px;filter:drop-shadow(0 2px 4px rgba(15,23,42,.22))}",
      ".launcherDot{position:absolute;right:1px;top:1px;width:11px;height:11px;border:2px solid var(--bg);border-radius:50%;background:#10b981;box-shadow:0 2px 6px rgba(16,185,129,.45)}",
      ".launcher:focus-visible,.iconBtn:focus-visible,.send:focus-visible,.voiceBtn:focus-visible,.prompt:focus-visible,.followup:focus-visible,.msgAction:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
      ".panel{position:absolute;left:0;bottom:0;width:min(392px,calc(100vw - 32px));height:min(510px,calc(100dvh - 104px));max-height:calc(100dvh - 104px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:22px;background:var(--bg);box-shadow:var(--shadow);transform-origin:bottom left;animation:emrOpen .22s cubic-bezier(.22,1,.36,1);transition:width .22s ease,height .22s ease}",
      ":host([data-position=right]) .panel{left:auto;right:0;transform-origin:bottom right}",
      ".panel.is-wide{width:min(540px,calc(100vw - 40px));height:min(580px,calc(100dvh - 96px))}",
      ".panel[hidden]{display:none!important}",
      "@keyframes emrOpen{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}",
      ".header{position:relative;display:flex;align-items:center;gap:10px;min-height:60px;padding:11px 12px 11px 14px;color:#fff;background:var(--header-bg);flex:0 0 auto;border-bottom:1px solid rgba(255,255,255,.08)}",
      ".brandMark{width:36px;height:36px;display:grid;place-items:center;flex:0 0 auto;border:1px solid rgba(255,255,255,.22);border-radius:11px;background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}",
      ".brandMark svg{width:21px;height:21px}",
      ".brand{min-width:0;flex:1}",
      ".brandTitle{display:block;overflow:hidden;font-size:13.5px;font-weight:800;letter-spacing:-.01em;text-overflow:ellipsis;white-space:nowrap;color:#fff;line-height:1.25}",
      ".status{display:flex;align-items:center;gap:6px;margin-top:2px;color:rgba(237,243,255,.9);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".statusDot{width:6.5px;height:6.5px;flex:0 0 auto;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.18)}",
      ".brandSubtitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".headerActions{display:flex;align-items:center;gap:2px;flex:0 0 auto}",
      ".iconBtn{width:31px;height:31px;border-radius:9px;display:grid;place-items:center;color:rgba(241,245,249,.88);background:transparent;cursor:pointer;transition:background .16s ease,color .16s ease,transform .16s ease}",
      ".iconBtn:hover{color:#fff;background:rgba(255,255,255,.14)}",
      ".iconBtn:active{transform:scale(.94)}",
      ".iconBtn svg{width:15.5px;height:15.5px}",
      ".toast{position:absolute;top:66px;left:50%;transform:translateX(-50%) translateY(-8px);z-index:25;padding:6px 12px;border-radius:999px;background:#101828;color:#fff;border:1px solid rgba(255,255,255,.14);font-size:11px;font-weight:700;box-shadow:0 8px 20px rgba(0,0,0,.28);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .18s ease,transform .18s ease,visibility .18s ease;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}",
      ".toast.is-visible{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}",
      ".messages{flex:1;min-height:0;padding:13px 12px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;background:linear-gradient(180deg,var(--panel) 0%,var(--bg) 65%);scrollbar-width:thin;scrollbar-color:var(--line-strong) transparent}",
      ".messages::-webkit-scrollbar{width:5px}.messages::-webkit-scrollbar-thumb{border-radius:99px;background:var(--line-strong)}",
      ".welcome{margin:0 0 11px;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--card);box-shadow:0 4px 14px rgba(16,24,40,.04)}",
      ".contextBar{display:flex;align-items:center;gap:6px;margin:0 0 8px;padding:5px 9px;border-radius:9px;background:var(--soft);border:1px solid var(--soft-border);color:var(--accent-text);font-size:11px;font-weight:700;min-width:0}",
      ".contextBar svg{width:13px;height:13px;flex:0 0 auto}",
      ".contextBar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".welcomeTitle{display:flex;align-items:center;gap:7px;margin:0 0 5px;font-size:13.5px;font-weight:800;color:var(--text)}",
      ".spark{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;font-size:12px;color:#fff;background:var(--launcher-bg)}",
      ".spark svg{width:14px;height:14px}",
      ".welcome p{margin:0;color:var(--text-soft);font-size:12px;line-height:1.5}",
      ".prompts{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}",
      ".prompt{border:1px solid var(--line);border-radius:999px;padding:5.5px 10.5px;color:var(--text);background:var(--bg);cursor:pointer;font-size:11.5px;font-weight:600;line-height:1.3;text-align:left;transition:border-color .16s ease,background .16s ease,color .16s ease,transform .16s ease}",
      ".prompt.primary{border-color:var(--soft-border);background:var(--soft);color:var(--accent-text);font-weight:700}",
      ".prompt:hover{border-color:var(--accent);background:var(--soft);color:var(--accent-text);transform:translateY(-1px)}",
      ".row{display:flex;margin:0 0 12px;animation:emrFadeIn .18s ease both}",
      "@keyframes emrFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}",
      ".row.user{justify-content:flex-end}",
      ".messageWrap{max-width:92%;min-width:0}",
      ".bubble{border-radius:16px;padding:11px 13px;font-size:13px;line-height:1.62;word-break:normal!important;overflow-wrap:break-word!important;white-space:normal!important;hyphens:none}",
      ".bot .bubble{border:1px solid var(--line);border-bottom-left-radius:5px;color:var(--text);background:var(--card);box-shadow:0 2px 10px rgba(16,24,40,.04)}",
      ".user .bubble{border-bottom-right-radius:5px;color:var(--user-text);background:var(--user-bg);box-shadow:0 6px 16px rgba(67,56,202,.22)}",
      ".rich{width:100%;min-width:0;word-break:normal!important;overflow-wrap:break-word!important}",
      ".rich p{margin:0 0 8px;word-break:normal!important;overflow-wrap:break-word!important}.rich p:last-child{margin-bottom:0}",
      ".rich .heading{margin:9px 0 5px;font-size:13.5px;font-weight:800;color:var(--text);line-height:1.35}",
      ".rich .heading:first-child{margin-top:0}",
      ".user .rich .heading{color:#fff}",
      ".rich .listLine{display:flex;align-items:flex-start;gap:7px;margin:4.5px 0;width:100%}",
      ".rich .bullet{color:var(--accent);font-weight:800;flex:0 0 auto;min-width:14px;line-height:1.6}",
      ".rich .listBody{flex:1;min-width:0;word-break:normal!important;overflow-wrap:break-word!important}",
      ".user .rich .bullet{color:rgba(255,255,255,.9)}",
      ".rich blockquote{margin:6px 0;padding:6px 10px;border-left:3px solid var(--accent);background:var(--panel);border-radius:0 8px 8px 0;color:var(--text-soft);font-size:12.5px}",
      ".rich strong{font-weight:800}",
      ".rich em{font-style:italic}",
      ".rich code{padding:1.5px 5px;border-radius:5px;background:var(--code-bg);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;word-break:break-word}",
      ".user .rich code{background:rgba(255,255,255,.18);color:#fff}",
      ".streamCursor{display:inline-block;width:6px;height:14px;margin-left:3px;vertical-align:-2px;border-radius:2px;background:var(--accent);animation:emrBlink .75s infinite ease-in-out}",
      "@keyframes emrBlink{0%,100%{opacity:1}50%{opacity:.2}}",
      ".codeBlock{margin:8px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--code-bg)}",
      ".codeHeader{display:flex;justify-content:space-between;align-items:center;padding:4px 9px;background:var(--panel);border-bottom:1px solid var(--line);font-size:10.5px;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
      ".codeCopyBtn{padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:700;color:var(--accent-text);background:var(--soft);cursor:pointer}",
      ".codeCopyBtn:hover{opacity:.85}",
      ".codeBlock pre{margin:0;padding:9px 10px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.45;white-space:pre}",
      ".compareCard{margin:8px 0;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:var(--panel)}",
      ".compareCardTitle{font-size:12.5px;font-weight:800;color:var(--accent-text);margin:0 0 5px;word-break:normal!important}",
      ".compareCardRow{font-size:12px;margin:3px 0;line-height:1.5;word-break:normal!important;overflow-wrap:break-word!important}",
      ".rich a{color:var(--accent);text-decoration:underline;text-underline-offset:2px;font-weight:700}",
      ".user .rich a{color:#fff}",
      ".meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-height:22px;margin-top:4px;color:var(--muted);font-size:10px}",
      ".bot .meta{padding-left:2px}.user .meta{justify-content:flex-end;padding-right:3px}",
      ".msgAction{height:23px;padding:0 7px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;color:var(--muted);background:transparent;cursor:pointer;font-size:10.5px;font-weight:700;transition:background .15s ease,color .15s ease}",
      ".msgAction:hover{color:var(--text);background:var(--card-hover)}",
      ".msgAction.is-active{color:var(--accent);background:var(--soft)}",
      ".msgAction svg{width:12.5px;height:12.5px;flex:0 0 auto}",
      ".sources{display:grid;gap:6px;margin-top:9px;padding-top:9px;border-top:1px solid var(--line)}",
      ".sourcesLabel{color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}",
      ".source{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--line);border-radius:10px;color:var(--accent-text);background:var(--panel);text-decoration:none;font-size:11.5px;font-weight:600;line-height:1.35;transition:border-color .16s ease,background .16s ease,transform .16s ease}",
      ".source:hover{border-color:var(--accent);background:var(--soft);transform:translateY(-1px)}",
      ".sourceIcon{width:20px;height:20px;display:grid;place-items:center;flex:0 0 auto;border-radius:6px;font-size:11px;color:var(--accent);background:var(--soft)}",
      ".source span:last-child{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:normal}",
      ".followups{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}",
      ".followup{border:1px solid var(--soft-border);border-radius:999px;padding:4.5px 9.5px;background:var(--soft);color:var(--accent-text);font-size:11px;font-weight:600;cursor:pointer;text-align:left;transition:background .15s ease,border-color .15s ease,transform .15s ease}",
      ".followup:hover{border-color:var(--accent);transform:translateY(-1px)}",
      ".typing{display:inline-flex;align-items:center;gap:5px;min-width:48px;padding:11px 14px}",
      ".typing i{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:emrTyping 1.2s infinite ease-in-out}",
      ".typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}",
      "@keyframes emrTyping{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}",
      ".composer{padding:9px 11px max(9px,env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--bg);flex:0 0 auto}",
      ".inputBox{display:flex;align-items:center;gap:5px;padding:4px 5px 4px 11px;border:1.5px solid var(--line-strong);border-radius:15px;background:var(--card);transition:border-color .16s ease,box-shadow .16s ease}",
      ".inputBox:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--focus-ring)}",
      "textarea{flex:1;width:100%;min-width:0;height:34px;max-height:92px;resize:none!important;border:0!important;outline:0!important;box-shadow:none!important;padding:6px 0;color:var(--text);background:transparent!important;font-size:13px;line-height:1.4;overflow-y:auto}",
      "textarea::placeholder{color:var(--muted);opacity:.85}",
      ".voiceBtn{width:33px;height:33px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto;color:var(--muted);background:transparent;cursor:pointer;transition:color .16s ease,background .16s ease,transform .16s ease}",
      ".voiceBtn:hover{color:var(--text);background:var(--card-hover)}",
      ".voiceBtn.is-listening{color:#ffffff;background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.22);animation:emrPulse 1.2s infinite}",
      "@keyframes emrPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}",
      ".voiceBtn svg{width:16px;height:16px}",
      ".send{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;color:#fff;background:var(--launcher-bg);box-shadow:0 4px 12px rgba(67,56,202,.28);cursor:pointer;transition:transform .16s ease,opacity .16s ease,box-shadow .16s ease}",
      ".send.is-stop{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 4px 12px rgba(239,68,68,.28)}",
      ".send:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 14px rgba(67,56,202,.36)}",
      ".send:disabled{opacity:.38;cursor:not-allowed;box-shadow:none}",
      ".send svg{width:16px;height:16px}",
      ".composerMeta{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 3px 0;color:var(--muted);font-size:10px}",
      ".hintMobile{display:none}",
      ".count.warning{color:#d97706;font-weight:700}",
      "@media(max-width:640px){",
      ".shell{left:12px;bottom:max(12px,env(safe-area-inset-bottom))}",
      ":host([data-position=right]) .shell{left:auto;right:12px}",
      ".launcher{width:48px;height:48px}",
      ".launcher svg{width:23px;height:23px}",
      ".launcherDot{width:10.5px;height:10.5px;right:1px;top:1px}",
      ".panel,.panel.is-wide,:host([data-position=right]) .panel{position:fixed;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));width:auto;height:min(510px,calc(100dvh - 82px));max-height:calc(100dvh - 82px);border-radius:20px}",
      ".header{min-height:54px;padding:10px 11px 10px 13px;gap:9px}",
      ".brandMark{width:33px;height:33px;border-radius:10px}",
      ".brandMark svg{width:18px;height:18px}",
      ".brandTitle{font-size:13px}",
      ".status{font-size:10.5px;margin-top:1px}",
      ".expandBtn{display:none}",
      ".messages{padding:11px 10px}",
      ".welcome{padding:11px;margin-bottom:10px;border-radius:14px}",
      ".welcomeTitle{font-size:13px}",
      ".welcome p{font-size:11.5px;line-height:1.45}",
      ".prompts{gap:5px;margin-top:8px}",
      ".prompt{padding:5.5px 10px;font-size:11px}",
      ".bubble{font-size:12.5px;padding:10px 11px}",
      ".composer{padding:8px 10px max(8px,env(safe-area-inset-bottom))}",
      "textarea{font-size:16px;height:32px;padding:4px 0}",
      ".hintDesktop{display:none}",
      ".hintMobile{display:inline}",
      "}",
      "@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}"
    ].join("");

    const markup = [
      '<div class="shell" data-open="false">',
      '<button class="launcher" type="button" aria-label="Open e-marketing reviews AI" title="e-marketing reviews AI Copilot" aria-expanded="false">',
      AI_COPILOT_ICON,
      '<span class="launcherDot" aria-hidden="true"></span>',
      "</button>",
      '<section class="panel" role="dialog" aria-modal="false" aria-label="e-marketing reviews AI assistant" hidden>',
      '<header class="header">',
      '<div class="brandMark" aria-hidden="true">' + AI_COPILOT_ICON + "</div>",
      '<div class="brand"><strong class="brandTitle"></strong><div class="status"><span class="statusDot"></span><span class="brandSubtitle"></span></div></div>',
      '<div class="headerActions">',
      '<button class="iconBtn exportBtn" type="button" aria-label="Export conversation" title="Download chat notes (.md)"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>',
      '<button class="iconBtn expandBtn" type="button" aria-label="Toggle wide view" title="Expand / compact view"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>',
      '<button class="iconBtn clearBtn" type="button" aria-label="Start a new conversation" title="New conversation"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
      '<button class="iconBtn closeBtn" type="button" aria-label="Close assistant" title="Close (Esc)"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
      "</div></header>",
      '<div class="toast" role="status" aria-live="polite"></div>',
      '<main class="messages" aria-live="polite" aria-relevant="additions">',
      '<section class="welcome">',
      '<div class="contextBar" title="Connected to current page"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="contextText"></span></div>',
      '<div class="welcomeTitle"><span class="spark" aria-hidden="true">' +
        AI_COPILOT_ICON +
        "</span><span>How can I help you today?</span></div>",
      "<p>Ask about technical SEO, AI marketing tools, keyword clustering, or summarize any guide on e-marketing reviews.</p>",
      '<div class="prompts"></div>',
      "</section>",
      "</main>",
      '<footer class="composer">',
      '<div class="inputBox">',
      '<textarea rows="1" maxlength="4000" dir="auto" aria-label="Message" placeholder="Ask about SEO, AI tools, or this page…"></textarea>',
      '<button class="voiceBtn" type="button" aria-label="Voice input" title="Voice input (Speak in Arabic or English)"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>',
      '<button class="send" type="button" aria-label="Send message" disabled><svg class="sendIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 5 16 7-16 7 2.2-6L14 12l-7.8-1L4 5Z" fill="currentColor"/></svg></button>',
      "</div>",
      '<div class="composerMeta"><span class="hintDesktop">Enter to send · Shift + Enter for new line</span><span class="hintMobile">e-marketing reviews AI Copilot</span><span class="count">0 / 4000</span></div>',
      "</footer>",
      "</section></div>"
    ].join("");

    root.innerHTML = "<style>" + css + "</style>" + markup;

    const shell = root.querySelector(".shell");
    const launcher = root.querySelector(".launcher");
    const panel = root.querySelector(".panel");
    const closeButton = root.querySelector(".closeBtn");
    const clearButton = root.querySelector(".clearBtn");
    const expandButton = root.querySelector(".expandBtn");
    const exportButton = root.querySelector(".exportBtn");
    const toastEl = root.querySelector(".toast");
    const messages = root.querySelector(".messages");
    const textarea = root.querySelector("textarea");
    const voiceButton = root.querySelector(".voiceBtn");
    const sendButton = root.querySelector(".send");
    const sendIcon = root.querySelector(".sendIcon");
    const count = root.querySelector(".count");
    const welcome = root.querySelector(".welcome");
    const contextText = root.querySelector(".contextText");
    const promptsContainer = root.querySelector(".prompts");
    const brandTitle = root.querySelector(".brandTitle");
    const brandSubtitle = root.querySelector(".brandSubtitle");

    brandTitle.textContent = config.title;
    brandSubtitle.textContent = config.subtitle;

    let toastTimer = null;
    function showToast(msg, durationMs) {
      if (!toastEl) return;
      toastEl.textContent = msg;
      toastEl.classList.add("is-visible");
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toastEl.classList.remove("is-visible");
      }, durationMs || 2200);
    }

    const systemTheme = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : { matches: false };

    function syncTheme() {
      host.dataset.theme = detectSiteTheme(systemTheme);
      if (
        !panel.hidden &&
        (document.body.classList.contains("no-scroll") ||
          document.body.classList.contains("pw-roi-modal-open"))
      ) {
        setOpen(false);
      }
    }

    syncTheme();

    const domObserver = new MutationObserver(syncTheme);
    domObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"]
    });
    domObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"]
    });
    if (systemTheme && systemTheme.addEventListener) {
      systemTheme.addEventListener("change", syncTheme);
    }
    window.addEventListener("storage", syncTheme);

    let currentContext = extractPageContext();

    function renderPrompts() {
      currentContext = extractPageContext();
      if (currentContext.isArticle) {
        contextText.textContent = "Article: " + currentContext.title;
      } else if (currentContext.isToolsPage) {
        contextText.textContent = "Page: Free SEO Tools Directory";
      } else {
        contextText.textContent =
          "Site: " + (currentContext.title || "e-marketing reviews");
      }

      const items = currentContext.isArticle
        ? [
            {
              label: "✦ Summarize this article",
              query:
                "Summarize this page into an executive overview, key insights, and practical action steps.",
              primary: true
            },
            {
              label: "Actionable SEO checklist",
              query:
                "Extract a step-by-step actionable implementation checklist from this article."
            },
            {
              label: "Compare tools & methods",
              query:
                "Compare the main tools, frameworks, or strategies discussed on this page."
            },
            {
              label: "Related guides on site",
              query:
                "What other guides on e-marketing reviews should I read next on this topic?"
            }
          ]
        : [
            {
              label: "✦ Summarize this page",
              query:
                "Summarize this page and highlight the most important featured SEO and AI marketing guides.",
              primary: true
            },
            {
              label: "Compare AI SEO tools",
              query:
                "Compare the best AI SEO and keyword research tools with their strengths and best use cases."
            },
            {
              label: "Entity keyword clustering",
              query:
                "How do I build an entity-based keyword clustering strategy for modern AI search?"
            },
            {
              label: "GEO vs traditional SEO",
              query:
                "How do I optimize content for ChatGPT, Gemini, Perplexity, and Google AI Overviews?"
            }
          ];

      promptsContainer.innerHTML = "";
      items.forEach(function (item) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "prompt" + (item.primary ? " primary" : "");
        btn.textContent = item.label;
        btn.addEventListener("click", function () {
          sendMessage(item.query, item.label);
        });
        promptsContainer.appendChild(btn);
      });
    }

    renderPrompts();

    const conversation = [];
    let busy = false;
    let activeAbortController = null;
    let activeStreamStop = null;
    let userScrolledUp = false;

    messages.addEventListener(
      "scroll",
      function () {
        const distFromBottom =
          messages.scrollHeight - messages.scrollTop - messages.clientHeight;
        userScrolledUp = distFromBottom > 68;
      },
      { passive: true }
    );

    // Live Voice Input (Web Speech API)
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;
    let baseTextBeforeSpeech = "";

    if (SpeechRecognition) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = function () {
          listening = true;
          voiceButton.classList.add("is-listening");
          showToast("🎙️ Listening... Speak now", 4000);
        };

        recognition.onresult = function (event) {
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += piece;
            } else {
              interimTranscript += piece;
            }
          }
          const combined = (finalTranscript || interimTranscript).trim();
          if (combined) {
            textarea.value =
              (baseTextBeforeSpeech ? baseTextBeforeSpeech + " " : "") +
              combined;
            resizeInput();
          }
          if (finalTranscript) {
            baseTextBeforeSpeech = textarea.value;
            showToast("✓ Voice captured", 1400);
          }
        };

        recognition.onend = function () {
          listening = false;
          voiceButton.classList.remove("is-listening");
          textarea.focus();
        };

        recognition.onerror = function (event) {
          listening = false;
          voiceButton.classList.remove("is-listening");
          if (event && event.error === "not-allowed") {
            showToast("⚠️ Allow microphone access in browser address bar", 3200);
          } else if (event && event.error === "no-speech") {
            showToast("No speech detected. Try again.", 2200);
          } else {
            showToast("Voice input stopped", 1800);
          }
        };
      } catch (e) {
        recognition = null;
      }
    }

    voiceButton.addEventListener("click", function () {
      if (!recognition) {
        showToast("Voice input requires Chrome, Edge, or Safari", 2800);
        return;
      }
      if (listening) {
        try {
          recognition.stop();
        } catch (e) {}
        return;
      }
      baseTextBeforeSpeech = textarea.value.trim();
      try {
        const hasArabicInChat =
          /[\u0600-\u06FF]/.test(textarea.value) ||
          conversation.some(function (m) {
            return /[\u0600-\u06FF]/.test(m.content || "");
          });
        recognition.lang = hasArabicInChat
          ? "ar-SA"
          : navigator.language || "en-US";
        recognition.start();
      } catch (e) {
        listening = false;
        voiceButton.classList.remove("is-listening");
        showToast("Could not start microphone", 2200);
      }
    });

    function saveSession() {
      try {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(conversation.slice(-8))
        );
      } catch (e) {}
    }

    function setOpen(open) {
      panel.hidden = !open;
      shell.dataset.open = open ? "true" : "false";
      launcher.setAttribute("aria-expanded", String(open));
      if (open) {
        renderPrompts();
        syncTheme();
        window.setTimeout(function () {
          if (window.innerWidth > 640) textarea.focus();
          scrollToBottom(true);
        }, 60);
      }
      try {
        document.dispatchEvent(new CustomEvent("emr:dockchange"));
      } catch (e) {}
    }

    function scrollToBottom(force) {
      if (!force && userScrolledUp) return;
      window.requestAnimationFrame(function () {
        messages.scrollTop = messages.scrollHeight;
      });
    }

    function validSource(source) {
      try {
        const url = new URL(source.url, window.location.href);
        return /^https?:$/.test(url.protocol);
      } catch (error) {
        return false;
      }
    }

    function addInlineText(parent, text) {
      const tokenPattern =
        /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*\s][^*]*\*)/g;
      const parts = String(text || "").split(tokenPattern);
      parts.forEach(function (part) {
        if (!part) return;
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const strong = document.createElement("strong");
          strong.textContent = part.slice(2, -2);
          parent.appendChild(strong);
          return;
        }
        if (
          part.startsWith("*") &&
          part.endsWith("*") &&
          !part.startsWith("**") &&
          part.length > 2
        ) {
          const em = document.createElement("em");
          em.textContent = part.slice(1, -1);
          parent.appendChild(em);
          return;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          const code = document.createElement("code");
          code.textContent = part.slice(1, -1);
          parent.appendChild(code);
          return;
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (linkMatch && validSource({ url: linkMatch[2] })) {
          const anchor = document.createElement("a");
          anchor.href = linkMatch[2];
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer nofollow";
          anchor.textContent = linkMatch[1];
          parent.appendChild(anchor);
          return;
        }
        parent.appendChild(document.createTextNode(part));
      });
    }

    function buildComparisonCards(tableLines) {
      const rows = tableLines
        .map(function (line) {
          return line
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map(function (cell) {
              return cell.trim();
            });
        })
        .filter(function (cells) {
          return (
            cells.length > 1 &&
            !cells.every(function (c) {
              return /^[:-\s]+$/.test(c);
            })
          );
        });
      if (rows.length < 2) return null;

      const headers = rows[0];
      const container = document.createElement("div");
      rows.slice(1).forEach(function (rowCells) {
        if (!rowCells.some(Boolean)) return;
        const card = document.createElement("div");
        card.className = "compareCard";
        const title = document.createElement("div");
        title.className = "compareCardTitle";
        addInlineText(title, rowCells[0] || "Item");
        card.appendChild(title);

        for (let i = 1; i < rowCells.length; i += 1) {
          const val = rowCells[i];
          if (!val) continue;
          const line = document.createElement("div");
          line.className = "compareCardRow";
          const label = headers[i] ? headers[i] + ": " : "";
          if (label) {
            const b = document.createElement("strong");
            b.textContent = label;
            line.appendChild(b);
          }
          addInlineText(line, val);
          card.appendChild(line);
        }
        container.appendChild(card);
      });
      return container;
    }

    function appendCodeBlock(rich, codeLines, lang) {
      const block = document.createElement("div");
      block.className = "codeBlock";
      const header = document.createElement("div");
      header.className = "codeHeader";
      const langSpan = document.createElement("span");
      langSpan.textContent = lang || "code";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "codeCopyBtn";
      copyBtn.textContent = "Copy";
      const rawCode = codeLines.join("\n");
      copyBtn.addEventListener("click", function () {
        copyTextGuaranteed(rawCode).then(function (ok) {
          if (!ok) return;
          copyBtn.textContent = "Copied ✓";
          showToast("✓ Code copied to clipboard", 1500);
          window.setTimeout(function () {
            copyBtn.textContent = "Copy";
          }, 1300);
        });
      });
      header.appendChild(langSpan);
      header.appendChild(copyBtn);
      const pre = document.createElement("pre");
      pre.textContent = rawCode;
      block.appendChild(header);
      block.appendChild(pre);
      rich.appendChild(block);
    }

    function renderText(container, text, showStreamingCursor) {
      container.innerHTML = "";
      const rich = document.createElement("div");
      rich.className = "rich";
      rich.setAttribute("dir", "auto");

      const lines = String(text || "").replace(/\r/g, "").split("\n");
      let inCodeBlock = false;
      let codeLang = "";
      let codeLines = [];
      let tableLines = [];
      let lastTextTarget = null;

      function flushTable() {
        if (!tableLines.length) return;
        const cardsEl = buildComparisonCards(tableLines);
        if (cardsEl) {
          rich.appendChild(cardsEl);
          lastTextTarget = cardsEl;
        } else {
          tableLines.forEach(function (l) {
            const p = document.createElement("p");
            addInlineText(p, l);
            rich.appendChild(p);
            lastTextTarget = p;
          });
        }
        tableLines = [];
      }

      lines.forEach(function (rawLine) {
        const trimmed = rawLine.trim();
        if (trimmed.startsWith("```")) {
          flushTable();
          if (inCodeBlock) {
            appendCodeBlock(rich, codeLines, codeLang);
            codeLines = [];
            codeLang = "";
            inCodeBlock = false;
          } else {
            inCodeBlock = true;
            codeLang = trimmed.slice(3).trim();
          }
          return;
        }
        if (inCodeBlock) {
          codeLines.push(rawLine);
          return;
        }

        if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
          tableLines.push(trimmed);
          return;
        } else {
          flushTable();
        }

        if (!trimmed) return;

        if (/^#{1,4}\s+/.test(trimmed)) {
          const heading = document.createElement("p");
          heading.className = "heading";
          addInlineText(heading, trimmed.replace(/^#{1,4}\s+/, ""));
          rich.appendChild(heading);
          lastTextTarget = heading;
          return;
        }

        if (/^>\s+/.test(trimmed)) {
          const quote = document.createElement("blockquote");
          addInlineText(quote, trimmed.replace(/^>\s+/, ""));
          rich.appendChild(quote);
          lastTextTarget = quote;
          return;
        }

        const numberedMatch = trimmed.match(/^(\d+[.)])\s+(.+)$/);
        if (numberedMatch) {
          const item = document.createElement("div");
          item.className = "listLine";
          const bullet = document.createElement("span");
          bullet.className = "bullet";
          bullet.textContent = numberedMatch[1];
          const body = document.createElement("span");
          body.className = "listBody";
          addInlineText(body, numberedMatch[2]);
          item.appendChild(bullet);
          item.appendChild(body);
          rich.appendChild(item);
          lastTextTarget = body;
          return;
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
          const item = document.createElement("div");
          item.className = "listLine";
          const bullet = document.createElement("span");
          bullet.className = "bullet";
          bullet.textContent = "•";
          const body = document.createElement("span");
          body.className = "listBody";
          addInlineText(body, bulletMatch[1]);
          item.appendChild(bullet);
          item.appendChild(body);
          rich.appendChild(item);
          lastTextTarget = body;
          return;
        }

        const paragraph = document.createElement("p");
        addInlineText(paragraph, trimmed);
        rich.appendChild(paragraph);
        lastTextTarget = paragraph;
      });

      flushTable();
      if (codeLines.length) {
        appendCodeBlock(rich, codeLines, codeLang);
      }

      if (showStreamingCursor) {
        const cursor = document.createElement("span");
        cursor.className = "streamCursor";
        cursor.setAttribute("aria-hidden", "true");
        if (lastTextTarget) {
          lastTextTarget.appendChild(cursor);
        } else {
          const p = document.createElement("p");
          p.appendChild(cursor);
          rich.appendChild(p);
        }
      }

      container.appendChild(rich);
    }

    let activeSpeechBtn = null;
    function speakText(text, buttonEl) {
      if (!("speechSynthesis" in window)) {
        showToast("Audio playback is not supported in this browser", 2400);
        return;
      }
      if (window.speechSynthesis.speaking || activeSpeechBtn === buttonEl) {
        window.speechSynthesis.cancel();
        if (activeSpeechBtn) {
          activeSpeechBtn.classList.remove("is-active");
          activeSpeechBtn.querySelector("span").textContent = "Listen";
        }
        if (activeSpeechBtn === buttonEl) {
          activeSpeechBtn = null;
          showToast("Audio stopped", 1200);
          return;
        }
      }

      const clean = String(text || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*#`_~>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!clean) return;

      window.speechSynthesis.cancel();
      if (window.speechSynthesis.resume) window.speechSynthesis.resume();

      const utter = new SpeechSynthesisUtterance(clean.slice(0, 1400));
      utter.lang = /[\u0600-\u06FF]/.test(clean) ? "ar-SA" : "en-US";
      utter.rate = 1.0;

      activeSpeechBtn = buttonEl;
      buttonEl.classList.add("is-active");
      buttonEl.querySelector("span").textContent = "Stop";
      showToast("🔊 Playing audio response...", 1800);

      utter.onend = function () {
        buttonEl.classList.remove("is-active");
        buttonEl.querySelector("span").textContent = "Listen";
        if (activeSpeechBtn === buttonEl) activeSpeechBtn = null;
      };
      utter.onerror = function () {
        buttonEl.classList.remove("is-active");
        buttonEl.querySelector("span").textContent = "Listen";
        if (activeSpeechBtn === buttonEl) activeSpeechBtn = null;
      };
      window.speechSynthesis.speak(utter);
    }

    function attachBotExtras(row, wrap, bubble, finalText, sources, followUps) {
      if (Array.isArray(sources) && sources.length) {
        const sourceBox = document.createElement("div");
        sourceBox.className = "sources";
        const label = document.createElement("div");
        label.className = "sourcesLabel";
        label.textContent = "Recommended reading";
        sourceBox.appendChild(label);
        sources.filter(validSource).slice(0, 4).forEach(function (source) {
          const link = document.createElement("a");
          link.className = "source";
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer nofollow";
          const icon = document.createElement("span");
          icon.className = "sourceIcon";
          icon.textContent = "↗";
          const title = document.createElement("span");
          title.textContent = source.title;
          link.appendChild(icon);
          link.appendChild(title);
          sourceBox.appendChild(link);
        });
        if (sourceBox.children.length > 1) bubble.appendChild(sourceBox);
      }

      const meta = document.createElement("div");
      meta.className = "meta";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "msgAction";
      copyButton.title = "Copy response";
      copyButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.8"/></svg><span>Copy</span>';
      copyButton.addEventListener("click", function () {
        copyTextGuaranteed(finalText).then(function (ok) {
          if (!ok) {
            showToast("Could not copy text", 1500);
            return;
          }
          copyButton.classList.add("is-active");
          copyButton.querySelector("span").textContent = "Copied ✓";
          showToast("✓ Response copied to clipboard", 1600);
          window.setTimeout(function () {
            copyButton.classList.remove("is-active");
            copyButton.querySelector("span").textContent = "Copy";
          }, 1400);
        });
      });
      meta.appendChild(copyButton);

      const listenButton = document.createElement("button");
      listenButton.type = "button";
      listenButton.className = "msgAction";
      listenButton.title = "Read response aloud";
      listenButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>Listen</span>';
      listenButton.addEventListener("click", function () {
        speakText(finalText, listenButton);
      });
      meta.appendChild(listenButton);

      const regenButton = document.createElement("button");
      regenButton.type = "button";
      regenButton.className = "msgAction";
      regenButton.title = "Regenerate answer";
      regenButton.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Retry</span>';
      regenButton.addEventListener("click", function () {
        if (busy) return;
        let lastUserMsg = "";
        for (let i = conversation.length - 1; i >= 0; i -= 1) {
          if (conversation[i].role === "user") {
            lastUserMsg = conversation[i].content;
            break;
          }
        }
        if (lastUserMsg) {
          row.remove();
          if (
            conversation.length &&
            conversation[conversation.length - 1].role === "assistant"
          ) {
            conversation.pop();
          }
          if (
            conversation.length &&
            conversation[conversation.length - 1].role === "user"
          ) {
            conversation.pop();
          }
          showToast("↻ Regenerating response...", 1400);
          sendMessage(lastUserMsg);
        }
      });
      meta.appendChild(regenButton);
      wrap.appendChild(meta);

      if (Array.isArray(followUps) && followUps.length) {
        const followupBox = document.createElement("div");
        followupBox.className = "followups";
        followUps.slice(0, 3).forEach(function (q) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "followup";
          btn.textContent = "↳ " + q;
          btn.addEventListener("click", function () {
            followupBox.remove();
            sendMessage(q);
          });
          followupBox.appendChild(btn);
        });
        wrap.appendChild(followupBox);
      }
    }

    function appendMessage(text, sender, sources, followUps, persist) {
      const row = document.createElement("div");
      row.className = "row " + sender;
      const wrap = document.createElement("div");
      wrap.className = "messageWrap";
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      renderText(bubble, text, false);
      wrap.appendChild(bubble);

      if (sender === "bot") {
        attachBotExtras(row, wrap, bubble, text, sources, followUps);
      }

      row.appendChild(wrap);
      messages.appendChild(row);
      if (persist !== false) scrollToBottom(true);
      return row;
    }

    // Live Progressive Typewriter Streaming with smooth line-by-line auto-scroll
    function streamBotMessage(fullText, sources, followUps) {
      return new Promise(function (resolve) {
        const row = document.createElement("div");
        row.className = "row bot";
        const wrap = document.createElement("div");
        wrap.className = "messageWrap";
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        wrap.appendChild(bubble);
        row.appendChild(wrap);
        messages.appendChild(row);

        const tokens = String(fullText || "").match(/\S+\s*|\n+/g) || [
          String(fullText || "")
        ];
        const totalTokens = tokens.length;
        // Adaptive words-per-tick so user watches every word and line type out smoothly in real time
        const step = totalTokens > 260 ? 3 : totalTokens > 130 ? 2 : 1;
        let idx = 0;
        let shownText = "";
        let finished = false;
        let timerId = null;

        function finishStream(cancelled) {
          if (finished) return;
          finished = true;
          if (timerId) window.clearInterval(timerId);
          activeStreamStop = null;
          const finalContent = cancelled
            ? (shownText.trim() || fullText)
            : fullText;
          renderText(bubble, finalContent, false);
          attachBotExtras(
            row,
            wrap,
            bubble,
            finalContent,
            cancelled ? [] : sources,
            cancelled ? [] : followUps
          );
          if (!userScrolledUp) {
            scrollToBottom(false);
          }
          resolve(finalContent);
        }

        activeStreamStop = function () {
          finishStream(true);
        };

        // Render initial cursor frame immediately
        renderText(bubble, "", true);
        scrollToBottom(false);

        timerId = window.setInterval(function () {
          if (finished) return;
          const nextEnd = Math.min(totalTokens, idx + step);
          for (let i = idx; i < nextEnd; i += 1) {
            shownText += tokens[i];
          }
          idx = nextEnd;

          if (idx >= totalTokens) {
            finishStream(false);
            return;
          }

          renderText(bubble, shownText, true);
          if (!userScrolledUp) {
            messages.scrollTop = messages.scrollHeight;
          }
        }, 22);
      });
    }

    function restoreSession() {
      try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved) || !saved.length) return;
        if (welcome && welcome.isConnected) welcome.remove();
        saved.slice(-8).forEach(function (item) {
          if (!item || typeof item.content !== "string") return;
          const role = item.role === "user" ? "user" : "bot";
          conversation.push({
            role: item.role === "user" ? "user" : "assistant",
            content: item.content,
            sources: item.sources || []
          });
          appendMessage(item.content, role, item.sources || [], [], false);
        });
      } catch (e) {}
    }

    restoreSession();

    function showTyping() {
      const row = document.createElement("div");
      row.className = "row bot";
      row.id = "emr-typing";
      row.innerHTML =
        '<div class="messageWrap"><div class="bubble typing" aria-label="Assistant is thinking"><i></i><i></i><i></i></div></div>';
      messages.appendChild(row);
      scrollToBottom(true);
    }

    function hideTyping() {
      const typing = root.getElementById("emr-typing");
      if (typing) typing.remove();
    }

    function updateSendButtonState() {
      if (busy) {
        sendButton.disabled = false;
        sendButton.classList.add("is-stop");
        sendButton.setAttribute("aria-label", "Stop generating");
        sendButton.title = "Stop generating";
        sendIcon.innerHTML =
          '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>';
      } else {
        sendButton.classList.remove("is-stop");
        sendButton.setAttribute("aria-label", "Send message");
        sendButton.title = "Send message";
        sendIcon.innerHTML =
          '<path d="m4 5 16 7-16 7 2.2-6L14 12l-7.8-1L4 5Z" fill="currentColor"/>';
        sendButton.disabled = !textarea.value.trim();
      }
    }

    function resizeInput() {
      textarea.style.height = "34px";
      textarea.style.height = Math.min(textarea.scrollHeight, 92) + "px";
      const length = textarea.value.length;
      count.textContent = length + " / 4000";
      count.classList.toggle("warning", length > 3600);
      updateSendButtonState();
    }

    function friendlyError(error) {
      if (error && error.userCancelled) {
        return "Generation stopped.";
      }
      if (error && error.name === "AbortError") {
        return "The request took too long. Please check your connection and try again.";
      }
      if (error && error.status === 429) {
        return "The assistant is receiving many requests right now. Please wait a few seconds and try again.";
      }
      if (error && error.status === 503) {
        return "The AI service is briefly unavailable. Please try again in a moment.";
      }
      return "I could not connect to the assistant. Please check your connection and try again.";
    }

    function delay(milliseconds) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, milliseconds);
      });
    }

    async function requestAnswer(message, history) {
      const retryable = [429, 502, 503, 504];
      const pageCtx = extractPageContext();
      const enrichedMessage =
        pageCtx.isArticle &&
        /\b(this\s+(page|article|post|guide)|summarize|checklist|discussed\s+on\s+this)\b|(هذه\s+الصفحة|هذا\s+المقال|لخص)/i.test(
          message
        )
          ? message +
            "\n\n[Current Article Context — Title: " +
            pageCtx.title +
            " | URL: " +
            pageCtx.url +
            " | Headings: " +
            pageCtx.headings.slice(0, 8).join("; ") +
            " | Content Excerpt: " +
            pageCtx.excerpt.slice(0, 1800) +
            "]"
          : message;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        activeAbortController = controller;
        const timer = window.setTimeout(function () {
          controller.abort();
        }, 35000);
        try {
          const response = await fetch(config.apiUrl, {
            method: "POST",
            mode: "cors",
            credentials: "omit",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({
              message: enrichedMessage.slice(0, 3900),
              history: history.map(function (h) {
                return { role: h.role, content: h.content };
              }),
              page_context: {
                url: pageCtx.url,
                title: pageCtx.title,
                excerpt: pageCtx.excerpt,
                category: pageCtx.category,
                headings: pageCtx.headings,
                recent_posts: pageCtx.recent_posts
              }
            }),
            signal: controller.signal
          });
          let data = {};
          try {
            data = await response.json();
          } catch (parseError) {
            data = {};
          }
          if (!response.ok) {
            const requestError = new Error("Request failed");
            requestError.status = response.status;
            if (attempt === 0 && retryable.indexOf(response.status) !== -1) {
              await delay(700);
              continue;
            }
            throw requestError;
          }
          if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
            throw new Error("Invalid assistant response");
          }
          return data;
        } finally {
          window.clearTimeout(timer);
          activeAbortController = null;
        }
      }
      throw new Error("Request failed");
    }

    async function sendMessage(prefilled, displayLabel) {
      if (busy) return;
      const text = String(prefilled || textarea.value).trim();
      if (!text) return;

      const shownUserText = String(displayLabel || text).trim();
      const history = conversation.slice(-8);
      busy = true;
      userScrolledUp = false;
      textarea.value = "";
      resizeInput();
      if (welcome && welcome.isConnected) welcome.remove();
      messages.querySelectorAll(".followups").forEach(function (el) {
        el.remove();
      });
      appendMessage(shownUserText, "user", [], []);
      conversation.push({ role: "user", content: shownUserText });
      saveSession();
      showTyping();

      try {
        const data = await requestAnswer(text, history);
        hideTyping();
        const sources = data.sources || [];
        const followUps = data.follow_ups || [];
        const streamedText = await streamBotMessage(
          data.reply,
          sources,
          followUps
        );
        conversation.push({
          role: "assistant",
          content: streamedText,
          sources: sources
        });
        saveSession();
      } catch (error) {
        hideTyping();
        appendMessage(friendlyError(error), "bot", [], []);
      } finally {
        busy = false;
        activeStreamStop = null;
        resizeInput();
        if (window.innerWidth > 640) textarea.focus();
      }
    }

    exportButton.addEventListener("click", function () {
      const pageCtx = extractPageContext();
      const lines = [
        "# e-marketing reviews AI Copilot — Research Notes",
        "- **Page:** " + pageCtx.title,
        "- **URL:** " + pageCtx.url,
        ""
      ];
      if (!conversation.length) {
        lines.push(
          "## Page Overview\n\n" +
            (pageCtx.excerpt || "No conversation messages yet.")
        );
      } else {
        conversation.forEach(function (item) {
          lines.push(
            (item.role === "user" ? "## Question" : "## AI Copilot") +
              "\n\n" +
              item.content +
              "\n"
          );
        });
      }
      const blob = new Blob([lines.join("\n")], {
        type: "text/markdown;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "e-marketing-reviews-ai-notes.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("✓ Research notes downloaded (.md)", 1800);
    });

    launcher.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    closeButton.addEventListener("click", function () {
      setOpen(false);
    });
    expandButton.addEventListener("click", function () {
      const wide = panel.classList.toggle("is-wide");
      showToast(wide ? "Expanded view" : "Compact view", 1200);
    });
    clearButton.addEventListener("click", function () {
      if (activeStreamStop) {
        activeStreamStop();
      }
      if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      conversation.length = 0;
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      messages.querySelectorAll(".row").forEach(function (row) {
        row.remove();
      });
      renderPrompts();
      if (welcome && !welcome.isConnected) messages.prepend(welcome);
      textarea.value = "";
      resizeInput();
      showToast("Started a new conversation", 1400);
      if (window.innerWidth > 640) textarea.focus();
    });
    textarea.addEventListener("input", resizeInput);
    textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    sendButton.addEventListener("click", function () {
      if (busy) {
        if (activeStreamStop) {
          activeStreamStop();
          return;
        }
        if (activeAbortController) {
          activeAbortController.userCancelled = true;
          activeAbortController.abort();
          return;
        }
      }
      sendMessage();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });
    resizeInput();

    try {
      document.dispatchEvent(new CustomEvent("emr:ai-ready"));
    } catch (e) {}

    window.EMarketingAI = {
      open: function () {
        setOpen(true);
      },
      close: function () {
        setOpen(false);
      },
      toggle: function () {
        setOpen(panel.hidden);
      },
      ask: function (question) {
        setOpen(true);
        if (question) sendMessage(String(question));
      },
      refreshContext: renderPrompts
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
