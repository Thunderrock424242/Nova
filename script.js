const els = {
  greeting: document.getElementById("greeting"),
  nameInput: document.getElementById("nameInput"),
  modelInput: document.getElementById("modelInput"),
  saveNameBtn: document.getElementById("saveNameBtn"),
  saveKeyBtn: document.getElementById("saveKeyBtn"),
  internetToggle: document.getElementById("internetToggle"),
  speakBtn: document.getElementById("speakBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  clearBtn: document.getElementById("clearBtn"),
  voiceStatus: document.getElementById("voiceStatus"),
  novaOrb: document.getElementById("novaOrb"),
  saveModelBtn: document.getElementById("saveModelBtn"),
  startOllamaBtn: document.getElementById("startOllamaBtn"),
  stopOllamaBtn: document.getElementById("stopOllamaBtn"),
  clearBtn: document.getElementById("clearBtn"),
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
  voiceMode: false,
  speaking: false,
  recognition: null
  teachingMessages: JSON.parse(localStorage.getItem("nova_teaching_chat") || "[]")
};

function greetingName() {
  return localStorage.getItem("nova_user_name") || "friend";
}

function getModel() {
  return localStorage.getItem("nova_model") || "llama3.1:8b";
}

function getTeachingNotes() {
  return localStorage.getItem("nova_teaching_notes") || "";
}

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

function addMessage(role, text, meta = "") {
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
    <p><strong>PowerShell start command:</strong> <code>Start-Process ollama -ArgumentList 'serve'; Start-Process 'http://localhost:11434'</code></p>
    <p><strong>PowerShell stop command:</strong> <code>Get-Process ollama | Stop-Process -Force</code></p>
    <p><strong>Ollama API:</strong> <a href="http://localhost:11434" target="_blank" rel="noopener noreferrer">http://localhost:11434</a></p>
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
    setStatus("Offline", "Run the PowerShell start command below.");
  }
}

async function askOllama(userText, mode = "chat") {
  const teachingNotes = getTeachingNotes();
  const memory = state.teachingMessages.slice(-6).map((m) => `${m.role}: ${m.text}`).join("\n");
  const context = [
    "You are Nova, a friendly assistant.",
    teachingNotes ? `User teaching notes:\n${teachingNotes}` : "",
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama API error: ${err.slice(0, 220)}`);
  }

  const data = await res.json();
  return data.message?.content?.trim() || "I couldn't generate a reply.";
}

function speak(text, onDone) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /female|samantha|victoria|zira|karen|aria/i.test(v.name));
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => {
    state.speaking = true;
    setOrbState("speaking");
    setVoiceStatus("Nova speaking");
  };
  utterance.onend = () => {
    state.speaking = false;
    if (state.voiceMode) {
      setOrbState("listening");
      setVoiceStatus("Listening");
      state.recognition?.start();
    } else {
      setOrbState("idle");
      setVoiceStatus("idle");
    }
    if (onDone) onDone();
  };
  window.speechSynthesis.speak(utterance);
}
els.tabs.forEach((tab) => {
  tab.onclick = () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.tabPanels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  };
});

async function handleUserText(text) {
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
    if (state.voiceMode) {
      setOrbState("listening");
      setVoiceStatus("Listening");
    }
  }
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setVoiceStatus("Speech recognition unsupported in this browser");
    els.voiceBtn.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  state.recognition = recognition;

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (!transcript) return;
    setVoiceStatus("Processing");
    handleUserText(transcript);
  };

  recognition.onend = () => {
    if (state.voiceMode && !state.speaking) {
      setVoiceStatus("Listening");
      setOrbState("listening");
      recognition.start();
    }
  };

  recognition.onerror = () => {
    if (state.voiceMode) {
      setVoiceStatus("Voice error, retrying");
      setTimeout(() => recognition.start(), 500);
    }
  };
}

els.saveNameBtn.onclick = () => {
  const name = els.nameInput.value.trim();
  if (!name) return;
  localStorage.setItem("nova_user_name", name);
  els.nameInput.value = "";
  renderGreeting();
};

els.saveModelBtn.onclick = () => {
  const model = els.modelInput.value.trim();
  if (!model) return;
  localStorage.setItem("nova_model", model);
  addMessage(els.chat, "assistant", `Using model: ${model}`, "System");
  checkOllamaStatus();
};

els.saveTeachingBtn.onclick = () => {
  localStorage.setItem("nova_teaching_notes", els.teachingNotes.value.trim());
  addMessage(els.teachingChat, "assistant", "Teaching notes saved. I'll use them in future responses.", "Nova");
};

els.startOllamaBtn.onclick = () => {
  addMessage(
    els.chat,
    "assistant",
    "Run this in PowerShell to start Ollama and open the site:\nStart-Process ollama -ArgumentList 'serve'; Start-Process 'http://localhost:11434'",
    "System"
  );
};

els.stopOllamaBtn.onclick = () => {
  addMessage(
    els.chat,
    "assistant",
    "Run this in PowerShell to stop Ollama:\nGet-Process ollama | Stop-Process -Force",
    "System"
  );
};

els.clearBtn.onclick = () => {
  state.messages = [];
  localStorage.removeItem("nova_chat");
  renderHistory();
};

els.speakBtn.onclick = () => speak(`Hi ${greetingName()}, I am Nova. I'm here for you.`);

els.voiceBtn.onclick = () => {
  if (!state.recognition) return;
  state.voiceMode = !state.voiceMode;
  if (state.voiceMode) {
    els.voiceBtn.textContent = "Stop Voice Chat";
    setOrbState("listening");
    setVoiceStatus("Listening");
    state.recognition.start();
  } else {
    els.voiceBtn.textContent = "Start Voice Chat";
    state.recognition.stop();
    window.speechSynthesis.cancel();
    state.speaking = false;
    setOrbState("idle");
    setVoiceStatus("idle");
  }
};

els.chatForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = els.messageInput.value.trim();
  if (!text) return;
  els.messageInput.value = "";
  await handleUserText(text);

  const userMsg = { role: "user", text, meta: greetingName() };
  state.messages.push(userMsg);
  addMessage(els.chat, "user", text, greetingName());

  try {
    const reply = await askOllama(text, "chat");
    const novaMsg = { role: "assistant", text: reply, meta: "Nova" };
    state.messages.push(novaMsg);
    localStorage.setItem("nova_chat", JSON.stringify(state.messages));
    addMessage(els.chat, "assistant", reply, "Nova");
    checkOllamaStatus();
  } catch (err) {
    addMessage(els.chat, "assistant", err.message, "Error");
    checkOllamaStatus();
  }
};

els.teachingForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = els.teachingInput.value.trim();
  if (!text) return;
  els.teachingInput.value = "";

  const userMsg = { role: "user", text, meta: "Teacher" };
  state.teachingMessages.push(userMsg);
  addMessage(els.teachingChat, "user", text, "Teacher");

  try {
    const reply = await askOllama(text, "teach");
    const novaMsg = { role: "assistant", text: reply, meta: "Nova" };
    state.teachingMessages.push(novaMsg);
    localStorage.setItem("nova_teaching_chat", JSON.stringify(state.teachingMessages));
    addMessage(els.teachingChat, "assistant", reply, "Nova");
  } catch (err) {
    addMessage(els.teachingChat, "assistant", err.message, "Error");
  }
};

renderGreeting();
els.modelInput.value = getModel();
els.teachingNotes.value = getTeachingNotes();
renderHistory();
setupVoiceRecognition();
renderTeachingHistory();
checkOllamaStatus();
