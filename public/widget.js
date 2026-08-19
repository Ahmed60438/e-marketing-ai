(function () {
  // 1. Determine API Endpoint
  const API_ENDPOINT = window.EMARKETING_AI_URL || "/api/chat";

  // 2. Dynamic CSS with Auto Light/Dark Mode & Sleek Animations
  const styles = `
    :root {
      --ai-bg: #ffffff;
      --ai-text-main: #0f172a;
      --ai-text-muted: #64748b;
      --ai-header-bg: linear-gradient(135deg, #0f172a, #1e293b);
      --ai-header-text: #ffffff;
      --ai-chat-bg: #f8fafc;
      --ai-bot-msg-bg: #ffffff;
      --ai-bot-msg-text: #1e293b;
      --ai-bot-msg-border: #e2e8f0;
      --ai-user-msg-bg: #2563eb;
      --ai-user-msg-text: #ffffff;
      --ai-input-bg: #ffffff;
      --ai-input-border: #e2e8f0;
      --ai-input-text: #0f172a;
      --ai-input-focus: #2563eb;
      --ai-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
      --ai-radius: 16px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --ai-bg: #1e293b;
        --ai-text-main: #f8fafc;
        --ai-text-muted: #94a3b8;
        --ai-header-bg: linear-gradient(135deg, #0f172a, #1e293b);
        --ai-chat-bg: #0f172a;
        --ai-bot-msg-bg: #1e293b;
        --ai-bot-msg-text: #f1f5f9;
        --ai-bot-msg-border: #334155;
        --ai-user-msg-bg: #3b82f6;
        --ai-input-bg: #1e293b;
        --ai-input-border: #334155;
        --ai-input-text: #f8fafc;
        --ai-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.5);
      }
    }

    /* Template Class Overrides for Theme Mode */
    html.dark #ai-chat-widget,
    body.dark #ai-chat-widget,
    [data-theme="dark"] #ai-chat-widget {
      --ai-bg: #1e293b;
      --ai-text-main: #f8fafc;
      --ai-text-muted: #94a3b8;
      --ai-chat-bg: #0f172a;
      --ai-bot-msg-bg: #1e293b;
      --ai-bot-msg-text: #f1f5f9;
      --ai-bot-msg-border: #334155;
      --ai-user-msg-bg: #3b82f6;
      --ai-input-bg: #1e293b;
      --ai-input-border: #334155;
      --ai-input-text: #f8fafc;
    }

    #ai-chat-widget {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      direction: ltr;
    }

    #ai-chat-button {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      border: none;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #ai-chat-button:hover {
      transform: scale(1.06) translateY(-2px);
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.45);
    }

    #ai-chat-window {
      display: none;
      position: fixed;
      bottom: 82px;
      left: 20px;
      width: 340px;
      max-width: calc(100vw - 32px);
      height: 460px;
      max-height: calc(100vh - 100px);
      background: var(--ai-bg);
      border-radius: var(--ai-radius);
      box-shadow: var(--ai-shadow);
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--ai-bot-msg-border);
      transform-origin: bottom left;
      animation: aiPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes aiPopIn {
      0% {
        opacity: 0;
        transform: scale(0.92) translateY(12px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .ai-chat-header {
      background: var(--ai-header-bg);
      color: var(--ai-header-text);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ai-chat-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ai-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ai-chat-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .ai-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: #94a3b8;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      background-color: #22c55e;
      border-radius: 50%;
      display: inline-block;
    }

    .ai-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      border-radius: 6px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ai-close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .ai-chat-messages {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background-color: var(--ai-chat-bg);
    }

    .ai-message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.5;
      word-break: break-word;
    }

    .ai-message-user {
      align-self: flex-end;
      background-color: var(--ai-user-msg-bg);
      color: var(--ai-user-msg-text);
      border-bottom-right-radius: 4px;
    }

    .ai-message-bot {
      align-self: flex-start;
      background-color: var(--ai-bot-msg-bg);
      color: var(--ai-bot-msg-text);
      border: 1px solid var(--ai-bot-msg-border);
      border-bottom-left-radius: 4px;
    }

    .ai-sources {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--ai-bot-msg-border);
      font-size: 11.5px;
    }

    .ai-sources strong {
      display: block;
      color: var(--ai-text-muted);
      margin-bottom: 4px;
    }

    .ai-sources a {
      color: #3b82f6;
      text-decoration: none;
      display: block;
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: opacity 0.2s;
    }

    .ai-sources a:hover {
      text-decoration: underline;
    }

    .ai-chat-input-area {
      padding: 10px 12px;
      background: var(--ai-bg);
      border-top: 1px solid var(--ai-bot-msg-border);
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .ai-chat-input {
      flex: 1;
      background: var(--ai-input-bg);
      color: var(--ai-input-text);
      border: 1px solid var(--ai-input-border);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
      direction: ltr;
    }

    .ai-chat-input:focus {
      border-color: var(--ai-input-focus);
    }

    .ai-send-btn {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 10px;
      width: 36px;
      height: 36px;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ai-send-btn:hover {
      background: #1d4ed8;
    }

    .ai-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 8px 12px;
    }

    .ai-typing span {
      width: 5px;
      height: 5px;
      background: var(--ai-text-muted);
      border-radius: 50%;
      animation: aiBounce 1.4s infinite ease-in-out both;
    }

    .ai-typing span:nth-child(1) { animation-delay: -0.32s; }
    .ai-typing span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes aiBounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;

  // 3. Inject Styles & HTML Structure
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const widgetContainer = document.createElement("div");
  widgetContainer.id = "ai-chat-widget";
  widgetContainer.innerHTML = `
    <button id="ai-chat-button" aria-label="AI Assistant">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <div id="ai-chat-window">
      <div class="ai-chat-header">
        <div class="ai-chat-header-info">
          <div class="ai-avatar">⚡</div>
          <div>
            <h3>e-MarketingReviews AI</h3>
            <div class="ai-status"><span class="status-dot"></span> Online Assistant</div>
          </div>
        </div>
        <button class="ai-close-btn" id="ai-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="ai-chat-messages" id="ai-messages">
        <div class="ai-message ai-message-bot">
          Hello! 👋 I'm your AI assistant for e-MarketingReviews. How can I help you find the best marketing & AI tools today?
        </div>
      </div>
      <div class="ai-chat-input-area">
        <input type="text" class="ai-chat-input" id="ai-input" placeholder="Type your message..." />
        <button class="ai-send-btn" id="ai-send" aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(widgetContainer);

  // 4. Dom Elements & Logic Setup
  const chatButton = document.getElementById("ai-chat-button");
  const chatWindow = document.getElementById("ai-chat-window");
  const closeButton = document.getElementById("ai-close-btn");
  const sendButton = document.getElementById("ai-send");
  const inputField = document.getElementById("ai-input");
  const messagesContainer = document.getElementById("ai-messages");

  // Toggle Window Visibility
  chatButton.addEventListener("click", () => {
    const isVisible = chatWindow.style.display === "flex";
    chatWindow.style.display = isVisible ? "none" : "flex";
    if (!isVisible) inputField.focus();
  });

  closeButton.addEventListener("click", () => {
    chatWindow.style.display = "none";
  });

  // Append Messages
  function appendMessage(text, sender, sources = []) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("ai-message", sender === "user" ? "ai-message-user" : "ai-message-bot");
    msgDiv.innerText = text;

    if (sources && sources.length > 0 && sender === "bot") {
      const sourcesDiv = document.createElement("div");
      sourcesDiv.classList.add("ai-sources");
      sourcesDiv.innerHTML = "<strong>Recommended Articles:</strong>";
      sources.forEach((src) => {
        const a = document.createElement("a");
        a.href = src.url;
        a.target = "_blank";
        a.innerText = "📖 " + src.title;
        sourcesDiv.appendChild(a);
      });
      msgDiv.appendChild(sourcesDiv);
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Typing Indicator
  function showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.id = "ai-typing-indicator";
    typingDiv.classList.add("ai-message", "ai-message-bot", "ai-typing");
    typingDiv.innerHTML = "<span></span><span></span><span></span>";
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    const typingDiv = document.getElementById("ai-typing-indicator");
    if (typingDiv) typingDiv.remove();
  }

  // Handle Send Event
  async function sendMessage() {
    const text = inputField.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    inputField.value = "";
    showTypingIndicator();

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      hideTypingIndicator();

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      appendMessage(data.reply, "bot", data.sources);
    } catch (err) {
      hideTypingIndicator();
      appendMessage("Sorry, an error occurred while connecting. Please try again later.", "bot");
    }
  }

  sendButton.addEventListener("click", sendMessage);
  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
