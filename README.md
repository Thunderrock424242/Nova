# Nova Assistant (Ollama Local Setup)

This project runs a browser-based assistant UI that talks to a **local Ollama LLM**.

## PowerShell Commands

Use these commands on Windows PowerShell.

### 1) Start Ollama server

```powershell
Write-Host "Ollama API: http://localhost:11434"; ollama serve
```

### 2) Stop Ollama server

```powershell
Get-Process ollama | Stop-Process -Force
```

### 3) Optional: pull a model (first-time setup)

```powershell
ollama pull llama3.1:8b
```

## App Features

- **Chat page** for normal conversations.
- **Status page** to show Ollama connectivity and local model information.
- **Teaching page** to save teaching notes and teaching conversations that are reused as prompt context.

## Notes

- The UI expects Ollama at `http://localhost:11434`.
- Ollama API URL (online when server is running): `http://localhost:11434`.
- Teaching notes/conversation are stored in browser `localStorage`.
- Default model is `llama3.1:8b` (can be changed in the app).
