// Background Script - Gemini Live API Connection Handler
console.log('AI Assistant: Background script loaded');

let ws = null;
let connectionState = {
  websocket: 'disconnected', // disconnected, connecting, connected
  videoStreaming: false,
  lastError: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 5000
};
let messageCounter = 0;
let pendingMessages = new Map(); // Track sent messages waiting for response
let reconnectTimeout = null;
let pingInterval = null;
let setupComplete = false;

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
    case 'TAKE_SCREENSHOT':
      handleTabScreenshot(sender.tab.id, sendResponse);
      return true;
    case 'GET_CONNECTION_STATUS':
      sendResponse(connectionState);
      break;
    case 'MANUAL_RECONNECT':
      manualReconnect();
      sendResponse({ success: true });
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
      connectionState.websocket = 'failed';
      return;
    }
    
    // Connect to Gemini Live API
    connectToGemini(apiKey);
    
  } catch (error) {
    console.error('AI Assistant: Failed to initialize connection:', error);
    connectionState.lastError = error.message;
    connectionState.websocket = 'failed';
  }
}

function connectToGemini(apiKey) {
  connectionState.websocket = 'failed';

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  
  console.log('AI Assistant: Connecting to Gemini Live API...');
  connectionState.websocket = connectionState.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
  setupComplete = false;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = function() {
    console.log('AI Assistant: WebSocket connected successfully');
    connectionState.websocket = 'connected';
    connectionState.lastError = null;
    connectionState.reconnectAttempts = 0;
    connectionState.reconnectDelay = 5000;
    
    // Send setup message
    sendSetupMessage();    
    startHealthMonitoring();
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
    cleanupHealthMonitoring();

    // Determine if this was an expected closure or error
    const wasConnected = connectionState.websocket === 'connected';
    connectionState.websocket = 'disconnected';
    
    // Handle reconnection logic
    if (shouldAttemptReconnection(event.code)) {
      attemptReconnection();
    } else {
      console.log('AI Assistant: Connection closed permanently');
      connectionState.websocket = 'failed';
      connectionState.lastError = `Connection failed: ${event.reason || 'Unknown reason'}`;
      notifyContentScriptOfConnectionLoss();
    }
  };
}

function shouldAttemptReconnection(closeCode) {
  // Don't reconnect on certain close codes
  const permanentCloseCodes = [1000, 1001, 4001, 4003]; // Normal closure, authentication issues
  
  return !permanentCloseCodes.includes(closeCode) && 
         connectionState.reconnectAttempts < connectionState.maxReconnectAttempts;
}

function attemptReconnection() {
  if (connectionState.reconnectAttempts >= connectionState.maxReconnectAttempts) {
    console.error('AI Assistant: Max reconnection attempts reached');
    connectionState.websocket = 'failed';
    connectionState.lastError = 'Max reconnection attempts exceeded';
    notifyContentScriptOfConnectionLoss();
    return;
  }
  
  connectionState.reconnectAttempts++;
  console.log(`AI Assistant: Attempting reconnection ${connectionState.reconnectAttempts}/${connectionState.maxReconnectAttempts} in ${connectionState.reconnectDelay}ms`);
  
  // Clear any existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  reconnectTimeout = setTimeout(async () => {
    try {
      const apiKey = await getApiKey();
      if (apiKey) {
        connectToGemini(apiKey);
      } else {
        connectionState.websocket = 'failed';
        connectionState.lastError = 'No API key available for reconnection';
      }
    } catch (error) {
      console.error('AI Assistant: Reconnection failed:', error);
      connectionState.lastError = error.message;
      
      // Try again with longer delay
      connectionState.reconnectDelay = Math.min(connectionState.reconnectDelay * 2, 60000); // Max 60 seconds
      attemptReconnection();
    }
  }, connectionState.reconnectDelay);
  
  // Exponential backoff
  connectionState.reconnectDelay = Math.min(connectionState.reconnectDelay * 1.5, 60000);
}

function manualReconnect() {
  console.log('AI Assistant: Manual reconnection requested');
  
  // Reset reconnection state
  connectionState.reconnectAttempts = 0;
  connectionState.reconnectDelay = 5000;
  connectionState.lastError = null;
  
  // Clear any existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Attempt connection
  initializeConnection();
}

function startHealthMonitoring() {
  // Send ping every 30 seconds to keep connection alive
  pingInterval = setInterval(() => {
    if (isConnected() && setupComplete) {
      try {
        // Send a simple setup check (no-op that tests connection)
        const pingMessage = { clientContent: { turns: [] } };
        ws.send(JSON.stringify(pingMessage));
        console.log('AI Assistant: Connection health ping sent');
      } catch (error) {
        console.error('AI Assistant: Health ping failed:', error);
        // Connection might be dead - let normal error handling take over
      }
    }
  }, 30000);
}

function cleanupHealthMonitoring() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function cleanupConnection() {
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    ws = null;
  }
  
  cleanupHealthMonitoring();
  setupComplete = false;
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

function notifyContentScriptOfConnectionLoss() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'CONNECTION_LOST',
        canReconnect: true
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    });
  });
}

async function handleTextMessage(text, tabId) {
  if (!isConnected()) {
    console.error('AI Assistant: Cannot send text - not connected');
    console.log('AI Assistant: Connection state:', connectionState);
    
    // Notify user of connection issue
    chrome.tabs.sendMessage(tabId, {
      type: 'AI_ERROR',
      error: 'Not connected to AI service. Please check your connection.'
    }).catch(() => {});
    
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
  
  pendingMessages.set(`msg_${messageId}`, {
    text: text,
    timestamp: Date.now(),
    tabId: tabId
  });
  
  console.log(`AI Assistant: [${messageId}] Sending text message:`, text);

  try {
    ws.send(JSON.stringify(textMessage));
    console.log(`AI Assistant: [${messageId}] Message sent successfully`);
  } catch (error) {
    console.error(`AI Assistant: [${messageId}] Failed to send message:`, error);
    pendingMessages.delete(`msg_${messageId}`);

    // Notify user of send failure
    chrome.tabs.sendMessage(tabId, {
      type: 'AI_ERROR',
      error: 'Failed to send message. Connection may be lost.'
    }).catch(() => {});
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

async function handleTabScreenshot(tabId, sendResponse) {
  if (!isConnected()) {
    sendResponse({ success: false, error: 'Not connected to AI service' });
    return;
  }
  
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'jpeg',
      quality: 80
    });
    
    if (!dataUrl) {
      sendResponse({ success: false, error: 'Failed to capture tab' });
      return;
    }
    
    const base64Data = dataUrl.split(',')[1];
    const messageId = ++messageCounter;
    const screenshotMessage = {
      clientContent: {
        turns: [{
          role: "user",
          parts: [{
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          }]
        }],
        turnComplete: true
      }
    };
    
    pendingMessages.set(`screenshot_${messageId}`, {
      type: 'screenshot',
      timestamp: Date.now(),
      tabId: tabId
    });
    
    console.log(`AI Assistant: [${messageId}] Sending tab screenshot, size:`, base64Data.length);
    
    ws.send(JSON.stringify(screenshotMessage));
    console.log(`AI Assistant: [${messageId}] Screenshot sent successfully`);
    
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('AI Assistant: Screenshot capture failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleGeminiResponse(response) {
  console.log('AI Assistant: Raw Gemini response:', JSON.stringify(response, null, 2));
  
  // Check for different response types
  if (response.setupComplete) {
    console.log('AI Assistant: Setup completed successfully');
    setupComplete = true;
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