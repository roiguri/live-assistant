// Connection Manager - Handles the connection to the Gemini API and the communication with the content script.
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
      this.reconnectTimeout = null;
      this.pingInterval = null;
      this.setupComplete = false;
      this.geminiClient = new globalThis.GeminiClient();
      this.apiService = new globalThis.ApiService();
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
      const setupMessage = this.geminiClient.createSetupMessage(systemPrompt);
      
      console.log('AI Assistant: Sending setup message (CM)');
      if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
          this.ws.send(JSON.stringify(setupMessage));
      }
    }
    
    handleGeminiResponse(responseData) {
      const result = this.geminiClient.parseResponse(responseData);
      
      // Handle async result (for Blob responses)
      if (result && typeof result.then === 'function') {
          result.then(parsedResult => {
              this._processGeminiResult(parsedResult);
          });
      } else {
          this._processGeminiResult(result);
      }
    }
    
    _processGeminiResult(result) {
        switch (result.type) {
            case 'setup_complete':
                console.log('AI Assistant: Setup completed successfully');
                this.setupComplete = true;
                break;

            case 'content':
                if (result.text.trim()) {
                    this.sendResponseToContentScript(result.text, result.isComplete);
                }
                if (result.isComplete) {
                    if (!result.text.trim()) {
                        this.sendResponseToContentScript('', true);
                    }
                    this.geminiClient.clearAllPendingMessages();
                }
                break;

            case 'tool_call':
                console.log('AI Assistant: Received tool call');
                // TODO: Handle tool calls when implemented
                break;

            case 'error':
                console.error('AI Assistant: Gemini error response:', result.error);
                this.sendErrorToContentScript(result.error);
                break;

            case 'metadata':
                // Ignore usage metadata
                break;

            case 'unknown':
                console.log('AI Assistant: Unknown response type:', result.response);
                break;

            case 'empty':
                // Ignore empty responses
                break;

            default:
                console.warn('AI Assistant: Unhandled result type:', result.type);
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

      const { message, messageId } = this.geminiClient.createTextMessage(text);
      
      try {
          this.ws.send(JSON.stringify(message));
          console.log(`AI Assistant: [${messageId}] Message sent successfully`);
      } catch (error) {
          this.geminiClient.clearPendingMessage(`msg_${messageId}`);
          chrome.tabs.sendMessage(tabId, { type: 'AI_ERROR', error: 'Send failed' }).catch(() => {});
      }

      // Timeout check for stuck messages
      setTimeout(() => {
          if (this.geminiClient.getPendingMessage(`msg_${messageId}`)) {
              console.warn(`AI Assistant: [${messageId}] No response after 30 seconds`);
          }
      }, 30000);
    }
  
    handleVideoChunk(base64Data, mimeType) {
      if (!this.isConnected() || !this.connectionState.videoStreaming) return;
      
      const videoMessage = this.geminiClient.createVideoMessage(base64Data, mimeType);
      
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
            const { message, messageId } = this.geminiClient.createScreenshotMessage(base64Data);
            
            if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
                console.log(`AI Assistant: [${messageId}] Screenshot sent successfully`);
                if (sendResponse) sendResponse({ success: true });
            }
        } catch (error) {
            if (sendResponse) sendResponse({ success: false, error: error.message });
        }
    }
  
    getConnectionStatus() { return this.connectionState; }
  
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
                  const healthPing = this.geminiClient.createHealthPing();
                  this.ws.send(JSON.stringify(healthPing));
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
              const apiKey = await this.apiService.getApiKey();
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
          const apiKey = await this.apiService.getApiKey();
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
          this.handleGeminiResponse(event.data);
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
      this.geminiClient.clearAllPendingMessages();
    }
};