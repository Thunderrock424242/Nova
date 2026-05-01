const els = {
  greeting: document.getElementById("greeting"),
  nameInput: document.getElementById("nameInput"),
  modelInput: document.getElementById("modelInput"),
  saveNameBtn: document.getElementById("saveNameBtn"),
  saveModelBtn: document.getElementById("saveModelBtn"),
  internetToggle: document.getElementById("internetToggle"),
  speakBtn: document.getElementById("speakBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  clearBtn: document.getElementById("clearBtn"),
  voiceStatus: document.getElementById("voiceStatus"),
  novaOrb: document.getElementById("novaOrb"),
  startOllamaBtn: document.getElementById("startOllamaBtn"),
  stopOllamaBtn: document.getElementById("stopOllamaBtn"),
  statusText: document.getElementById("statusText"),
  statusPanel: document.getElementById("statusPanel"),
  chat: document.getElementById("chat"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  tabs: document.querySelectorAll(".tab"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  teachingNotes: document.getElementById("teachingNotes"),
  saveTeachingBtn: document.getElementById("saveTeachingBtn"),
  teachingChat: document.getElementById("teachingChat"),
  teachingForm: document.getElementById("teachingForm"),
  teachingInput: document.getElementById("teachingInput")
};

const state = {
  messages: JSON.parse(localStorage.getItem("nova_chat") || "[]"),
  teachingMessages: JSON.parse(localStorage.getItem("nova_teaching_chat") || "[]"),
  voiceMode: false,
  speaking: false,
  recognition: null
};

const greetingName = () => localStorage.getItem("nova_user_name") || "friend";
const getModel = () => localStorage.getItem("nova_model") || "llama3.1:8b";
const getTeachingNotes = () => localStorage.getItem("nova_teaching_notes") || "";

function renderGreeting() {
  els.greeting.textContent = `Greetings, ${greetingName()}.`;
}

function setOrbState(mode = "idle") {
  els.novaOrb.classList.remove("idle", "listening", "speaking");
  els.novaOrb.classList.add(mode);
}

function setVoiceStatus(text) {
  els.voiceStatus.textContent = `Voice: ${text}`;
}

function addMessage(container, role, text, meta = "") {
  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "user" : "nova"}`;
  div.innerHTML = `${meta ? `<div class="meta">${meta}</div>` : ""}${text}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderHistory() {
  els.chat.innerHTML = "";
  state.messages.forEach((m) => addMessage(els.chat, m.role, m.text, m.meta));
}

function renderTeachingHistory() {
  els.teachingChat.innerHTML = "";
  state.teachingMessages.forEach((m) => addMessage(els.teachingChat, m.role, m.text, m.meta));
}

function setStatus(status, details = "") {
  els.statusText.textContent = `Status: ${status}`;
  els.statusPanel.innerHTML = `
    <p><strong>Engine:</strong> Ollama</p>
    <p><strong>Model:</strong> ${getModel()}</p>
    <p><strong>Server:</strong> ${status}</p>
    ${details ? `<p><strong>Details:</strong> ${details}</p>` : ""}
  `;
}

async function checkOllamaStatus() {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) throw new Error("Ollama endpoint returned an error.");
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name).join(", ") || "No local models installed";
    setStatus("Online", models);
  } catch {
    setStatus("Offline", "Run: Start-Process ollama -ArgumentList 'serve'");
  }
}

