// Background Script - Gemini Live API Connection Handler
console.log('AI Assistant: Background script loaded');

let ws = null;
let connectionState = {
  websocket: 'disconnected', // disconnected, connecting, connected
  videoStreaming: false,
  lastError: null
};
let messageCounter = 0;
let pendingMessages = new Map(); // Track sent messages waiting for response

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
      generationConfig: {
        responseModalities: ["TEXT"] // We want text responses for now
      },
      systemInstruction: {
        parts: [{
          text: "You are a helpful AI assistant watching the user's screen. Provide context-aware assistance based on what you see and the conversation. Be concise but helpful."
        }]
      }
    }
  };
  
  console.log('AI Assistant: Sending setup message');
  ws.send(JSON.stringify(setupMessage));
}

async function handleTextMessage(text, tabId) {
  if (!isConnected()) {
    console.error('AI Assistant: Cannot send text - not connected');
    console.log('AI Assistant: Connection state:', connectionState);
    return;
  }
  
  const messageId = ++messageCounter;
  const textMessage = {
    clientContent: {
      turns: [{
        role: "user",
        parts: [{ text: text }]
      }],
      turnComplete: true
    }
  };
  
  // Track this message (without turn_id in the API payload)
  pendingMessages.set(`msg_${messageId}`, {
    text: text,
    timestamp: Date.now(),
    tabId: tabId
  });
  
  console.log(`AI Assistant: [${messageId}] Sending text message:`, text);
  console.log(`AI Assistant: [${messageId}] Full payload:`, JSON.stringify(textMessage, null, 2));
  console.log(`AI Assistant: [${messageId}] WebSocket state:`, ws.readyState);
  console.log(`AI Assistant: [${messageId}] Pending messages:`, pendingMessages.size);
  
  try {
    ws.send(JSON.stringify(textMessage));
    console.log(`AI Assistant: [${messageId}] Message sent successfully`);
  } catch (error) {
    console.error(`AI Assistant: [${messageId}] Failed to send message:`, error);
    pendingMessages.delete(`msg_${messageId}`);
  }
  
  // Timeout check for stuck messages
  setTimeout(() => {
    if (pendingMessages.has(`msg_${messageId}`)) {
      console.warn(`AI Assistant: [${messageId}] No response after 30 seconds for message: "${text}"`);
    }
  }, 30000);
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
  console.log('AI Assistant: Raw Gemini response:', JSON.stringify(response, null, 2));
  
  // Check for different response types
  if (response.setupComplete) {
    console.log('AI Assistant: Setup completed successfully');
    return;
  }
  
  if (response.serverContent) {
    console.log('AI Assistant: Received server content response');
    
    // Extract text from response parts
    let responseText = '';
    if (response.serverContent.modelTurn && response.serverContent.modelTurn.parts) {
      response.serverContent.modelTurn.parts.forEach(part => {
        if (part.text) {
          responseText += part.text;
          console.log('AI Assistant: AI Response Text:', part.text);
        }
      });
    }
    
    // Determine if turn is complete (default to false if not specified)
    const isComplete = response.serverContent.turnComplete === true;
    
    // Send response to content script if we have text
    if (responseText.trim()) {
      sendResponseToContentScript(responseText, isComplete);
    }
    
    // Handle turn completion - also send completion signal even if no text
    if (isComplete) {
      console.log('AI Assistant: Turn completed');
      
      // If no text was sent but turn is complete, send completion signal
      if (!responseText.trim()) {
        sendResponseToContentScript('', true);
      }
      
      // Clear any pending message tracking if needed
      pendingMessages.clear();
    } else {
      console.log('AI Assistant: Turn continuing...');
    }
  }
  
  if (response.toolCall) {
    console.log('AI Assistant: Received tool call');
  }
  
  if (response.error) {
    console.error('AI Assistant: Gemini error response:', response.error);
    sendErrorToContentScript(response.error);
  }
  
  // Log any unrecognized response types (but don't treat usageMetadata as unknown)
  const knownKeys = ['setupComplete', 'serverContent', 'toolCall', 'error', 'usageMetadata'];
  const unknownKeys = Object.keys(response).filter(key => !knownKeys.includes(key));
  if (unknownKeys.length > 0) {
    console.log('AI Assistant: Unknown response keys:', unknownKeys, response);
  }
}

function sendResponseToContentScript(text, isComplete = false) {
  // Send to all tabs with the extension (in case multiple tabs are open)
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'AI_RESPONSE',
        text: text,
        isComplete: isComplete
      }).catch(error => {
        // Ignore errors for tabs that don't have content script
        console.log(`AI Assistant: Could not send to tab ${tab.id} (probably no content script)`);
      });
    });
  });
}

function sendErrorToContentScript(error) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'AI_ERROR',
        error: error
      }).catch(error => {
        // Ignore errors for tabs that don't have content script
      });
    });
  });
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