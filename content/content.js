let lastProcessedMessage = "";
let replyBoxInitialized = false;
let selectedLanguage = "English";
let emojiEnabled = true;
let forceSelectedLanguage = false;

function getLastIncomingMessage() {
  const messages = document.querySelectorAll("div.message-in");
  if (!messages.length) return null;
  const lastMessage = messages[messages.length - 1];
  const textElement = lastMessage.querySelector("span.selectable-text span");
  return textElement?.innerText || null;
}

function insertMessageOnly(text) {
  const editableDiv = document.querySelector('[contenteditable="true"][data-tab="10"][role="textbox"]');
  if (!editableDiv) {
    alert("❌ WhatsApp input box not found. Open a chat.");
    return;
  }

  editableDiv.focus();
  editableDiv.innerHTML = "";

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editableDiv);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  document.execCommand("insertText", false, text);
  editableDiv.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function showReplies(replies) {
  const container = document.getElementById("replies");
  if (!container) return;

  container.innerHTML = "";
  replies.slice(0, 3).forEach(reply => {
    const btn = document.createElement("button");
    btn.textContent = reply;
    btn.onclick = () => insertMessageOnly(reply);
    btn.style.margin = "4px 0";
    btn.style.width = "100%";
    container.appendChild(btn);
  });
}

// Utility: Detect whether message is in native script or Roman (Latin)
function detectScriptType(text) {
  const nativeScriptsRegex = /[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u4E00-\u9FFF]/;
  return nativeScriptsRegex.test(text) ? "native" : "roman";
}

function fetchRepliesWithKey(message, language) {
  chrome.storage.local.get(["openai_key", "emojiEnabled", "forceSelectedLanguage", "userName"], async (data) => {
    const apiKey = data.openai_key;
    emojiEnabled = data.emojiEnabled ?? true;
    forceSelectedLanguage = data.forceSelectedLanguage ?? false;
    const userName = data.userName?.trim();

    if (!apiKey) {
      alert("❌ API key not set.");
      return;
    }

    let promptLanguage = language;
    let transliterate = false;

    if (!forceSelectedLanguage) {
      const scriptType = detectScriptType(message);
      transliterate = scriptType === "roman";
    }

    const lowerMsg = message.toLowerCase();
   // Detect if name could enhance a friendly greeting
    const nameTrigger = userName && /\b(hi|hello|hey|howdy|what'?s up|sup)\b/.test(lowerMsg);

    // Final prompt instructions
    let instructions = `You are generating smart replies for WhatsApp messages. Do not mention that you are an AI, assistant, or ChatGPT. Respond casually, as a human would. Do not use signatures or bot-like phrases.`;

    // Name enhancement (only if message sounds like a greeting)
    if (nameTrigger) {
      instructions += ` Your name is "${userName}". You can use it naturally in a warm or friendly greeting if it makes the message more personal. Only include your name when it fits the tone (like in response to 'hi', 'hello', etc.).`;
    } else {
      instructions += ` Your name is "${userName}". Do not mention it unless it clearly fits the tone of the message. Most replies should not include your name.`;
    }

    if (forceSelectedLanguage) {
      instructions += ` Reply in ${promptLanguage} using the native script.`;
    } else {
      instructions += ` Reply in ${promptLanguage} using ${transliterate ? "English letters (transliteration)" : "native script"}.`;
    }

    instructions += emojiEnabled ? " Add emojis." : " Do not use any emojis.";
    instructions += ` Give 3 short, friendly replies. Avoid numbering or bullets. Do not repeat questions like 'what is your name?'. Use only the message below:\n"${message}"`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: instructions }],
          max_tokens: 200
        })
      });

      const json = await res.json();
      const raw = json.choices[0].message.content;

      const replies = raw
        .split(/\n+/)
        .map(r => r.replace(/^\d+[\).\s-]?\s*/, '').trim())
        .filter(r => r && r.length >= 2);

      showReplies(replies);
    } catch (err) {
      console.error("OpenAI error:", err);
    }
  });
}

function setupLanguageAndEmojiSettings() {
  const langSelect = document.getElementById("reply-language");
  const emojiToggle = document.getElementById("emoji-toggle");
  const forceLangToggle = document.getElementById("force-language-toggle");

  if (!langSelect || !emojiToggle || !forceLangToggle) return;

  chrome.storage.local.get(["selectedLanguage", "emojiEnabled", "forceSelectedLanguage"], (data) => {
    if (data.selectedLanguage) {
      selectedLanguage = data.selectedLanguage;
      langSelect.value = selectedLanguage;
    }
    if (typeof data.emojiEnabled === "boolean") {
      emojiEnabled = data.emojiEnabled;
      emojiToggle.checked = emojiEnabled;
    }
    if (typeof data.forceSelectedLanguage === "boolean") {
      forceSelectedLanguage = data.forceSelectedLanguage;
      forceLangToggle.checked = forceSelectedLanguage;
    }
  });

  langSelect.addEventListener("change", (e) => {
    selectedLanguage = e.target.value;
    chrome.storage.local.set({ selectedLanguage });

    const message = getLastIncomingMessage();
    if (message) {
      fetchRepliesWithKey(message, selectedLanguage);
    }
  });

  emojiToggle.addEventListener("change", () => {
    emojiEnabled = emojiToggle.checked;
    chrome.storage.local.set({ emojiEnabled });

    const message = getLastIncomingMessage();
    if (message) {
      fetchRepliesWithKey(message, selectedLanguage);
    }
  });

  forceLangToggle.addEventListener("change", () => {
    forceSelectedLanguage = forceLangToggle.checked;
    chrome.storage.local.set({ forceSelectedLanguage });

    const message = getLastIncomingMessage();
    if (message) {
      fetchRepliesWithKey(message, selectedLanguage);
    }
  });
}

function enableDrag() {
  const replyBox = document.getElementById("floating-reply-box");
  if (!replyBox) return;

  replyBox.onmousedown = function (e) {
    if (e.target.tagName === "SELECT" || e.target.tagName === "OPTION" || e.target.type === "checkbox") return;

    e.preventDefault();
    const shiftX = e.clientX - replyBox.getBoundingClientRect().left;
    const shiftY = e.clientY - replyBox.getBoundingClientRect().top;

    function moveAt(e) {
      replyBox.style.left = e.pageX - shiftX + "px";
      replyBox.style.top = e.pageY - shiftY + "px";
      replyBox.style.bottom = "auto";
      replyBox.style.right = "auto";
    }

    function stopDrag() {
      document.removeEventListener("mousemove", moveAt);
      document.removeEventListener("mouseup", stopDrag);
    }

    document.addEventListener("mousemove", moveAt);
    document.addEventListener("mouseup", stopDrag);
  };
}

async function injectFloatingUI() {
  if (replyBoxInitialized) return;

  const htmlRes = await fetch(chrome.runtime.getURL("main-reply-box/floating-ui.html"));
  const htmlText = await htmlRes.text();
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlText;
  document.body.appendChild(tempDiv.firstElementChild);

  const cssRes = await fetch(chrome.runtime.getURL("main-reply-box/floating-ui.css"));
  const cssText = await cssRes.text();
  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.appendChild(style);

  setupLanguageAndEmojiSettings();
  enableDrag();
  replyBoxInitialized = true;
}

async function observeMessages() {
  await injectFloatingUI();

  setInterval(() => {
    const message = getLastIncomingMessage();
    if (message && message !== lastProcessedMessage) {
      lastProcessedMessage = message;
      fetchRepliesWithKey(message, selectedLanguage);
    }
  }, 3000);
}

window.addEventListener("load", () => {
  observeMessages();
});
