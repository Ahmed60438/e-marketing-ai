(function () {
  "use strict";

  if (window.__EMR_AI_WIDGET_LOADED__) return;
  window.__EMR_AI_WIDGET_LOADED__ = true;

  const sourceScript = document.currentScript;
  const scriptOrigin = sourceScript && sourceScript.src
    ? new URL(sourceScript.src, window.location.href).origin
    : window.location.origin;
  const userConfig = window.EMARKETING_AI_CONFIG || {};
  const config = Object.assign(
    {
      apiUrl: window.EMARKETING_AI_URL || scriptOrigin + "/api/chat",
      position: "left",
      title: "e-marketing reviews AI",
      subtitle: "Marketing research assistant",
      accent: "#6d5dfc"
    },
    userConfig
  );
  config.title = "e-marketing reviews AI";

  function initialise() {
    if (!document.body || document.getElementById("emr-ai-widget-host")) return;

    const host = document.createElement("div");
    host.id = "emr-ai-widget-host";
    host.style.setProperty("--emr-accent", config.accent);
    host.dataset.position = config.position === "right" ? "right" : "left";
    document.body.appendChild(host);

    const root = host.attachShadow({ mode: "open" });
    const css = [
      ":host{all:initial;color-scheme:light dark}",
      "*,*::before,*::after{box-sizing:border-box}",
      "button,textarea{font:inherit}",
      ".shell{--bg:#fff;--panel:#f7f8fc;--card:#fff;--text:#182033;--muted:#697386;--line:#e7eaf1;--soft:#f0efff;--user:#6656f5;--userText:#fff;--shadow:0 24px 70px rgba(26,32,56,.22),0 6px 20px rgba(26,32,56,.1);--launcher-bg:linear-gradient(145deg,#fff,#f1f3ff);--launcher-color:var(--emr-accent,#6255ed);--launcher-border:rgba(98,85,237,.18);--launcher-dot-border:#fff;--launcher-shadow:0 10px 25px rgba(72,76,151,.18),0 3px 9px rgba(31,38,72,.1),inset 0 1px 0 rgba(255,255,255,.92);--launcher-hover-shadow:0 14px 30px rgba(72,76,151,.24),0 5px 12px rgba(31,38,72,.12),inset 0 1px 0 rgba(255,255,255,.95);position:fixed;z-index:2147483000;bottom:max(20px,env(safe-area-inset-bottom));left:20px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:var(--text);direction:ltr;text-align:left}",
      ":host([data-position=right]) .shell{left:auto;right:20px}",
      ".launcher{position:relative;width:50px;height:50px;border:1px solid var(--launcher-border);border-radius:16px;display:grid;place-items:center;color:var(--launcher-color);cursor:pointer;background:var(--launcher-bg);box-shadow:var(--launcher-shadow);isolation:isolate;overflow:hidden;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}",
      ".launcher::before{content:\"\";position:absolute;inset:3px;z-index:-1;border-radius:12px;background:radial-gradient(circle at 28% 20%,rgba(255,255,255,.8),transparent 48%);opacity:.78;pointer-events:none}",
      ".launcher:hover{transform:translateY(-2px) scale(1.02);border-color:color-mix(in srgb,var(--launcher-color) 36%,transparent);box-shadow:var(--launcher-hover-shadow)}",
      ".launcher:active{transform:translateY(0) scale(.97)}",
      ".launcher:focus-visible,.iconBtn:focus-visible,.send:focus-visible,.prompt:focus-visible,.copy:focus-visible,textarea:focus-visible{outline:3px solid rgba(109,93,252,.26);outline-offset:2px}",
      ".launcher svg{width:23px;height:23px;filter:drop-shadow(0 1px 1px rgba(69,61,170,.12))}",
      ".launcherDot{position:absolute;right:1px;top:1px;width:10px;height:10px;border:2.5px solid var(--launcher-dot-border);border-radius:50%;background:#22c55e;box-shadow:0 2px 6px rgba(34,197,94,.32)}",
      ".panel{position:absolute;left:0;bottom:68px;width:min(394px,calc(100vw - 32px));height:min(620px,calc(100dvh - 104px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(225,228,238,.94);border-radius:24px;background:var(--bg);box-shadow:var(--shadow);transform-origin:bottom left;animation:emrOpen .24s cubic-bezier(.22,1,.36,1)}",
      ":host([data-position=right]) .panel{left:auto;right:0;transform-origin:bottom right}",
      ".panel[hidden]{display:none}",
      "@keyframes emrOpen{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}",
      ".header{position:relative;display:flex;align-items:center;gap:11px;min-height:76px;padding:15px 14px 14px 16px;color:#fff;background:radial-gradient(circle at 12% -20%,rgba(255,255,255,.27),transparent 38%),linear-gradient(125deg,#171d35,#303a70 58%,#4d4fd8)}",
      ".brandMark{width:40px;height:40px;display:grid;place-items:center;flex:0 0 auto;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}",
      ".brandMark svg{width:23px;height:23px}",
      ".brand{min-width:0;flex:1}",
      ".brand strong{display:block;overflow:hidden;font-size:14px;font-weight:750;letter-spacing:-.01em;text-overflow:ellipsis;white-space:nowrap}",
      ".status{display:flex;align-items:center;gap:6px;margin-top:4px;color:#cbd3f8;font-size:11.5px}",
      ".statusDot{width:7px;height:7px;border-radius:50%;background:#38d58a;box-shadow:0 0 0 4px rgba(56,213,138,.13)}",
      ".headerActions{display:flex;gap:3px}",
      ".iconBtn{width:35px;height:35px;border:0;border-radius:11px;display:grid;place-items:center;color:#dce2ff;background:transparent;cursor:pointer;transition:background .18s ease,color .18s ease}",
      ".iconBtn:hover{color:#fff;background:rgba(255,255,255,.12)}",
      ".iconBtn svg{width:18px;height:18px}",
      ".messages{flex:1;min-height:0;padding:18px 15px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;background:linear-gradient(180deg,var(--panel),var(--bg) 56%);scrollbar-width:thin;scrollbar-color:#c8cedc transparent}",
      ".messages::-webkit-scrollbar{width:6px}.messages::-webkit-scrollbar-thumb{border-radius:9px;background:#c8cedc}",
      ".welcome{margin:0 0 14px;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:0 5px 18px rgba(30,41,78,.05)}",
      ".welcomeTitle{display:flex;align-items:center;gap:8px;margin:0 0 7px;font-size:14px;font-weight:750}",
      ".spark{width:25px;height:25px;display:grid;place-items:center;border-radius:9px;color:#6153e9;background:var(--soft)}",
      ".welcome p{margin:0;color:var(--muted);font-size:12.5px;line-height:1.58}",
      ".prompts{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}",
      ".prompt{border:1px solid var(--line);border-radius:999px;padding:7px 10px;color:var(--text);background:var(--bg);cursor:pointer;font-size:11.5px;transition:border-color .18s ease,background .18s ease,transform .18s ease}",
      ".prompt:hover{border-color:#bdb7ff;background:var(--soft);transform:translateY(-1px)}",
      ".row{display:flex;margin:0 0 13px;animation:emrMessage .2s ease both}",
      "@keyframes emrMessage{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}",
      ".row.user{justify-content:flex-end}",
      ".messageWrap{max-width:88%}",
      ".bubble{border-radius:18px;padding:11px 13px;font-size:13px;line-height:1.58;overflow-wrap:anywhere}",
      ".bot .bubble{border:1px solid var(--line);border-bottom-left-radius:6px;color:var(--text);background:var(--card);box-shadow:0 4px 14px rgba(30,41,78,.045)}",
      ".user .bubble{border-bottom-right-radius:6px;color:var(--userText);background:linear-gradient(145deg,var(--user),#4e76ed);box-shadow:0 7px 18px rgba(84,82,231,.22)}",
      ".rich p{margin:0 0 8px}.rich p:last-child{margin-bottom:0}",
      ".rich .heading{margin:3px 0 7px;font-weight:750}",
      ".rich .listLine{display:flex;gap:8px;margin:3px 0}",
      ".rich .bullet{color:#6d5dfc;font-weight:800}",
      ".rich strong{font-weight:750}",
      ".meta{display:flex;align-items:center;gap:5px;min-height:24px;margin-top:4px;color:var(--muted);font-size:10.5px}",
      ".bot .meta{padding-left:4px}.user .meta{justify-content:flex-end;padding-right:4px}",
      ".copy{width:25px;height:23px;border:0;border-radius:7px;display:grid;place-items:center;color:var(--muted);background:transparent;cursor:pointer}",
      ".copy:hover{color:var(--text);background:var(--panel)}",
      ".copy svg{width:14px;height:14px}",
      ".sources{display:grid;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}",
      ".sourcesLabel{color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}",
      ".source{display:flex;align-items:center;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:11px;color:#4f55c7;background:var(--panel);text-decoration:none;font-size:11.5px;line-height:1.35;transition:border-color .18s ease,transform .18s ease}",
      ".source:hover{border-color:#bdb7ff;transform:translateY(-1px)}",
      ".sourceIcon{width:22px;height:22px;display:grid;place-items:center;flex:0 0 auto;border-radius:7px;color:#6459ef;background:var(--soft)}",
      ".typing{display:flex;align-items:center;gap:5px;min-width:52px}",
      ".typing i{width:6px;height:6px;border-radius:50%;background:#8a93a7;animation:emrTyping 1.2s infinite ease-in-out}",
      ".typing i:nth-child(2){animation-delay:.14s}.typing i:nth-child(3){animation-delay:.28s}",
      "@keyframes emrTyping{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}",
      ".composer{padding:11px 12px max(12px,env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--bg)}",
      ".inputBox{display:flex;align-items:flex-end;gap:8px;padding:7px 7px 7px 12px;border:1px solid var(--line);border-radius:17px;background:var(--card);box-shadow:0 3px 14px rgba(30,41,78,.04);transition:border-color .18s ease,box-shadow .18s ease}",
      ".inputBox:focus-within{border-color:#aea6ff;box-shadow:0 0 0 4px rgba(109,93,252,.09)}",
      "textarea{width:100%;height:38px;max-height:104px;resize:none;border:0;outline:0;padding:8px 0;color:var(--text);background:transparent;font-size:13px;line-height:1.45}",
      "textarea::placeholder{color:#929aad}",
      ".send{width:38px;height:38px;border:0;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;color:#fff;background:linear-gradient(145deg,var(--emr-accent,#6d5dfc),#3977ef);box-shadow:0 6px 14px rgba(93,82,235,.26);cursor:pointer;transition:transform .18s ease,opacity .18s ease}",
      ".send:hover:not(:disabled){transform:translateY(-1px)}",
      ".send:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}",
      ".send svg{width:18px;height:18px}",
      ".composerMeta{display:flex;justify-content:space-between;gap:10px;padding:6px 4px 0;color:var(--muted);font-size:9.5px}",
      ".count.warning{color:#df7a25}",
      ":host([data-theme=dark]) .shell{--bg:#121627;--panel:#0d1120;--card:#181d30;--text:#f2f4fb;--muted:#9ca6bb;--line:#2a3045;--soft:#262447;--user:#7364ff;--shadow:0 28px 80px rgba(0,0,0,.58),0 8px 24px rgba(0,0,0,.35);--launcher-bg:linear-gradient(145deg,#242b43,#171b2e);--launcher-color:#aeb6ff;--launcher-border:rgba(174,182,255,.2);--launcher-dot-border:#171b2e;--launcher-shadow:0 12px 28px rgba(0,0,0,.42),0 3px 10px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.08);--launcher-hover-shadow:0 15px 34px rgba(0,0,0,.5),0 5px 14px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.1)}",
      ":host([data-theme=dark]) .panel{border-color:#2c3248}",
      ":host([data-theme=dark]) .prompt{background:#171c2d}",
      ":host([data-theme=dark]) .source{color:#b9b8ff}",
      "@media(max-width:600px){.shell{left:12px;bottom:max(12px,env(safe-area-inset-bottom))}:host([data-position=right]) .shell{right:12px}.panel{position:fixed;left:12px;right:12px;bottom:72px;width:auto;height:min(680px,calc(100dvh - 90px));border-radius:22px}:host([data-position=right]) .panel{left:12px;right:12px}.launcher{width:48px;height:48px;border-radius:15px}.launcher svg{width:22px;height:22px}.messages{padding:15px 12px}}",
      "@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}"
    ].join("");

    const markup = [
      '<div class="shell">',
      '<button class="launcher" type="button" aria-label="Open e-marketing reviews AI" title="e-marketing reviews AI" aria-expanded="false">',
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.4 4.2h7.2A4.4 4.4 0 0 1 20 8.6v3.8a4.4 4.4 0 0 1-4.4 4.4h-4.4L6 20v-3.5a4.4 4.4 0 0 1-2-3.7V8.6a4.4 4.4 0 0 1 4.4-4.4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m12 7 .7 2.1L15 10l-2.3.8L12 13l-.8-2.2L9 10l2.2-.9L12 7Z" fill="currentColor"/></svg>',
      '<span class="launcherDot" aria-hidden="true"></span>',
      '</button>',
      '<section class="panel" role="dialog" aria-modal="false" aria-label="e-marketing reviews AI assistant" hidden>',
      '<header class="header">',
      '<div class="brandMark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 1.6 4.7L18 9.4l-4.4 1.7L12 16l-1.7-4.9L6 9.4l4.3-1.7L12 3Z" fill="currentColor"/><path d="m18.7 15 .7 2 1.9.8-1.9.7-.7 2.1-.8-2.1-1.9-.7 1.9-.8.8-2Z" fill="currentColor" opacity=".72"/></svg></div>',
      '<div class="brand"><strong class="brandTitle"></strong><div class="status"><span class="statusDot"></span><span class="brandSubtitle"></span></div></div>',
      '<div class="headerActions">',
      '<button class="iconBtn clearBtn" type="button" aria-label="Start a new conversation" title="New conversation"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
      '<button class="iconBtn closeBtn" type="button" aria-label="Close assistant"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
      '</div></header>',
      '<main class="messages" aria-live="polite" aria-relevant="additions">',
      '<section class="welcome">',
      '<div class="welcomeTitle"><span class="spark">✦</span><span>How can I help?</span></div>',
      '<p>Ask about SEO, AI tools, keyword research, software comparisons, or any guide published on e-marketing reviews.</p>',
      '<div class="prompts">',
      '<button class="prompt" type="button">Compare AI SEO tools</button>',
      '<button class="prompt" type="button">Improve my keyword strategy</button>',
      '<button class="prompt" type="button">Find the right marketing tool</button>',
      '</div></section>',
      '</main>',
      '<footer class="composer">',
      '<div class="inputBox">',
      '<textarea rows="1" maxlength="4000" aria-label="Message" placeholder="Ask about marketing or AI tools…"></textarea>',
      '<button class="send" type="button" aria-label="Send message" disabled><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 5 16 7-16 7 2.2-6L14 12l-7.8-1L4 5Z" fill="currentColor"/></svg></button>',
      '</div>',
      '<div class="composerMeta"><span>Enter to send · Shift + Enter for a new line</span><span class="count">0 / 4000</span></div>',
      '</footer>',
      '</section></div>'
    ].join("");

    root.innerHTML = "<style>" + css + "</style>" + markup;

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

    function syncTheme() {
      const html = document.documentElement;
      const body = document.body;
      const themeHints = [
        html.getAttribute("data-theme"),
        html.getAttribute("data-color-scheme"),
        html.getAttribute("data-bs-theme"),
        body && body.getAttribute("data-theme"),
        body && body.getAttribute("data-color-scheme"),
        body && body.getAttribute("data-bs-theme"),
        html.className,
        body && body.className
      ].filter(Boolean).join(" ").toLowerCase();

      if (/(^|[\s_-])(dark|night)(?=$|[\s_-])/.test(themeHints)) {
        host.dataset.theme = "dark";
      } else if (/(^|[\s_-])(light|day)(?=$|[\s_-])/.test(themeHints)) {
        host.dataset.theme = "light";
      } else {
        host.dataset.theme = systemTheme.matches ? "dark" : "light";
      }
    }

    syncTheme();
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-color-scheme", "data-bs-theme"]
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-color-scheme", "data-bs-theme"]
    });
    if (systemTheme.addEventListener) systemTheme.addEventListener("change", syncTheme);

    const launcher = root.querySelector(".launcher");
    const panel = root.querySelector(".panel");
    const closeButton = root.querySelector(".closeBtn");
    const clearButton = root.querySelector(".clearBtn");
    const messages = root.querySelector(".messages");
    const textarea = root.querySelector("textarea");
    const sendButton = root.querySelector(".send");
    const count = root.querySelector(".count");
    const welcome = root.querySelector(".welcome");
    const brandTitle = root.querySelector(".brandTitle");
    const brandSubtitle = root.querySelector(".brandSubtitle");
    const conversation = [];
    let busy = false;

    brandTitle.textContent = config.title;
    brandSubtitle.textContent = config.subtitle;

    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      launcher.setAttribute("aria-label", open ? "Close e-marketing reviews AI" : "Open e-marketing reviews AI");
      if (open) window.setTimeout(function () { textarea.focus(); }, 80);
    }

    function scrollToBottom() {
      window.requestAnimationFrame(function () {
        messages.scrollTop = messages.scrollHeight;
      });
    }

    function addInlineText(parent, text) {
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      parts.forEach(function (part) {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const strong = document.createElement("strong");
          strong.textContent = part.slice(2, -2);
          parent.appendChild(strong);
        } else if (part) {
          parent.appendChild(document.createTextNode(part));
        }
      });
    }

    function renderText(container, text) {
      const rich = document.createElement("div");
      rich.className = "rich";
      String(text || "").replace(/\r/g, "").split("\n").forEach(function (rawLine) {
        const line = rawLine.trim();
        if (!line) return;
        if (/^#{1,3}\s+/.test(line)) {
          const heading = document.createElement("p");
          heading.className = "heading";
          addInlineText(heading, line.replace(/^#{1,3}\s+/, ""));
          rich.appendChild(heading);
          return;
        }
        const listMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
        if (listMatch) {
          const item = document.createElement("div");
          item.className = "listLine";
          const bullet = document.createElement("span");
          bullet.className = "bullet";
          bullet.textContent = "•";
          const body = document.createElement("span");
          addInlineText(body, listMatch[1]);
          item.appendChild(bullet);
          item.appendChild(body);
          rich.appendChild(item);
          return;
        }
        const paragraph = document.createElement("p");
        addInlineText(paragraph, line);
        rich.appendChild(paragraph);
      });
      container.appendChild(rich);
    }

    function validSource(source) {
      try {
        const url = new URL(source.url, window.location.href);
        return /^https?:$/.test(url.protocol);
      } catch (error) {
        return false;
      }
    }

    function appendMessage(text, sender, sources) {
      const row = document.createElement("div");
      row.className = "row " + sender;
      const wrap = document.createElement("div");
      wrap.className = "messageWrap";
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      renderText(bubble, text);

      if (sender === "bot" && Array.isArray(sources) && sources.length) {
        const sourceBox = document.createElement("div");
        sourceBox.className = "sources";
        const label = document.createElement("div");
        label.className = "sourcesLabel";
        label.textContent = "Related reading";
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
      if (sender === "bot") {
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy";
        copyButton.setAttribute("aria-label", "Copy response");
        copyButton.title = "Copy";
        copyButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.8"/></svg>';
        copyButton.addEventListener("click", function () {
          if (!navigator.clipboard) return;
          navigator.clipboard.writeText(text).then(function () {
            copyButton.title = "Copied";
            window.setTimeout(function () { copyButton.title = "Copy"; }, 1200);
          });
        });
        meta.appendChild(copyButton);
        const note = document.createElement("span");
        note.textContent = "AI can make mistakes";
        meta.appendChild(note);
      }

      wrap.appendChild(bubble);
      wrap.appendChild(meta);
      row.appendChild(wrap);
      messages.appendChild(row);
      scrollToBottom();
      return row;
    }

    function showTyping() {
      const row = document.createElement("div");
      row.className = "row bot";
      row.id = "emr-typing";
      row.innerHTML = '<div class="messageWrap"><div class="bubble typing" aria-label="Assistant is thinking"><i></i><i></i><i></i></div></div>';
      messages.appendChild(row);
      scrollToBottom();
    }

    function hideTyping() {
      const typing = root.getElementById("emr-typing");
      if (typing) typing.remove();
    }

    function resizeInput() {
      textarea.style.height = "38px";
      textarea.style.height = Math.min(textarea.scrollHeight, 104) + "px";
      const length = textarea.value.length;
      count.textContent = length + " / 4000";
      count.classList.toggle("warning", length > 3600);
      sendButton.disabled = busy || !textarea.value.trim();
    }

    function friendlyError(error) {
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
      return new Promise(function (resolve) { window.setTimeout(resolve, milliseconds); });
    }

    async function requestAnswer(message, history) {
      const retryable = [429, 502, 503, 504];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        const timer = window.setTimeout(function () { controller.abort(); }, 35000);
        try {
          const response = await fetch(config.apiUrl, {
            method: "POST",
            mode: "cors",
            credentials: "omit",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ message: message, history: history }),
            signal: controller.signal
          });
          let data = {};
          try { data = await response.json(); } catch (parseError) { data = {}; }
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
        }
      }
      throw new Error("Request failed");
    }

    async function sendMessage(prefilled) {
      if (busy) return;
      const text = String(prefilled || textarea.value).trim();
      if (!text) return;

      const history = conversation.slice(-8);
      busy = true;
      textarea.value = "";
      resizeInput();
      if (welcome && welcome.isConnected) welcome.remove();
      appendMessage(text, "user", []);
      conversation.push({ role: "user", content: text });
      showTyping();

      try {
        const data = await requestAnswer(text, history);
        hideTyping();
        appendMessage(data.reply, "bot", data.sources || []);
        conversation.push({ role: "assistant", content: data.reply });
      } catch (error) {
        hideTyping();
        appendMessage(friendlyError(error), "bot", []);
      } finally {
        busy = false;
        resizeInput();
        textarea.focus();
      }
    }

    launcher.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    closeButton.addEventListener("click", function () { setOpen(false); });
    clearButton.addEventListener("click", function () {
      conversation.length = 0;
      messages.querySelectorAll(".row").forEach(function (row) { row.remove(); });
      if (welcome && !welcome.isConnected) messages.prepend(welcome);
      textarea.value = "";
      resizeInput();
      textarea.focus();
    });
    root.querySelectorAll(".prompt").forEach(function (button) {
      button.addEventListener("click", function () { sendMessage(button.textContent); });
    });
    textarea.addEventListener("input", resizeInput);
    textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    sendButton.addEventListener("click", function () { sendMessage(); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });
    resizeInput();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
