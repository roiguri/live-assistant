// Connection Manager - Handles the connection to the Gemini API and the communication with the content script.
globalThis.ConnectionManager = class ConnectionManager {
    constructor() {
      this.ws = null;
      this.pendingMessages = new Map();
      this.connectionState = {
        websocket: 'disconnected',
        lastError: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000
      };
      this.setupComplete = false;
      this.pingInterval = null;
      this.reconnectTimeout = null;
      this.currentResponse = ''; // Track streaming response

      this.geminiClient = new globalThis.GeminiClient(new globalThis.ErrorHandler());
      this.apiService = new globalThis.ApiService();
      this.errorHandler = new globalThis.ErrorHandler();
      this.conversationManager = null; // Will be set by setConversationManager
    }
  
    setConversationManager(conversationManager) {
        this.conversationManager = conversationManager;
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
        this.errorHandler.handleStorageError(error, 'get custom prompt');
        return this._getDefaultSystemPrompt();
      }
    }
  
    async sendSetupMessage() {
      const systemPrompt = await this._getCombinedSystemPrompt();
      const setupMessage = this.geminiClient.createSetupMessage(systemPrompt);
      
      if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
          this.ws.send(JSON.stringify(setupMessage));
          this.errorHandler.debug('Connection', 'Setup message sent');
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
                this.setupComplete = true;
                this.errorHandler.logSuccess('Connection', 'Setup completed');
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
                this.errorHandler.info('API', 'Tool call received');
                // TODO: Handle tool calls when implemented
                break;

            case 'error':
                this.errorHandler.handleApiError(result.error, 'Gemini response');
                this.sendErrorToContentScript(result.error);
                break;

            case 'metadata':
                // Ignore usage metadata
                break;

            case 'unknown':
                this.errorHandler.logWarning('API', 'Unknown response type', result.response);
                break;

            case 'empty':
                // Ignore empty responses
                break;

            default:
                this.errorHandler.logWarning('API', `Unhandled result type: ${result.type}`);
        }
    }
  
    sendResponseToContentScript(text, isComplete = false) {
      // Track streaming response text
      this.currentResponse += text;
      
      // Store AI message in conversation manager when complete
      if (isComplete && this.conversationManager) {
        this.conversationManager.addMessage(this.currentResponse, 'ai', null);
        this.currentResponse = ''; // Reset for next response
      }
      
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
          const error = 'Not connected to AI service';
          this.errorHandler.handleConnectionError(error);
          chrome.tabs.sendMessage(tabId, { type: 'AI_ERROR', error }).catch(() => {});
          return;
      }

      const { message, messageId } = this.geminiClient.createTextMessage(text);
      
      try {
          this.ws.send(JSON.stringify(message));
          this.errorHandler.debug('Message', `Message sent [${messageId}]`);
      } catch (error) {
          this.geminiClient.clearPendingMessage(`msg_${messageId}`);
          const userError = this.errorHandler.handleMessageError(error.message, text);
          chrome.tabs.sendMessage(tabId, { type: 'AI_ERROR', error: userError }).catch(() => {});
      }

      // Timeout check for stuck messages
      setTimeout(() => {
          if (this.geminiClient.getPendingMessage(`msg_${messageId}`)) {
              this.errorHandler.logWarning('Message', `No response after 30s [${messageId}]`);
          }
      }, 30000);
    }
  
    async handleTabScreenshot(tabId, sendResponse) {
        if (!this.isConnected()) {
            const error = 'Not connected to AI service';
            this.errorHandler.handleConnectionError(error);
            if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(error));
            return;
        }
        
        try {
            const startTime = Date.now();
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
            
            if (!dataUrl) {
                const error = 'Failed to capture screenshot';
                this.errorHandler.handleScreenshotError(error);
                if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(error));
                return;
            }
            
            const base64Data = dataUrl.split(',')[1];
            const { message, messageId } = this.geminiClient.createScreenshotMessage(base64Data);
            
            if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
                const duration = Date.now() - startTime;
                this.errorHandler.logPerformance('Screenshot', 'capture and send', duration);
                if (sendResponse) sendResponse(this.errorHandler.createSuccessResponse());
            }
        } catch (error) {
            const userError = this.errorHandler.handleScreenshotError(error.message);
            if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(userError));
        }
    }
  
    getConnectionStatus() { return this.connectionState; }
  
    handlePromptUpdate() {
      this.errorHandler.info('Connection', 'Prompt updated, reconnecting');
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
                  this.errorHandler.handleConnectionError(error.message, 'Health ping');
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
          this.errorHandler.error('Connection', 'Max reconnection attempts exceeded');
          this.notifyContentScriptOfConnectionLoss();
          return;
      }
      
      this.connectionState.reconnectAttempts++;
      const delay = Math.min(this.connectionState.reconnectDelay * Math.pow(1.5, this.connectionState.reconnectAttempts - 1), 60000);
      
      this.errorHandler.info('Connection', `Reconnecting in ${delay}ms (attempt ${this.connectionState.reconnectAttempts})`);
      
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      
      this.reconnectTimeout = setTimeout(async () => {
          try {
              const apiKey = await this.apiService.getApiKey();
              if (apiKey) {
                  this.connectToGemini(apiKey);
              } else {
                  this.connectionState.websocket = 'failed';
                  this.connectionState.lastError = 'No API key for reconnection';
                  this.errorHandler.handleConnectionError('No API key configured');
                  this.notifyContentScriptOfConnectionLoss();
              }
          } catch (error) {
              this.connectionState.lastError = error.message;
              if(this.shouldAttemptReconnection(null)){
                  this.attemptReconnection();
              } else {
                  this.connectionState.websocket = 'failed';
                  this.errorHandler.handleConnectionError(error.message, 'Reconnection');
                  this.notifyContentScriptOfConnectionLoss();
              }
          }
      }, delay);
    }
    
    manualReconnect() {
      this.errorHandler.info('Connection', 'Manual reconnection initiated');
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
              this.errorHandler.handleConnectionError('No API key configured');
              this.notifyContentScriptOfConnectionLoss();
              return;
          }
          this.connectToGemini(apiKey);
      } catch (error) {
          this.connectionState.lastError = error.message;
          this.connectionState.websocket = 'failed';
          this.errorHandler.handleConnectionError(error.message, 'Connection initialization');
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
      
      this.errorHandler.info('Connection', `Connecting to Gemini (attempt ${this.connectionState.reconnectAttempts + 1})`);
      
      this.ws = new globalThis.WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.connectionState.websocket = 'connected';
        this.connectionState.lastError = null;
        this.connectionState.reconnectAttempts = 0; 
        this.connectionState.reconnectDelay = 5000; 
        
        this.errorHandler.logSuccess('Connection', 'Connected to Gemini');
        this.sendSetupMessage();   
        this.startHealthMonitoring();
      };
      
      this.ws.onmessage = (event) => {
          this.handleGeminiResponse(event.data);
      };
      
      this.ws.onerror = (errorEvent) => { 
        this.connectionState.lastError = 'WebSocket connection error';
        this.errorHandler.handleConnectionError('WebSocket error');
      };
      
      this.ws.onclose = (event) => {
        this.cleanupHealthMonitoring();
        this.connectionState.websocket = 'disconnected';
        this.setupComplete = false;
        
        if (this.shouldAttemptReconnection(event.code)) {
          this.attemptReconnection();
        } else {
          const reason = event.reason || event.code || 'Unknown';
          this.connectionState.lastError = `Connection closed: ${reason}`;
          this.connectionState.websocket = 'failed';
          this.errorHandler.handleConnectionError(`Connection closed: ${reason}`);
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