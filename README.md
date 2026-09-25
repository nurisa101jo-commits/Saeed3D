# Saeed

> A desktop AI 3D companion for Windows, inspired by the architecture and interaction model of HoloWaifu.

Saeed is a Windows desktop application that places an animated 3D VRM character on the user's desktop. The character can listen through the microphone, convert speech to text, generate an AI response, synthesize speech, play the response with real-time lip synchronization, animate facial expressions and body motions, and maintain local long-term memory.

This document is the complete technical implementation specification for the project. It is intentionally detailed so that the repository can be implemented from scratch.

---

## Table of Contents

- [1. Project Goals](#1-project-goals)
- [2. Product Concept](#2-product-concept)
- [3. High-Level Architecture](#3-high-level-architecture)
- [4. Technology Stack](#4-technology-stack)
- [5. Repository Structure](#5-repository-structure)
- [6. Electron Architecture](#6-electron-architecture)
- [7. Window and Desktop Behavior](#7-window-and-desktop-behavior)
- [8. Renderer Architecture](#8-renderer-architecture)
- [9. VRM Character System](#9-vrm-character-system)
- [10. VRMA Animation System](#10-vrma-animation-system)
- [11. AI Conversation Pipeline](#11-ai-conversation-pipeline)
- [12. Speech-to-Text](#12-speech-to-text)
- [13. LLM Layer](#13-llm-layer)
- [14. Streaming Responses](#14-streaming-responses)
- [15. Text-to-Speech](#15-text-to-speech)
- [16. Audio Playback](#16-audio-playback)
- [17. Lip Sync and Visemes](#17-lip-sync-and-visemes)
- [18. Facial Expressions](#18-facial-expressions)
- [19. Character State Machine](#19-character-state-machine)
- [20. Memory System](#20-memory-system)
- [21. Local Database](#21-local-database)
- [22. Backend/API](#22-backendapi)
- [23. WebSocket and Real-Time Communication](#23-websocket-and-real-time-communication)
- [24. Configuration](#24-configuration)
- [25. Security Model](#25-security-model)
- [26. GPU and Rendering](#26-gpu-and-rendering)
- [27. Windows Packaging](#27-windows-packaging)
- [28. ZIP/Portable Distribution](#28-zipportable-distribution)
- [29. Installer Distribution](#29-installer-distribution)
- [30. Development Environment](#30-development-environment)
- [31. Installation](#31-installation)
- [32. Development Commands](#32-development-commands)
- [33. Implementation Roadmap](#33-implementation-roadmap)
- [34. Detailed Module Specifications](#34-detailed-module-specifications)
- [35. API Contract](#35-api-contract)
- [36. Example Conversation Flow](#36-example-conversation-flow)
- [37. Audio/Lip-Sync Flow](#37-audiolip-sync-flow)
- [38. Error Handling](#38-error-handling)
- [39. Performance Requirements](#39-performance-requirements)
- [40. Testing](#40-testing)
- [41. Logging and Diagnostics](#41-logging-and-diagnostics)
- [42. Privacy](#42-privacy)
- [43. Distribution Checklist](#43-distribution-checklist)
- [44. Future Features](#44-future-features)
- [45. Reference Architecture](#45-reference-architecture)
- [46. Important Implementation Notes](#46-important-implementation-notes)
- [47. License and Assets](#47-license-and-assets)

---

# 1. Project Goals

Saeed should provide the following experience:

1. A 3D character lives on the Windows desktop.
2. The character can remain visible above normal applications.
3. The user can talk to the character through a microphone.
4. Speech is converted to text.
5. The text is sent to an LLM.
6. The LLM generates a response.
7. The response can be streamed progressively.
8. Text is converted to natural speech.
9. Audio is played through the browser audio stack.
10. The character's mouth moves while speaking.
11. Facial expressions can change according to the response.
12. Body animations can change according to the character state.
13. Conversation history can be retained.
14. Important memories can be stored locally.
15. The application can operate using remote or local AI/TTS services.
16. The final Windows application should be distributable as a portable ZIP and optionally as an installer.

---

# 2. Product Concept

Saeed is not a traditional chat window.

The primary interface is the character itself.

The application should feel like a desktop companion:

```text
                    Windows Desktop
┌─────────────────────────────────────────────────────┐
│                                                     │
│      Browser       VS Code       Discord            │
│                                                     │
│                                                     │
│                                         ┌────────┐  │
│                                         │ Saeed  │  │
│                                         │  VRM   │  │
│                                         │        │  │
│                                         └────────┘  │
└─────────────────────────────────────────────────────┘
```

The UI should remain lightweight while the character provides the majority of the visual interaction.

---

# 3. High-Level Architecture

The complete architecture is divided into four major layers.

```text
┌──────────────────────────────────────────────────────────┐
│                    Saeed Desktop App                     │
│                         Electron                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Main Process                 Renderer Process            │
│  ─────────────                ────────────────             │
│  Window management            React                        │
│  SQLite                       React Three Fiber            │
│  Local TTS                    Three.js                     │
│  IPC                          three-vrm                    │
│  OS integration               AudioContext                 │
│  File system                 AudioWorklet                  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                       AI Services                        │
│                                                          │
│  STT → LLM → Streaming → TTS                              │
│                                                          │
│  Remote API / Local engines                               │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                         Assets                            │
│                                                          │
│  VRM models                                                │
│  VRMA animations                                           │
│  TTS models                                                │
│  Character configuration                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

The main communication path is:

```text
Microphone
    │
    ▼
MediaRecorder
    │
    ▼
STT
    │
    ▼
User Text
    │
    ▼
Conversation Manager
    │
    ▼
Memory Retrieval
    │
    ▼
LLM
    │
    ▼
Streaming Response
    │
    ├──────────────► UI Text
    │
    ▼
TTS
    │
    ▼
Audio Stream
    │
    ▼
Web Audio API
    │
    ▼
AudioWorklet / Analyzer
    │
    ▼
Viseme Detection
    │
    ▼
VRM Expressions
    │
    ▼
Mouth / Facial Animation
```

---

# 4. Technology Stack

## Desktop

- Electron
- Node.js
- Chromium
- Electron IPC
- Windows APIs through Electron

## Frontend

- React
- Vite
- TypeScript
- React Three Fiber
- Three.js

## 3D

- Three.js
- `@react-three/fiber`
- `@pixiv/three-vrm`
- VRM
- VRMA
- GLTF/GLB loading
- WebGLRenderer

## Audio

- MediaRecorder
- MediaStream
- Web Audio API
- AudioContext
- AudioWorklet
- AnalyserNode
- PCM/audio decoding
- TTS engines

## AI

- Speech-to-Text provider
- LLM provider
- Text-to-Speech provider
- Optional local AI engines

## Storage

- SQLite
- `better-sqlite3`
- JSON configuration
- Local model files

## Networking

- Fetch/Axios
- WebSocket
- Socket.IO
- Server-Sent Events or streaming HTTP responses

## Packaging

- Electron packaging
- ASAR
- Windows x64
- Portable ZIP
- Optional NSIS installer

---

# 5. Repository Structure

Recommended repository:

```text
saeed/
│
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── audio.ts
│   │   ├── memory.ts
│   │   ├── settings.ts
│   │   └── system.ts
│   ├── services/
│   │   ├── tts/
│   │   │   ├── edge.ts
│   │   │   ├── fish.ts
│   │   │   ├── azure.ts
│   │   │   └── piper.ts
│   │   └── database.ts
│   └── windows/
│       └── companionWindow.ts
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── components/
│   │   ├── Avatar/
│   │   ├── Chat/
│   │   ├── Controls/
│   │   ├── Settings/
│   │   └── Debug/
│   │
│   ├── avatar/
│   │   ├── AvatarScene.tsx
│   │   ├── VRMAvatar.tsx
│   │   ├── expressions.ts
│   │   ├── visemes.ts
│   │   ├── lookAt.ts
│   │   └── animationController.ts
│   │
│   ├── audio/
│   │   ├── microphone.ts
│   │   ├── recorder.ts
│   │   ├── player.ts
│   │   ├── analyser.ts
│   │   ├── audioWorklet.ts
│   │   └── lipSync.ts
│   │
│   ├── ai/
│   │   ├── chat.ts
│   │   ├── streaming.ts
│   │   ├── stt.ts
│   │   ├── tts.ts
│   │   ├── memory.ts
│   │   └── prompts.ts
│   │
│   ├── state/
│   │   ├── appStore.ts
│   │   ├── chatStore.ts
│   │   └── avatarStore.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── avatar.ts
│   │   ├── audio.ts
│   │   └── memory.ts
│   │
│   └── styles/
│
├── public/
│   ├── models/
│   │   ├── saeed.vrm
│   │   └── animations/
│   │       └── *.vrma
│   ├── audio/
│   └── icons/
│
├── backend/
│   └── tts/
│
├── python/
│   └── piper/
│
├── scripts/
│   ├── build.ts
│   ├── package.ts
│   └── verify-assets.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── README.md
└── LICENSE
```

---

# 6. Electron Architecture

Electron provides the desktop shell.

Saeed should use two primary processes.

## Main Process

Responsible for:

- Window creation
- Always-on-top behavior
- Local filesystem access
- SQLite
- Local TTS
- Application lifecycle
- OS integration
- Secure IPC
- Settings
- Optional system notifications
- Packaging/runtime resources

## Renderer Process

Responsible for:

- React
- UI
- Three.js
- VRM
- Animations
- Web Audio
- Microphone capture
- Chat rendering
- Character state

The renderer should never receive unrestricted Node.js access.

Recommended configuration:

```ts
new BrowserWindow({
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  resizable: true,
  hasShadow: false,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: preloadPath
  }
});
```

---

# 7. Window and Desktop Behavior

The companion window should behave like a desktop widget rather than a normal application window.

Required properties:

- Frameless
- Transparent
- No native title bar
- Always on top
- Resizable
- Optional click-through mode
- Optional taskbar hiding
- Custom drag region
- Character positioned near a screen edge
- Window state persistence

Electron APIs:

```ts
win.setAlwaysOnTop(true, 'floating');
win.setSkipTaskbar(true);
win.setIgnoreMouseEvents(true, { forward: true });
```

Mouse interaction should be configurable.

Example:

```text
Interactive Mode:
  Character receives mouse events.

Desktop Mode:
  Character ignores mouse events.

Chat Mode:
  Character receives mouse events.
```

---

# 8. Renderer Architecture

The renderer uses:

```text
React
  │
  └── React Three Fiber
        │
        └── Three.js
              │
              └── WebGLRenderer
                    │
                    └── VRM
```

React Three Fiber should own the render loop.

Example conceptual structure:

```tsx
<Canvas
  gl={{ alpha: true, antialias: true }}
  camera={{ position: [0, 1.4, 2.5] }}
>
  <AvatarScene />
</Canvas>
```

The renderer should maintain:

- Scene
- Camera
- Lighting
- VRM model
- Animation mixer
- Look-at controller
- Expression controller
- Lip-sync controller

---

# 9. VRM Character System

The character should use VRM because VRM provides standardized humanoid avatar data.

Required package:

```text
@pixiv/three-vrm
```

Loading pipeline:

```text
VRM file
  ↓
GLTFLoader
  ↓
VRM loader plugin
  ↓
VRM object
  ↓
Scene
```

Conceptual code:

```ts
const loader = new GLTFLoader();

loader.register((parser) => {
  return new VRMLoaderPlugin(parser);
});

loader.load('/models/saeed.vrm', (gltf) => {
  const vrm = gltf.userData.vrm;
});
```

The VRM object can provide:

- Humanoid bones
- Expressions
- LookAt
- First-person settings
- Metadata
- Materials
- Blend shapes

---

# 10. VRMA Animation System

VRMA is used for humanoid animation data.

Recommended animation categories:

```text
Idle
Talk
Happy
Sad
Thinking
Listening
Surprised
Angry
Sleep
Meditation
Music
Greeting
Waiting
Start
Goodbye
```

Animations should be loaded dynamically to avoid unnecessary memory use.

Architecture:

```text
AnimationManager
      │
      ├── Idle
      ├── Talk
      ├── Listen
      ├── Think
      ├── Happy
      └── ...
```

Use Three.js `AnimationMixer`.

The animation system should support:

- Cross fading
- Looping
- One-shot animations
- Priority
- Interruptions
- Animation layers
- State-dependent animation

---

# 11. AI Conversation Pipeline

Conversation must be treated as a pipeline rather than one request.

```text
User starts speaking
        ↓
Microphone capture
        ↓
Audio encoding
        ↓
STT
        ↓
Transcript
        ↓
Memory retrieval
        ↓
Prompt construction
        ↓
LLM request
        ↓
Streaming response
        ↓
Text chunks
        ↓
TTS queue
        ↓
Audio
        ↓
Lip sync
        ↓
Avatar response
```

The application should not wait for the complete LLM response before starting TTS if streaming TTS is supported.

---

# 12. Speech-to-Text

The browser captures microphone input.

Use:

```js
navigator.mediaDevices.getUserMedia({
  audio: true
});
```

Then:

```js
const recorder = new MediaRecorder(stream);
```

Audio chunks:

```js
recorder.ondataavailable = (event) => {
  chunks.push(event.data);
};
```

When recording finishes:

```text
Blob
 ↓
multipart/form-data
 ↓
STT API
 ↓
transcript
```

The implementation should allow multiple STT providers.

Recommended abstraction:

```ts
interface STTProvider {
  transcribe(audio: Blob, options: STTOptions): Promise<Transcript>;
}
```

Possible implementations:

```text
Remote STT
Local Whisper
Cloud STT
Browser STT
```

For privacy, local Whisper should be supported as an optional provider.

---

# 13. LLM Layer

Do not couple Saeed directly to one LLM provider.

Create an abstraction:

```ts
interface LLMProvider {
  chat(request: ChatRequest): AsyncIterable<LLMEvent>;
}
```

The request should include:

```ts
interface ChatRequest {
  profile: CharacterProfile;
  memoryContext: Memory[];
  recentMessages: Message[];
  state: CharacterState;
  language: string;
  userMessage: string;
}
```

The system prompt should define:

- Character identity
- Personality
- Speaking style
- Language
- Emotional behavior
- Safety rules
- Memory rules
- Response formatting

---

# 14. Streaming Responses

The LLM should support streaming.

Possible protocol:

```text
message
step
ack
avatar_cue
fish_markup
done
```

Example:

```json
{
  "type": "message",
  "delta": "Hello"
}
```

Then:

```json
{
  "type": "message",
  "delta": "! How are you?"
}
```

Finally:

```json
{
  "type": "done"
}
```

The frontend should incrementally render the response.

---

# 15. Text-to-Speech

Saeed should support multiple TTS engines.

Recommended interface:

```ts
interface TTSProvider {
  synthesize(
    text: string,
    options: TTSOptions
  ): Promise<AudioResult>;
}
```

Providers:

### Fish Audio

Remote high-quality TTS.

Support:

- Voice
- Emotion
- Metadata
- Streaming
- Character-specific voices

### Microsoft Edge TTS

Node/Electron implementation.

Useful for:

- Free/low-cost development
- Many voices
- Fast testing

### Azure TTS

Useful for:

- Production
- Enterprise voices
- SSML
- Emotion/prosody where supported

### Piper

Local/offline TTS.

Recommended for:

- Offline mode
- Privacy
- Low latency
- No API dependency

Piper can use ONNX models.

Conceptually:

```text
Text
 ↓
Piper
 ↓
ONNX Runtime
 ↓
WAV
 ↓
Web Audio
```

Optional CUDA acceleration should be supported where compatible.

---

# 16. Audio Playback

Use the Web Audio API.

```ts
const audioContext = new AudioContext();
```

Pipeline:

```text
TTS bytes
   ↓
decodeAudioData()
   ↓
AudioBuffer
   ↓
AudioBufferSourceNode
   ↓
AnalyserNode
   ↓
Destination
```

For streaming:

```text
Audio chunks
   ↓
Audio queue
   ↓
Scheduled AudioBufferSourceNodes
   ↓
Analyser
```

The scheduler should avoid gaps between chunks.

---

# 17. Lip Sync and Visemes

Lip sync is one of the most important features.

The system should convert audio activity into mouth movement.

Basic approach:

```text
Audio
 ↓
AnalyserNode
 ↓
Frequency / amplitude analysis
 ↓
Voice activity
 ↓
Viseme estimation
 ↓
VRM expressions
```

A simple first implementation can use amplitude:

```text
Low amplitude  → mouth closed
Medium         → mouth slightly open
High           → mouth open
```

A better implementation should estimate phoneme/viseme information.

Example visemes:

```text
A
I
U
E
O
Silence
```

Map these to VRM expressions.

Example:

```ts
vrm.expressionManager?.setValue('aa', amount);
vrm.expressionManager?.setValue('ih', amount);
vrm.expressionManager?.setValue('ou', amount);
vrm.expressionManager?.setValue('ee', amount);
vrm.expressionManager?.setValue('oh', amount);
```

The exact expression names depend on the VRM model.

---

# 18. Facial Expressions

Facial expressions should be controlled separately from lip sync.

Expression layers:

```text
Base Emotion
    +
Eye/Blink
    +
Lip Sync
    +
Special Reaction
```

Example:

```text
Happy
  smile = 0.8
Speaking
  aa = 0.5

Blink
  blink = 1.0

Result:
  Happy + Speaking + Blink
```

The controller must blend these values rather than allowing one system to completely overwrite another.

Possible emotions:

```text
neutral
happy
sad
angry
surprised
embarrassed
confused
thinking
sleepy
excited
```

---

# 19. Character State Machine

The avatar should have explicit states.

```text
IDLE
LISTENING
THINKING
SPEAKING
HAPPY
SAD
SURPRISED
SLEEPING
ERROR
```

Example transition:

```text
IDLE
 ↓ microphone input
LISTENING
 ↓ transcript
THINKING
 ↓ first LLM token
SPEAKING
 ↓ audio finished
IDLE
```

The state machine controls:

- Animation
- Facial expression
- Eye movement
- Mouth movement
- UI indicators
- Audio behavior

---

# 20. Memory System

Saeed should have local long-term memory.

Memory categories:

```text
User facts
Preferences
Important events
Conversation summaries
Character relationship state
Recent topics
```

Memory lifecycle:

```text
Conversation
   ↓
Memory extraction
   ↓
Memory scoring
   ↓
SQLite
   ↓
Future retrieval
   ↓
Prompt context
```

Memory should not store every message forever.

Instead:

1. Keep recent messages.
2. Extract important memories.
3. Store structured memory.
4. Retrieve relevant memories for future conversations.

---

# 21. Local Database

Use SQLite.

Recommended package:

```text
better-sqlite3
```

Database location:

```text
%APPDATA%/Saeed/memory.sqlite3
```

Suggested tables:

```sql
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  category TEXT,
  importance REAL DEFAULT 0.5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Messages:

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

Settings:

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Optional embeddings can be added later.

---

# 22. Backend/API

Saeed should not hard-code AI providers into the renderer.

Recommended API gateway:

```text
api.saeed.app
```

or self-hosted:

```text
https://your-server.example.com
```

Endpoints:

```text
POST /v1/chat/voice
POST /v1/chat/stream
POST /v1/tts

POST /v1/chat/memory/suggest
POST /v1/chat/diary/compose

POST /v1/license/activate
GET  /v1/license/status
```

These endpoints should be considered an architectural reference.

Saeed can instead use provider APIs directly if desired.

---

# 23. WebSocket and Real-Time Communication

For events that need bidirectional real-time communication, use:

```text
socket.io-client
```

Possible events:

```text
chat:start
chat:token
chat:audio
chat:emotion
chat:viseme
chat:done
avatar:cue
memory:update
```

WebSocket is optional if HTTP streaming is sufficient.

Do not introduce WebSocket complexity where normal streaming HTTP is enough.

---

# 24. Configuration

Use a configuration file plus encrypted/secure credentials where necessary.

Example:

```json
{
  "language": "en",
  "theme": "transparent",
  "alwaysOnTop": true,
  "tts": {
    "engine": "piper",
    "voice": "saeed"
  },
  "stt": {
    "provider": "remote"
  },
  "llm": {
    "provider": "openai-compatible",
    "model": "MODEL_NAME"
  }
}
```

Never commit API keys.

Use environment variables:

```text
LLM_API_KEY
STT_API_KEY
TTS_API_KEY
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
FISH_AUDIO_API_KEY
```

---

# 25. Security Model

Electron security is critical.

Use:

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
```

Expose only required functions through preload:

```ts
contextBridge.exposeInMainWorld('electronAPI', {
  getSettings,
  saveSettings,
  getMemory,
  saveMemory,
  playLocalTTS
});
```

Never expose:

```text
fs
child_process
process
shell
Node require()
```

directly to the renderer.

Validate all IPC inputs.

---

# 26. GPU and Rendering

The character renderer uses WebGL.

Three.js:

```text
WebGLRenderer
```

Electron/Chromium uses ANGLE.

Depending on the environment, ANGLE can use:

```text
Direct3D 11
Vulkan
SwiftShader
```

Therefore the application should not assume that the renderer directly uses Vulkan.

Typical stack:

```text
Three.js
 ↓
WebGL
 ↓
Chromium
 ↓
ANGLE
 ↓
D3D11 / Vulkan / SwiftShader
 ↓
GPU or CPU
```

Avoid disabling GPU acceleration in the normal application.

GPU disabling should only be used for diagnostic or special rendering modes.

---

# 27. Windows Packaging

The project should produce:

```text
Saeed.exe
```

and preferably:

```text
Saeed-Setup-x64.exe
Saeed-win-x64.zip
```

Recommended packaging technology:

```text
electron-builder
```

Example conceptual configuration:

```yaml
appId: com.saeed.desktop
productName: Saeed

directories:
  output: release

files:
  - dist/**
  - electron/**
  - package.json

asar: true

win:
  target:
    - nsis
    - zip
  icon: assets/icon.ico

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
```

---

# 28. ZIP/Portable Distribution

The portable distribution should look like:

```text
Saeed-win-x64.zip
│
├── Saeed.exe
├── resources/
│   ├── app.asar
│   └── app.asar.unpacked/
│
├── models/
├── backend/
├── DLLs
└── ...
```

The user should be able to:

```text
Download
   ↓
Extract
   ↓
Run Saeed.exe
```

No installation should be required for the portable build.

---

# 29. Installer Distribution

The optional installer should be an NSIS package.

Installation:

```text
Saeed-Setup-x64.exe
        ↓
Installation directory
        ↓
Saeed.exe
        ↓
Shortcuts
        ↓
Uninstaller
```

Installer options:

- Desktop shortcut
- Start menu shortcut
- Installation directory
- Launch on startup
- Uninstall support

---

# 30. Development Environment

Recommended environment:

```text
Windows 10/11 x64
Node.js 22 LTS
npm
Git
VS Code
```

Recommended versions should be pinned in the repository.

Verify:

```bash
node --version
npm --version
```

---

# 31. Installation

Clone:

```bash
git clone https://github.com/YOUR_USERNAME/saeed.git
cd saeed
```

Install dependencies:

```bash
npm install
```

Start development:

```bash
npm run dev
```

Build renderer:

```bash
npm run build
```

Package Windows:

```bash
npm run package
```

---

# 32. Development Commands

Recommended scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron": "electron .",
    "start": "electron .",
    "package": "electron-builder --win",
    "package:zip": "electron-builder --win zip",
    "package:installer": "electron-builder --win nsis",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  }
}
```

---

# 33. Implementation Roadmap

## Phase 1 — Desktop Shell

Implement:

- Electron
- Transparent window
- Frameless window
- Always-on-top
- React
- Vite
- IPC
- Settings

Goal:

```text
Empty transparent Saeed window
```

---

## Phase 2 — VRM

Implement:

- Three.js
- React Three Fiber
- three-vrm
- VRM loading
- Camera
- Lighting
- Transparent background

Goal:

```text
Saeed appears on the desktop.
```

---

## Phase 3 — Animation

Implement:

- VRMA loading
- AnimationMixer
- Idle animation
- Talking animation
- Listening animation
- State machine

Goal:

```text
Saeed feels alive without AI.
```

---

## Phase 4 — Microphone

Implement:

- getUserMedia
- MediaRecorder
- Recording UI
- Audio upload

Goal:

```text
User → audio blob
```

---

## Phase 5 — STT

Implement:

- STT provider
- Transcript
- Error handling
- Language detection

Goal:

```text
User speech → text
```

---

## Phase 6 — LLM

Implement:

- Chat provider abstraction
- Prompt
- Character personality
- Conversation history
- Streaming

Goal:

```text
Text → AI response
```

---

## Phase 7 — TTS

Implement:

- Edge TTS
- Piper
- Remote TTS
- Audio queue

Goal:

```text
AI text → voice
```

---

## Phase 8 — Lip Sync

Implement:

- AudioContext
- AnalyserNode
- AudioWorklet
- Viseme controller
- VRM expressions

Goal:

```text
Voice → moving mouth
```

---

## Phase 9 — Memory

Implement:

- SQLite
- Message history
- Memory extraction
- Memory retrieval

Goal:

```text
Saeed remembers important information.
```

---

## Phase 10 — Polish

Implement:

- Better animations
- Better expressions
- Eye tracking
- Blinking
- Idle behaviors
- UI
- Settings
- Startup
- Packaging
- Crash recovery
- Logs

---

# 34. Detailed Module Specifications

## `AvatarScene`

Responsibilities:

- Three.js scene
- Camera
- Renderer
- Lighting
- Model loading
- Animation update

---

## `VRMAvatar`

Responsibilities:

- Load VRM
- Store VRM reference
- Update VRM every frame
- Manage humanoid
- Manage expressions
- Manage lookAt

---

## `AnimationController`

Responsibilities:

```text
play()
stop()
crossFade()
setState()
update()
```

---

## `LipSyncController`

Responsibilities:

```text
start()
stop()
update()
setViseme()
reset()
```

---

## `ConversationManager`

Responsibilities:

```text
startConversation()
sendText()
sendVoice()
handleStream()
finishConversation()
```

---

## `MemoryManager`

Responsibilities:

```text
addMemory()
searchMemory()
deleteMemory()
updateMemory()
buildContext()
```

---

## `TTSManager`

Responsibilities:

```text
selectProvider()
synthesize()
stream()
cancel()
queue()
```

---

# 35. API Contract

## Voice

```http
POST /v1/chat/voice
Content-Type: multipart/form-data
```

Form fields:

```text
audio
transcriptionTask
inputLanguage
transcriptionLanguage
language
```

Response:

```json
{
  "text": "Hello Saeed"
}
```

---

## Chat Stream

```http
POST /v1/chat/stream
Content-Type: application/json
```

Request:

```json
{
  "profile": {},
  "memoryContext": [],
  "recentMessages": [],
  "llmProfile": {},
  "state": {},
  "tts": {},
  "language": "en"
}
```

Streaming events:

```text
message
step
ack
avatar_cue
fish_markup
done
```

---

## TTS

```http
POST /v1/tts
```

Possible headers:

```text
x-tts-engine
x-tts-voice
x-tts-emotion
x-tts-meta
```

Response should provide audio or a stream.

---

# 36. Example Conversation Flow

User says:

```text
"Hey Saeed, how are you?"
```

System:

```text
Microphone
    ↓
MediaRecorder
    ↓
STT
    ↓
"Hey Saeed, how are you?"
    ↓
Memory retrieval
    ↓
Prompt
    ↓
LLM
```

LLM begins streaming:

```text
"I'm doing great! It's nice to hear from you..."
```

Immediately:

```text
Text chunk
    ↓
TTS
    ↓
Audio chunk
    ↓
AudioContext
    ↓
Lip Sync
    ↓
Saeed speaks
```

The complete LLM response does not need to arrive before playback begins.

---

# 37. Audio/Lip-Sync Flow

Complete implementation:

```text
             USER
              │
              ▼
        Microphone Input
              │
              ▼
        MediaRecorder
              │
              ▼
             STT
              │
              ▼
        Transcript
              │
              ▼
             LLM
              │
              ▼
        Streaming Text
              │
              ▼
             TTS
              │
              ▼
       Encoded Audio
              │
              ▼
        AudioContext
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
    Speakers      Analyzer
                     │
                     ▼                  Visemes
                     │
                     ▼
              VRM Expressions
                     │
                     ▼
                Mouth Motion
```

---

# 38. Error Handling

Every external service can fail.

Handle:

```text
Microphone denied
STT timeout
STT invalid audio
LLM timeout
LLM rate limit
TTS failure
Network disconnect
Invalid VRM
Invalid VRMA
Audio decoding error
Database error
Missing model
GPU failure
```

The avatar should react gracefully.

Example:

```text
Network error
    ↓
Expression: confused
Animation: thinking
UI: retry
```

Never allow a failed API request to crash the Electron process.

---

# 39. Performance Requirements

Target:

```text
60 FPS
```

on a reasonable modern Windows GPU.

Optimize:

- VRM polygon count
- Texture resolution
- Animation count
- Draw calls
- Shadow quality
- Post-processing
- Audio analysis frequency
- React rerenders

Avoid putting high-frequency animation data into React state.

Use refs for real-time animation:

```ts
useRef()
```

rather than:

```ts
setState()
```

for every frame.

---

# 40. Testing

## Unit Tests

Test:

- Memory manager
- API clients
- State machine
- TTS queue
- Viseme mapping
- Configuration

## Integration Tests

Test:

```text
Microphone → STT
STT → LLM
LLM → TTS
TTS → Audio
Audio → Lip Sync
```

## Visual Tests

Verify:

- Transparent background
- VRM loading
- Facial expressions
- Blinking
- Lip sync
- Animation transitions

## Packaging Tests

Verify:

```text
Fresh Windows installation
Portable ZIP
Installer
Uninstaller
Offline startup
Missing API key
Missing model
```

---

# 41. Logging and Diagnostics

Create:

```text
%APPDATA%/Saeed/logs/
```

Logs:

```text
main.log
renderer.log
audio.log
ai.log
tts.log
memory.log
```

Include timestamps.

Example:

```text
2026-09-25T18:30:00Z [TTS] Started synthesis
2026-09-25T18:30:01Z [AUDIO] Received 128KB
2026-09-25T18:30:01Z [LIPSYNC] Started
```

Do not log:

- API keys
- Passwords
- Authentication tokens
- Sensitive personal data

---

# 42. Privacy

Saeed should clearly distinguish local and remote processing.

## Local

Potentially local:

- VRM
- Animations
- SQLite
- Piper
- Audio playback
- Character state

## Remote

Potentially remote:

- STT
- LLM
- Cloud TTS
- Analytics

The settings UI should show the user which providers are active.

Example:

```text
Speech Recognition:
  Remote / Local

AI:
  Remote

Voice:
  Piper / Fish / Azure / Edge
```

---

# 43. Distribution Checklist

Before releasing:

- [ ] App launches
- [ ] Transparent window works
- [ ] Always-on-top works
- [ ] VRM loads
- [ ] Animations load
- [ ] Microphone works
- [ ] STT works
- [ ] LLM works
- [ ] Streaming works
- [ ] TTS works
- [ ] Lip sync works
- [ ] Memory works
- [ ] Settings persist
- [ ] Logs work
- [ ] Windows x64 build works
- [ ] Portable ZIP works
- [ ] Installer works
- [ ] Uninstaller works
- [ ] API keys are not bundled
- [ ] Production source maps are handled appropriately
- [ ] Crash recovery works

---

# 44. Future Features

Possible future functionality:

- Multiple VRM characters
- Character marketplace
- Custom personalities
- Voice cloning
- Local LLM
- Local Whisper
- RAG
- Vector database
- Emotion recognition
- Webcam tracking
- Face tracking
- Hand tracking
- Desktop activity awareness
- Calendar integration
- Music control
- Game integration
- Discord integration
- Custom animation editor
- Character creator
- Plugin system
- Mod support
- Cloud synchronization

---

# 45. Reference Architecture

The final Saeed architecture should look like this:

```text
                         ┌───────────────────────┐
                         │       Windows         │
                         └───────────┬───────────┘
                                     │
                              ┌──────▼──────┐
                              │   Electron  │
                              └──────┬──────┘
                                     │
                  ┌──────────────────┴──────────────────┐
                  │                                     │
           ┌──────▼──────┐                       ┌──────▼──────┐
           │ Main Process│                       │   Renderer   │
           └──────┬──────┘                       └──────┬───────┘
                  │                                     │
       ┌──────────┼──────────┐             ┌───────────┼───────────┐
       │          │          │             │           │           │
     SQLite     Local      IPC           React      Three.js     Audio
                 TTS                        │           │           │
                                           R3F         VRM       Web Audio
                                                        │           │
                                                   Animations    Lip Sync
                                                        │           │
                                                        └─────┬─────┘
                                                              │
                                                         Saeed Avatar
                                                              │
                     ┌────────────────────────────────────────┘
                     │
                     ▼
              ┌───────────────┐
              │  AI Services  │
              └───────┬───────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
         STT         LLM         TTS
          │           │           │
          └───────────┴───────────┘
```

---

# 46. Important Implementation Notes

## 46.1 Do not couple the renderer to providers

Bad:

```ts
import OpenAI from '...';
```

inside an avatar component.

Good:

```text
Avatar
  ↓
Conversation Manager
  ↓
Provider Interface
```

This keeps the architecture replaceable.

---

## 46.2 Do not store API keys in React

Never:

```ts
const API_KEY = "secret";
```

in frontend source.

Use:

```text
Electron main process
or
secure backend
```

---

## 46.3 Do not use React state for every animation frame

Animation should run outside React's normal state update cycle.

Use Three.js references.

---

## 46.4 Separate voice and avatar systems

TTS should not directly manipulate the VRM.

Use:

```text
TTS
 ↓
Audio Engine
 ↓
Lip Sync Engine
 ↓
Avatar
```

This allows the same avatar system to work with multiple TTS engines.

---

## 46.5 Make all providers replaceable

Provider interfaces should exist for:

```text
STT
LLM
TTS
Memory
```

This makes local/offline operation possible later.

---

## 46.6 Streaming should be designed from day one

Do not build:

```text
LLM complete
 ↓
TTS complete
 ↓
play
```

as the only architecture.

Prefer:

```text
LLM chunk
 ↓
TTS chunk
 ↓
Audio queue
 ↓
Playback
```

when the selected provider supports it.

---

## 46.7 VRM assets are part of the product

The repository must clearly document:

- Who created the VRM
- License
- Redistribution rights
- Texture licenses
- Animation licenses
- Voice model licenses

Do not redistribute third-party assets without permission.

---

# 47. License and Assets

Saeed's source code should have its own license.

Example:

```text
MIT License
```

However, source-code licensing does not automatically grant rights to:

- VRM characters
- Textures
- Animations
- TTS voices
- Voice models
- AI-generated assets
- Third-party libraries

Every asset must have compatible licensing.

---

# Final Development Target

The final Saeed application should provide this complete experience:

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         Windows Desktop                     │
│                                                             │
│                                                             │
│                                             ╭─────────────╮ │
│                                             │             │ │
│                                             │    SAEED    │ │
│                                             │     VRM     │ │
│                                             │             │ │
│                                             ╰─────────────╯ │
│                                                   │         │
│                                           Speaking/Idle     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                    USER SPEAKS
                         │
                         ▼
                    MICROPHONE
                         │
                         ▼
                       STT
                         │
                         ▼
                       LLM
                         │
                  STREAMING TEXT
                         │
                         ▼
                       TTS
                         │
                         ▼
                    AUDIO QUEUE
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
           SPEAKER              ANALYZER
                                    │
                                    ▼
                                 VISEMES
                                    │
                                    ▼
                              VRM EXPRESSIONS
                                    │
                                    ▼
                              SAeed SPEAKS
```

The core principle is:

**Electron is the desktop shell, React is the UI layer, React Three Fiber/Three.js is the rendering layer, VRM is the avatar format, Web Audio is the audio/lip-sync layer, and STT → LLM → TTS is the AI conversation pipeline.**

Saeed should be implemented as a modular system where every external service can be replaced without rewriting the avatar, desktop shell, memory system, or audio engine.