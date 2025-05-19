// Load saved key and name on popup open
chrome.storage.local.get(["openai_key", "userName"], (data) => {
  if (data.openai_key) {
    document.getElementById("apiKeyInput").value = data.openai_key;
  }
  if (data.userName) {
    document.getElementById("userNameInput").value = data.userName;
  }
});

// Validate the API key by calling OpenAI
async function validateOpenAIKey(apiKey) {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    return res.status === 200;
  } catch (err) {
    console.error("Validation error:", err);
    return false;
  }
}

// Save API key
document.getElementById("saveKey").addEventListener("click", async () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  const status = document.getElementById("status");

  if (!key || !key.startsWith("sk-")) {
    status.textContent = "❌ Please enter a valid OpenAI API key (starting with sk-)";
    status.style.color = "red";
    return;
  }

  status.textContent = "🔄 Validating...";
  status.style.color = "orange";

  const isValid = await validateOpenAIKey(key);

  if (isValid) {
    chrome.storage.local.set({ openai_key: key }, () => {
      status.textContent = "✅ Key saved!";
      status.style.color = "green";
    });
  } else {
    status.textContent = "❌ Invalid OpenAI API key";
    status.style.color = "red";
  }
});

// Save user name
document.getElementById("saveName").addEventListener("click", () => {
  const name = document.getElementById("userNameInput").value.trim();
  const nameStatus = document.getElementById("nameStatus");

  if (!name) {
    nameStatus.textContent = "❌ Please enter a name.";
    nameStatus.style.color = "red";
    return;
  }

  chrome.storage.local.set({ userName: name }, () => {
    nameStatus.textContent = "✅ Name saved!";
    nameStatus.style.color = "green";
    setTimeout(() => {
      nameStatus.textContent = "";
    }, 2000);
  });
});
