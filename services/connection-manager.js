// Connection Manager
globalThis.ConnectionManager = class ConnectionManager {
    constructor() {
      this.ws = null;
      this.connectionState = {
        websocket: 'disconnected',
        videoStreaming: false,
        lastError: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000
      };
      this.messageCounter = 0;
      this.pendingMessages = new Map();
      this.reconnectTimeout = null;
      this.pingInterval = null;
      this.setupComplete = false;
    }
  
    async _getApiKey() {
      try {
        let result = await chrome.storage.secure.get(['geminiApiKey']);
        if (result.geminiApiKey) return result.geminiApiKey;
      } catch (error) { /* Fall through */ }
      try {
        let result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) return result.geminiApiKey;
      } catch (err) {
        console.error('AI Assistant: Failed to get API key (CM):', err);
      }
      return null;
    }
  
    _getDefaultSystemPrompt() {
      return `You are a helpful AI assistant.

Key capabilities:
- Analyze screenshots given and provide relevant insights
- Answer questions from user.

Guidelines:
- Be concise but helpful in your responses
- Reference specific elements you see on screenshots when relevant
- Ask clarifying questions if the user's intent is unclear
- Respect user privacy and avoid commenting on sensitive information`;
    }
  
    async _getCombinedSystemPrompt() {
      try {
        const defaultPrompt = this._getDefaultSystemPrompt();
        const result = await chrome.storage.local.get(['customInstructions']);
        const customInstructions = result.customInstructions || '';
        return customInstructions.trim() ? `${defaultPrompt}\n\nUser Instructions:\n${customInstructions}` : defaultPrompt;
      } catch (error) {
        console.error('AI Assistant: Failed to get combined prompt (CM):', error);
        return this._getDefaultSystemPrompt();
      }
    }
  
    async sendSetupMessage() {
      const systemPrompt = await this._getCombinedSystemPrompt();
      const setupMessage = { 
        setup: {
          model: "models/gemini-2.0-flash-exp",
          generationConfig: { responseModalities: ["TEXT"] },
          systemInstruction: { parts: [{ text: systemPrompt }] }
        }
      };
      console.log('AI Assistant: Sending setup message (CM)');
              if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
        this.ws.send(JSON.stringify(setupMessage));
      }
    }
    
    handleGeminiResponse(responseString) {
      let response;
      try {
          if (responseString instanceof Blob) {
              responseString.text().then(text => {
                  try {
                      response = JSON.parse(text);
                      this._processParsedGeminiResponse(response);
                  } catch (e) {
                      console.error('AI Assistant: Failed to parse Blob text as JSON (CM):', e);
                  }
              });
              return;
          } else if (typeof responseString === 'string') {
              response = JSON.parse(responseString);
          } else {
              console.error('AI Assistant: Unknown type for handleGeminiResponse (CM):', typeof responseString);
              return;
          }
      } catch (e) {
          console.error('AI Assistant: Failed to parse Gemini response JSON (CM):', e);
          return;
      }
      this._processParsedGeminiResponse(response);
    }
    
    _processParsedGeminiResponse(response) {
      if (response.setupComplete) {
        this.setupComplete = true;
        return;
      }
      if (response.serverContent) {
        let responseText = '';
        if (response.serverContent.modelTurn && response.serverContent.modelTurn.parts) {
          response.serverContent.modelTurn.parts.forEach(part => {
            if (part.text) responseText += part.text;
          });
        }
        const isComplete = response.serverContent.turnComplete === true;
        if (responseText.trim()) this.sendResponseToContentScript(responseText, isComplete);
        if (isComplete) {
          if (!responseText.trim()) this.sendResponseToContentScript('', true);
          this.pendingMessages.clear();
        }
      }
      if (response.error) {
        console.error('AI Assistant: Gemini error (CM):', response.error);
        this.sendErrorToContentScript(response.error);
      }
    }
  
    sendResponseToContentScript(text, isComplete = false) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'AI_RESPONSE', text, isComplete })
            .catch(() => {});
        });
      });
    }
  
    sendErrorToContentScript(error) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'AI_ERROR', error })
            .catch(() => {});
        });
      });
    }
  
    isConnected() {
      return this.ws && this.ws.readyState === globalThis.WebSocket.OPEN && this.connectionState.websocket === 'connected';
    }
  
    async handleTextMessage(text, tabId) {
      if (!this.isConnected()) {
        chrome.tabs.sendMessage(tabId, { type: 'AI_ERROR', error: 'Not connected' }).catch(() => {});
        return;
      }
      const messageId = ++this.messageCounter;
      const textMessage = { 
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true
        }
      };
      this.pendingMessages.set(`msg_${messageId}`, { text, timestamp: Date.now(), tabId });
      try {
        this.ws.send(JSON.stringify(textMessage));
      } catch (error) {
        this.pendingMessages.delete(`msg_${messageId}`);
        chrome.tabs.sendMessage(tabId, { type: 'AI_ERROR', error: 'Send failed' }).catch(() => {});
      }
    }
  
    handleVideoChunk(base64Data, mimeType) {
      if (!this.isConnected() || !this.connectionState.videoStreaming) return;
      const videoMessage = {
        realtime_input: { media_chunks: [{ data: base64Data, mime_type: mimeType }] }
      };
      if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
        this.ws.send(JSON.stringify(videoMessage));
      }
    }
  
    startVideoStreaming() { this.connectionState.videoStreaming = true; }
    stopVideoStreaming() { this.connectionState.videoStreaming = false; }
  
    async handleTabScreenshot(tabId, sendResponse) {
      if (!this.isConnected()) {
        if (sendResponse) sendResponse({ success: false, error: 'Not connected' });
        return;
      }
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
        if (!dataUrl) {
          if (sendResponse) sendResponse({ success: false, error: 'Capture failed' });
          return;
        }
        const base64Data = dataUrl.split(',')[1];
        const messageId = ++this.messageCounter;
        const screenshotMessage = {
          clientContent: {
            turns: [{ role: "user", parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Data } }] }],
            turnComplete: true
          }
        };
        this.pendingMessages.set(`screenshot_${messageId}`, { type: 'screenshot', timestamp: Date.now(), tabId });
        if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
          this.ws.send(JSON.stringify(screenshotMessage));
          if (sendResponse) sendResponse({ success: true });
        }
      } catch (error) {
        if (sendResponse) sendResponse({ success: false, error: error.message });
      }
    }
  
    getConnectionStatus() {
        console.log('ConnectionManager getConnectionStatus called:', this.connectionState);
        return this.connectionState;
    }
  
    handlePromptUpdate() {
      this.cleanupConnection(); 
      this.connectionState.reconnectAttempts = 0;
      this.connectionState.reconnectDelay = 5000; 
      this.connectionState.lastError = null;
      
      setTimeout(() => this.initializeConnection(), 1000);
    }
  
    startHealthMonitoring() {
      if (this.pingInterval) clearInterval(this.pingInterval); 
      this.pingInterval = setInterval(() => {
        if (this.isConnected() && this.setupComplete) {
          try {
            this.ws.send(JSON.stringify({ clientContent: { turns: [] } }));
          } catch (error) {
            console.error('AI Assistant: Health ping failed (CM):', error);
          }
        }
      }, 30000);
    }
  
    cleanupHealthMonitoring() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }
  
    shouldAttemptReconnection(closeCode) {
      const permanentCloseCodes = [1000, 1001, 4001, 4003]; 
      return !permanentCloseCodes.includes(closeCode) && 
             this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts;
    }
  
    attemptReconnection() {
      if (this.connectionState.reconnectAttempts >= this.connectionState.maxReconnectAttempts) {
        this.connectionState.websocket = 'failed';
        this.connectionState.lastError = 'Max reconnection attempts exceeded';
        this.notifyContentScriptOfConnectionLoss(); 
        return;
      }
      
      this.connectionState.reconnectAttempts++;
      const delay = Math.min(this.connectionState.reconnectDelay * Math.pow(1.5, this.connectionState.reconnectAttempts - 1), 60000);
      
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      
      this.reconnectTimeout = setTimeout(async () => {
        try {
          const apiKey = await this._getApiKey();
          if (apiKey) {
            this.connectToGemini(apiKey); 
          } else {
            this.connectionState.websocket = 'failed';
            this.connectionState.lastError = 'No API key for reconnection';
            this.notifyContentScriptOfConnectionLoss(); 
          }
        } catch (error) {
          this.connectionState.lastError = error.message;
          if(this.shouldAttemptReconnection(null)){ 
              this.attemptReconnection(); 
          } else {
              this.connectionState.websocket = 'failed';
              this.notifyContentScriptOfConnectionLoss();
          }
        }
      }, delay);
    }
    
    manualReconnect() {
      this.cleanupConnection(); 
      this.connectionState.reconnectAttempts = 0;
      this.connectionState.reconnectDelay = 5000; 
      this.connectionState.lastError = null;
      this.connectionState.websocket = 'disconnected'; 
      this.initializeConnection(); 
    }
  
    notifyContentScriptOfConnectionLoss() {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CONNECTION_LOST',
            canReconnect: this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts 
          }).catch(() => {});
        });
      });
    }
  
    async initializeConnection() {
      if (this.connectionState.websocket === 'connecting' || this.connectionState.websocket === 'reconnecting') {
          return;
      }
      try {
        const apiKey = await this._getApiKey(); 
        if (!apiKey) {
          this.connectionState.lastError = 'No API key configured';
          this.connectionState.websocket = 'failed';
          this.notifyContentScriptOfConnectionLoss(); 
          return;
        }
        this.connectToGemini(apiKey);
      } catch (error) {
        this.connectionState.lastError = error.message;
        this.connectionState.websocket = 'failed';
        this.notifyContentScriptOfConnectionLoss(); 
      }
    }
  
    connectToGemini(apiKey) {
      if (this.ws && (this.ws.readyState === globalThis.WebSocket.OPEN || this.ws.readyState === globalThis.WebSocket.CONNECTING)) {
        this.cleanupConnection();
      }
  
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      this.connectionState.websocket = this.connectionState.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
      this.setupComplete = false;
      
      this.ws = new globalThis.WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.connectionState.websocket = 'connected';
        this.connectionState.lastError = null;
        this.connectionState.reconnectAttempts = 0; 
        this.connectionState.reconnectDelay = 5000; 
        
        this.sendSetupMessage();   
        this.startHealthMonitoring();
      };
      
      this.ws.onmessage = (event) => {
          if (event.data instanceof Blob) {
              event.data.text().then(text => this.handleGeminiResponse(text));
          } else {
              this.handleGeminiResponse(event.data);
          }
      };
      
      this.ws.onerror = (errorEvent) => { 
        this.connectionState.lastError = 'WebSocket connection error';
      };
      
      this.ws.onclose = (event) => {
        this.cleanupHealthMonitoring();
        this.connectionState.websocket = 'disconnected';
        this.setupComplete = false;
        
        if (this.shouldAttemptReconnection(event.code)) {
          this.attemptReconnection();
        } else {
          this.connectionState.lastError = `Connection closed: ${event.reason || event.code || 'Unknown'}`;
          this.connectionState.websocket = 'failed';
          this.notifyContentScriptOfConnectionLoss();
        }
      };
    }
  
    cleanupConnection() {
      this.cleanupHealthMonitoring(); 
      if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
      }
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        if (this.ws.readyState === globalThis.WebSocket.OPEN || this.ws.readyState === globalThis.WebSocket.CONNECTING) {
          this.ws.close(1000, "Client cleanup");
        }
        this.ws = null;
      }
      this.setupComplete = false;
    }
};