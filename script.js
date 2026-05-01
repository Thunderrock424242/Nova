const els = {
  greeting: document.getElementById("greeting"),
  nameInput: document.getElementById("nameInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveNameBtn: document.getElementById("saveNameBtn"),
  saveKeyBtn: document.getElementById("saveKeyBtn"),
  internetToggle: document.getElementById("internetToggle"),
  speakBtn: document.getElementById("speakBtn"),
  clearBtn: document.getElementById("clearBtn"),
  chat: document.getElementById("chat"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput")
};

const state = {
  messages: JSON.parse(localStorage.getItem("nova_chat") || "[]")
};

const SYS_PROMPT = `You are Nova, a friendly female-presenting assistant with a soothing tone.
You provide supportive conversation, dating advice, female perspective advice, and software help.
Be empathetic, clear, and safe.`;

function greetingName() {
  return localStorage.getItem("nova_user_name") || "friend";
}

function renderGreeting() {
  els.greeting.textContent = `Greetings, ${greetingName()}.`;
}

function addMessage(role, text, meta = "") {
  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "user" : "nova"}`;
  div.innerHTML = `${meta ? `<div class="meta">${meta}</div>` : ""}${text}`;
  els.chat.appendChild(div);
  els.chat.scrollTop = els.chat.scrollHeight;
}

function renderHistory() {
  els.chat.innerHTML = "";
  state.messages.forEach((m) => addMessage(m.role, m.text, m.meta));
}

async function fetchInternetContext(query) {
  if (!els.internetToggle.checked) return "";
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();
    const top = data.AbstractText || data.Heading || "";
    return top ? `Internet context: ${top}` : "";
  } catch {
    return "";
  }
}

async function askNova(userText) {
  const key = localStorage.getItem("nova_api_key");
  if (!key) throw new Error("Missing API key. Save your OpenAI API key first.");

  const internetContext = await fetchInternetContext(userText);
  const messages = [
    { role: "system", content: SYS_PROMPT },
    ...state.messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
    ...(internetContext ? [{ role: "system", content: internetContext }] : []),
    { role: "user", content: userText }
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Nova API error: ${err.slice(0, 180)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "I couldn't generate a reply.";
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /female|samantha|victoria|zira|karen|aria/i.test(v.name));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

els.saveNameBtn.onclick = () => {
  const name = els.nameInput.value.trim();
  if (!name) return;
  localStorage.setItem("nova_user_name", name);
  els.nameInput.value = "";
  renderGreeting();
};

els.saveKeyBtn.onclick = () => {
  const key = els.apiKeyInput.value.trim();
  if (!key) return;
  localStorage.setItem("nova_api_key", key);
  els.apiKeyInput.value = "";
  addMessage("assistant", "API key saved locally in your browser.", "System");
};

els.clearBtn.onclick = () => {
  state.messages = [];
  localStorage.removeItem("nova_chat");
  renderHistory();
};

els.speakBtn.onclick = () => speak(`Hi ${greetingName()}, I am Nova. I'm here for you.`);

els.chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = els.messageInput.value.trim();
  if (!text) return;
  els.messageInput.value = "";

  const userMsg = { role: "user", text };
  state.messages.push(userMsg);
  addMessage("user", text, greetingName());

  try {
    const reply = await askNova(text);
    const novaMsg = { role: "assistant", text: reply };
    state.messages.push(novaMsg);
    localStorage.setItem("nova_chat", JSON.stringify(state.messages));
    addMessage("assistant", reply, "Nova");
    speak(reply.slice(0, 220));
  } catch (err) {
    addMessage("assistant", err.message, "Error");
  }
};

renderGreeting();
renderHistory();
