// Background Script - Gemini Live API Connection Handler
console.log('AI Assistant: Background script loaded');

let ws = null;
let connectionState = {
  websocket: 'disconnected', // disconnected, connecting, connected
  videoStreaming: false,
  lastError: null
};

// Initialize connection when extension starts
chrome.runtime.onStartup.addListener(initializeConnection);
chrome.runtime.onInstalled.addListener(initializeConnection);

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  switch (message.type) {
    case 'SEND_TEXT_MESSAGE':
      handleTextMessage(message.text, sender.tab.id);
      break;
    case 'SEND_VIDEO_CHUNK':
      handleVideoChunk(message.data, message.mimeType, sender.tab.id);
      break;
    case 'START_VIDEO_STREAM':
      startVideoStreaming(sender.tab.id);
      break;
    case 'STOP_VIDEO_STREAM':
      stopVideoStreaming(sender.tab.id);
      break;
    case 'GET_CONNECTION_STATUS':
      sendResponse(connectionState);
      break;
  }
});

async function initializeConnection() {
  console.log('AI Assistant: Initializing Gemini Live connection...');
  
  try {
    // Get API key from storage
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('AI Assistant: No API key found');
      connectionState.lastError = 'No API key configured';
      return;
    }
    
    // Connect to Gemini Live API
    connectToGemini(apiKey);
    
  } catch (error) {
    console.error('AI Assistant: Failed to initialize connection:', error);
    connectionState.lastError = error.message;
  }
}

function connectToGemini(apiKey) {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  
  console.log('AI Assistant: Connecting to Gemini Live API...');
  connectionState.websocket = 'connecting';
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = function() {
    console.log('AI Assistant: WebSocket connected successfully');
    connectionState.websocket = 'connected';
    connectionState.lastError = null;
    
    // Send setup message
    sendSetupMessage();
  };
  
  ws.onmessage = function(event) {
    console.log('AI Assistant: Received from Gemini:', typeof event.data, event.data);
    
    try {
      // Handle different data types
      let data = event.data;
      if (data instanceof Blob) {
        // Convert Blob to text first
        data.text().then(text => {
          handleGeminiResponse(JSON.parse(text));
        });
      } else if (typeof data === 'string') {
        handleGeminiResponse(JSON.parse(data));
      } else {
        console.log('AI Assistant: Unknown message type:', typeof data);
      }
    } catch (error) {
      console.error('AI Assistant: Failed to parse message:', error, event.data);
    }
  };
  
  ws.onerror = function(error) {
    console.error('AI Assistant: WebSocket error:', error);
    connectionState.lastError = 'WebSocket connection error';
  };
  
  ws.onclose = function(event) {
    console.log('AI Assistant: WebSocket closed:', event.code, event.reason);
    connectionState.websocket = 'disconnected';
    
    // Attempt reconnection after delay
    setTimeout(() => {
      if (connectionState.websocket === 'disconnected') {
        console.log('AI Assistant: Attempting to reconnect...');
        initializeConnection();
      }
    }, 5000);
  };
}

function sendSetupMessage() {
  const setupMessage = {
    setup: {
      model: "models/gemini-2.0-flash-exp",
      system_instruction: {
        parts: [{
          text: "You are a helpful AI assistant watching the user's screen. Provide context-aware assistance based on what you see and the conversation. Be concise but helpful."
        }]
      }
    }
  };
  
  console.log('AI Assistant: Sending setup message');
  ws.send(JSON.stringify(setupMessage));
}

function handleTextMessage(text, tabId) {
  if (!isConnected()) {
    console.error('AI Assistant: Cannot send text - not connected');
    return;
  }
  
  const textMessage = {
    client_content: {
      turns: [{
        parts: [{ text: text }]
      }]
    }
  };
  
  console.log('AI Assistant: Sending text message:', text);
  ws.send(JSON.stringify(textMessage));
}

function handleVideoChunk(base64Data, mimeType, tabId) {
  if (!isConnected() || !connectionState.videoStreaming) {
    return;
  }
  
  const videoMessage = {
    realtime_input: {
      media_chunks: [{
        data: base64Data,
        mime_type: mimeType
      }]
    }
  };
  
  console.log('AI Assistant: Sending video chunk, size:', base64Data.length);
  ws.send(JSON.stringify(videoMessage));
}

function startVideoStreaming(tabId) {
  console.log('AI Assistant: Starting video streaming');
  connectionState.videoStreaming = true;
}

function stopVideoStreaming(tabId) {
  console.log('AI Assistant: Stopping video streaming');
  connectionState.videoStreaming = false;
}

function handleGeminiResponse(response) {
  console.log('AI Assistant: Processing Gemini response:', response);
  
  // Forward response to content script
  // (This will be implemented in Step 3.1)
  // For now, just log the response
}

function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN && connectionState.websocket === 'connected';
}

async function getApiKey() {
  try {
    // Try secure storage first
    let result = await chrome.storage.secure.get(['geminiApiKey']);
    if (result.geminiApiKey) {
      return result.geminiApiKey;
    }
  } catch (error) {
    // Fallback to local storage
    try {
      let result = await chrome.storage.local.get(['geminiApiKey']);
      if (result.geminiApiKey) {
        return result.geminiApiKey;
      }
    } catch (err) {
      console.error('AI Assistant: Failed to get API key:', err);
    }
  }
  
  return null;
}