async function askOllama(userText, mode = "chat") {
  const memory = state.teachingMessages.slice(-6).map((m) => `${m.role}: ${m.text}`).join("\n");
  const context = [
    "You are Nova, a friendly assistant.",
    getTeachingNotes() ? `User teaching notes:\n${getTeachingNotes()}` : "",
    memory ? `Recent teaching conversation:\n${memory}` : ""
  ].filter(Boolean).join("\n\n");

  const payload = {
    model: getModel(),
    stream: false,
    messages: [
      { role: "system", content: context },
      ...state.messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: mode === "teach" ? `Teaching mode: ${userText}` : userText }
    ]
  };

  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Ollama API error: ${(await res.text()).slice(0, 220)}`);
  const data = await res.json();
  return data.message?.content?.trim() || "I couldn't generate a reply.";
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onstart = () => {
    state.speaking = true;
    setOrbState("speaking");
    setVoiceStatus("Nova speaking");
  };
  utterance.onend = () => {
    state.speaking = false;
    if (state.voiceMode && state.recognition) {
      setOrbState("listening");
      setVoiceStatus("Listening");
      state.recognition.start();
    } else {
      setOrbState("idle");
      setVoiceStatus("idle");
    }
  };
  window.speechSynthesis.speak(utterance);
}

async function handleUserText(text) {
  const userMsg = { role: "user", text, meta: greetingName() };
  state.messages.push(userMsg);
  addMessage(els.chat, "user", text, greetingName());

  try {
    const reply = await askOllama(text);
    const novaMsg = { role: "assistant", text: reply, meta: "Nova" };
    state.messages.push(novaMsg);
    localStorage.setItem("nova_chat", JSON.stringify(state.messages));
    addMessage(els.chat, "assistant", reply, "Nova");
    if (els.speakBtn.dataset.enabled === "true") speak(reply.slice(0, 220));
  } catch (err) {
    addMessage(els.chat, "assistant", err.message, "Error");
  }
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setVoiceStatus("Speech recognition unsupported in this browser");
    els.voiceBtn.disabled = true;
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = "en-US";
  state.recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) handleUserText(transcript);
  };
  state.recognition.onend = () => {
    if (state.voiceMode && !state.speaking) state.recognition.start();
  };
}

function initEvents() {
  els.saveNameBtn.onclick = () => {
    localStorage.setItem("nova_user_name", els.nameInput.value.trim() || "friend");
    renderGreeting();
  };
  els.saveModelBtn.onclick = () => {
    localStorage.setItem("nova_model", els.modelInput.value.trim() || "llama3.1:8b");
    checkOllamaStatus();
  };
  els.clearBtn.onclick = () => {
    state.messages = [];
    localStorage.setItem("nova_chat", "[]");
    renderHistory();
  };
  els.speakBtn.onclick = () => {
    const enabled = els.speakBtn.dataset.enabled !== "true";
    els.speakBtn.dataset.enabled = String(enabled);
    els.speakBtn.textContent = enabled ? "Auto-voice: On" : "Hear Nova";
  };
  els.voiceBtn.onclick = () => {
    if (!state.recognition) return;
    state.voiceMode = !state.voiceMode;
    els.voiceBtn.textContent = state.voiceMode ? "Stop Voice Chat" : "Start Voice Chat";
    if (state.voiceMode) {
      setOrbState("listening");
      setVoiceStatus("Listening");
      state.recognition.start();
    } else {
      setOrbState("idle");
      setVoiceStatus("idle");
      state.recognition.stop();
    }
  };

  els.chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = els.messageInput.value.trim();
    if (!text) return;
    els.messageInput.value = "";
    await handleUserText(text);
  };

  els.saveTeachingBtn.onclick = () => localStorage.setItem("nova_teaching_notes", els.teachingNotes.value || "");

  els.teachingForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = els.teachingInput.value.trim();
    if (!text) return;
    els.teachingInput.value = "";
    const userMsg = { role: "user", text, meta: greetingName() };
    state.teachingMessages.push(userMsg);
    addMessage(els.teachingChat, "user", text, greetingName());

    const reply = await askOllama(text, "teach");
    const novaMsg = { role: "assistant", text: reply, meta: "Nova" };
    state.teachingMessages.push(novaMsg);
    localStorage.setItem("nova_teaching_chat", JSON.stringify(state.teachingMessages));
    addMessage(els.teachingChat, "assistant", reply, "Nova");
  };

  els.tabs.forEach((tab) => {
    tab.onclick = () => {
      els.tabs.forEach((t) => t.classList.remove("active"));
      els.tabPanels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    };
  });
}

function init() {
  els.nameInput.value = greetingName();
  els.modelInput.value = getModel();
  els.teachingNotes.value = getTeachingNotes();
  els.speakBtn.dataset.enabled = "false";
  renderGreeting();
  renderHistory();
  renderTeachingHistory();
  setupVoiceRecognition();
  initEvents();
  checkOllamaStatus();
}

init();
