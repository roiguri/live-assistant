# Live Stream AI Assistant

A Chrome extension that provides real-time AI assistance with screen capture capabilities, powered by Google's Gemini Live API.

## Features

### 🤖 Real-time AI Chat
- Instant AI responses powered by Gemini Live API
- Floating chat interface that stays accessible on any website
- Streaming responses for natural conversation flow
- Custom instructions support for personalized AI behavior

### 📸 Screen Capture & Analysis
- Take screenshots and send directly to AI for analysis
- AI can analyze and provide insights about what's visible on screen
- Perfect for getting help with websites, applications, or visual content

### ⚡ Smart Interface
- Floating chat window that adapts to your workflow
- **Minimal**: Just input field - stays out of your way
- **Recent**: Shows last AI response for quick reference  
- **Full**: Complete chat history with scrollable messages
- Draggable chat window - position anywhere on screen
- Context menu with quick actions

### ⌨️ Keyboard Shortcuts
- `Ctrl+Shift+L` (Mac: `Cmd+Shift+L`) - Toggle chat visibility
- `Ctrl+Shift+F` (Mac: `Cmd+Shift+F`) - Focus chat input
- `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) - Take screenshot and send to AI

### 🔒 Privacy
- Direct connection to Gemini API - no third-party servers
- API keys stored locally in browser
- Full control over when screenshots are taken
- No data collection or tracking

## Installation

1. **Get Gemini API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Follow [Google's guide to get an API key](https://ai.google.dev/gemini-api/docs/api-key)
   - Create an account and generate an API key

2. **Install Extension**
   - Download or clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select the extension folder

3. **Configure API Key**
   - Click the extension icon in Chrome toolbar
   - Go to "General" tab
   - Enter your Gemini API key
   - Click "Test" to verify, then "Save"

## How to Use

### Basic Chat
1. The chat interface appears in the bottom-right corner of web pages
2. Type your question in the input field
3. Press Enter or click the send button
4. AI responses appear in real-time

### Screenshot Analysis
1. Click the camera icon (📸) in the chat menu
2. Or use keyboard shortcut `Ctrl+Shift+S`
3. Screenshot is automatically captured and sent to AI
4. AI will analyze and respond about what it sees

### Chat States
- **Hover** over the chat to see the context menu
- **Click 💬** to toggle between minimal/recent/full chat views
- **Click 🗑️** to clear chat history
- **Drag** using the handle (⋮⋮) to reposition the chat

### Custom Instructions
1. Click extension icon → "Prompts" tab
2. Add custom instructions to personalize AI behavior
3. Examples:
   - "Always respond in bullet points"
   - "Focus on web development topics"
   - "Explain things like I'm a beginner"

## Settings

### General Tab
- **Chat Interface**: Toggle chat visibility on websites
- **API Key**: Configure your Gemini API key with testing

### Prompts Tab  
- **Custom Instructions**: Add up to 2000 characters of custom behavior instructions
- Instructions are combined with the default system prompt

## Technical Details

- **Architecture**: Modular design with separation of concerns
- **State Management**: Centralized chat and connection state
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Performance**: Optimized for minimal resource usage
- **Compatibility**: Works on all websites (with standard web permissions)

## Development

### File Structure
```
├── manifest.json         # Extension configuration
├── background.js         # Service worker (main logic)
├── content.js            # Content script entry point
├── popup/                # Extension popup UI
├── content/              # Content script modules
│   ├── models/             # State management
│   ├── views/              # UI rendering
│   └── controllers/        # Business logic
├── services/             # Background services
└── styles/               # CSS styling
```

### Key Technologies
- **WebSocket**: Real-time communication with Gemini Live API
- **Chrome Extensions API**: Storage, tabs, screenshots
- **Modular JavaScript**: Clean separation of concerns
- **Adaptive UI**: Interface that adjusts based on usage

---

*This extension is provided as-is. Please review Google's terms of service for the Gemini API.*