(function () {
  // 1. تحديد رابط الـ API (يتم استبداله برابط Vercel الخاص بك عند النشر)
  const API_ENDPOINT = window.EMARKETING_AI_URL || "/api/chat";

  // 2. حقن ستايل CSS الخاص بالنافذة والزر العائم
  const styles = `
    #ai-chat-widget {
      position: fixed;
      bottom: 25px;
      right: 25px;
      z-index: 999999;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      direction: rtl;
    }
    #ai-chat-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      border: none;
      box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #ai-chat-button:hover {
      transform: scale(1.08) rotate(5deg);
      box-shadow: 0 12px 30px rgba(37, 99, 235, 0.5);
    }
    #ai-chat-window {
      display: none;
      position: fixed;
      bottom: 95px;
      right: 25px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      animation: aiSlideUp 0.3s ease-out forwards;
    }
    @keyframes aiSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-chat-header {
      background: linear-gradient(135deg, #1e293b, #0f172a);
      color: #ffffff;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ai-chat-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ai-chat-header .status-dot {
      width: 8px;
      height: 8px;
      background-color: #22c55e;
      border-radius: 50%;
      display: inline-block;
    }
    .ai-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      padding: 4px;
      transition: color 0.2s;
    }
    .ai-close-btn:hover { color: #ffffff; }
    .ai-chat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background-color: #f8fafc;
    }
    .ai-message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
    }
    .ai-message-user {
      align-self: flex-end;
      background-color: #2563eb;
      color: #ffffff;
      border-bottom-left-radius: 4px;
    }
    .ai-message-bot {
      align-self: flex-start;
      background-color: #ffffff;
      color: #1e293b;
      border: 1px solid #e2e8f0;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .ai-sources {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .ai-sources a {
      color: #2563eb;
      text-decoration: none;
      display: block;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ai-sources a:hover { text-decoration: underline; }
    .ai-chat-input-area {
      padding: 12px 16px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
    }
    .ai-chat-input {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      direction: rtl;
    }
    .ai-chat-input:focus { border-color: #2563eb; }
    .ai-send-btn {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 0 16px;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ai-send-btn:hover { background: #1d4ed8; }
    .ai-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 8px 12px;
    }
    .ai-typing span {
      width: 6px;
      height: 6px;
      background: #94a3b8;
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

  // 3. إضافة المكونات للأنماط ولصفحة المودال
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const widgetContainer = document.createElement("div");
  widgetContainer.id = "ai-chat-widget";
  widgetContainer.innerHTML = `
    <button id="ai-chat-button" aria-label="مساعد الذكاء الاصطناعي">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <div id="ai-chat-window">
      <div class="ai-chat-header">
        <h3><span class="status-dot"></span> مساعد e-MarketingReviews</h3>
        <button class="ai-close-btn" id="ai-close-btn">&times;</button>
      </div>
      <div class="ai-chat-messages" id="ai-messages">
        <div class="ai-message ai-message-bot">
          مرحباً بك! 👋 أنا المساعد الذكي لموقع e-MarketingReviews. كيف يمكنني مساعدتك اليوم في اختيار أداة التسويق أو الذكاء الاصطناعي المناسبة لك؟
        </div>
      </div>
      <div class="ai-chat-input-area">
        <input type="text" class="ai-chat-input" id="ai-input" placeholder="اكتب سؤالك هنا..." />
        <button class="ai-send-btn" id="ai-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(widgetContainer);

  // 4. عناصر التهيئة والتحكم
  const chatButton = document.getElementById("ai-chat-button");
  const chatWindow = document.getElementById("ai-chat-window");
  const closeButton = document.getElementById("ai-close-btn");
  const sendButton = document.getElementById("ai-send");
  const inputField = document.getElementById("ai-input");
  const messagesContainer = document.getElementById("ai-messages");

  // فتح وإغلاق النافذة
  chatButton.addEventListener("click", () => {
    chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";
  });

  closeButton.addEventListener("click", () => {
    chatWindow.style.display = "none";
  });

  // إضافة رسالة
  function appendMessage(text, sender, sources = []) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("ai-message", sender === "user" ? "ai-message-user" : "ai-message-bot");
    msgDiv.innerText = text;

    if (sources && sources.length > 0 && sender === "bot") {
      const sourcesDiv = document.createElement("div");
      sourcesDiv.classList.add("ai-sources");
      sourcesDiv.innerHTML = "<strong>المراجع الموصى بها:</strong>";
      sources.forEach(src => {
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

  // إظهار مؤشر التفكير
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

  // إرسال الرسالة إلى الـ API
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
        throw new Error("حدث خطأ في الاتصال بالحرف");
      }

      const data = await response.json();
      appendMessage(data.reply, "bot", data.sources);
    } catch (err) {
      hideTypingIndicator();
      appendMessage("عذراً، حدث خطأ أثناء جلب الإجابة. يرجى المحاولة لاحقاً.", "bot");
    }
  }

  sendButton.addEventListener("click", sendMessage);
  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();