// Connection Manager - Simple Linear Flow
globalThis.ConnectionManager = class ConnectionManager {
  constructor() {
      this.ws = null;
      this.connectionState = {
          status: 'disconnected',
          error: null,
          attempts: 0
      };
      this.currentResponse = '';
      this.retryTimeout = null;
      this.setupTimeout = null;
      this.networkCheckInterval = null;
      this.messageTimeouts = new Map();
      
      // Event handlers for setup completion
      this.onSetupComplete = null;
      this.onSetupError = null;
      
      // Dependencies
      this.geminiClient = new globalThis.GeminiClient();
      this.apiService = new globalThis.ApiService();
      this.errorHandler = new globalThis.ErrorHandler();
      this.conversationManager = null;
      
      // Start network monitoring
      this.startNetworkMonitoring();
  }
  
  setConversationManager(conversationManager) {
      this.conversationManager = conversationManager;
  }
  
  // CORE METHOD - Everything goes through this
  async connect() {
      this.updateStatus('connecting');
      this.errorHandler.info('Connection', `Connection attempt ${this.connectionState.attempts + 1}`);

      if (this.conversationManager && this.connectionState.attempts === 0) {
        this.clearConnectionMessages();
      }
      
      try {
          // Step 1: Get API key
          const apiKey = await this.apiService.getApiKey();
          if (!apiKey) {
              throw new Error('No API key configured');
          }
          
          // Step 2: Create WebSocket
          await this.createWebSocket(apiKey);
          
          // Step 3: Send setup and wait for completion
          await this.sendSetupAndWait();
          
          // Step 4: Success
          this.updateStatus('connected');
          this.connectionState.attempts = 0;
          this.errorHandler.logSuccess('Connection', 'Connected successfully');
          
      } catch (error) {
          // Step 5: Handle any failure
          this.errorHandler.error('Connection', `Connection failed: ${error.message}`);
          this.updateStatus('failed', error.message);
          this.scheduleRetryIfNeeded(error);
      }
  }

  clearConnectionMessages() {
    try {
        // Filter out connection-related system messages
        const filteredMessages = this.conversationManager.messages.filter(msg => {
            if (msg.sender !== 'system') return true; // Keep all user/AI messages
            
            // Remove connection-related system messages
            const connectionKeywords = [
                'Connection failed',
                'check your API key',
                'check your internet connection',
                'Click ↻ to retry',
                'Still connecting',
                'Not connected to AI service'
            ];
            
            return !connectionKeywords.some(keyword => 
                msg.text.includes(keyword)
            );
        });
        
        // Only update if there were connection messages to remove
        if (filteredMessages.length !== this.conversationManager.messages.length) {
            this.conversationManager.messages = filteredMessages;
            this.conversationManager.saveToStorage();
            this.conversationManager.broadcastUpdate();
            this.errorHandler.debug('Connection', 'Cleared connection error messages');
        }
    } catch (error) {
        this.errorHandler.error('Connection', 'Failed to clear connection messages', error.message);
    }
  }
  
  // Create WebSocket connection
  async createWebSocket(apiKey) {
      return new Promise((resolve, reject) => {
          this.cleanup(); // Clean up any existing connection
          
          const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
          this.ws = new globalThis.WebSocket(wsUrl);
          
          // Connection timeout
          const connectionTimeout = setTimeout(() => {
              reject(new Error('WebSocket connection timeout'));
          }, 5000);
          
          this.ws.onopen = () => {
              clearTimeout(connectionTimeout);
              this.errorHandler.debug('Connection', 'WebSocket opened');
              resolve();
          };
          
          this.ws.onerror = () => {
              clearTimeout(connectionTimeout);
              reject(new Error('WebSocket connection error'));
          };
          
          this.ws.onclose = (event) => {
              clearTimeout(connectionTimeout);
              this.errorHandler.debug('Connection', `WebSocket closed: code=${event.code}, reason=${event.reason}`);
              
              if (this.connectionState.status === 'connecting') {
                  reject(new Error('WebSocket closed during connection'));
              } else {
                  // Connection lost after being established
                  this.updateStatus('disconnected', 'Connection lost');
              }
          };
          
          // Set up message handling
          this.ws.onmessage = (event) => {
              this.handleGeminiResponse(event.data);
          };
      });
  }
  
  // Send setup message and wait for completion
  async sendSetupAndWait() {
      return new Promise(async (resolve, reject) => {
          // Set up completion handlers
          this.onSetupComplete = () => {
              clearTimeout(this.setupTimeout);
              resolve();
          };
          
          this.onSetupError = (error) => {
              clearTimeout(this.setupTimeout);
              reject(new Error(error));
          };
          
          // Setup timeout
          this.setupTimeout = setTimeout(() => {
              reject(new Error('Setup timeout - check API key'));
          }, 5000);
          
          // Send setup message
          const systemPrompt = await this.getCombinedSystemPrompt();
          const selectedModel = await this.getSelectedModel();
          const setupMessage = this.geminiClient.createSetupMessage(systemPrompt, selectedModel);
          
          if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
              this.ws.send(JSON.stringify(setupMessage));
              this.errorHandler.debug('Connection', 'Setup message sent');
          } else {
              reject(new Error('WebSocket not ready for setup'));
          }
      });
  }
  
  // Handle responses from Gemini
  handleGeminiResponse(responseData) {
      const result = this.geminiClient.parseResponse(responseData);
      
      if (result && typeof result.then === 'function') {
          result.then(parsedResult => {
              this.processGeminiResult(parsedResult);
          });
      } else {
          this.processGeminiResult(result);
      }
  }
  
  processGeminiResult(result) {
      switch (result.type) {
          case 'setup_complete':
              if (this.onSetupComplete) {
                  this.onSetupComplete();
                  this.onSetupComplete = null;
                  this.onSetupError = null;
              }
              break;
              
          case 'content':
              // Clear timeout for this specific message if we can identify it
              if (result.messageId) {
                  this.clearMessageTimeout(result.messageId);
              }
              
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
              
          case 'error':
              if (this.onSetupError) {
                  this.onSetupError(result.error);
                  this.onSetupComplete = null;
                  this.onSetupError = null;
              } else {
                  this.sendErrorToContentScript(result.error);
              }
              break;
              
          case 'tool_call':
              this.errorHandler.info('API', 'Tool call received');
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
  
  // Update status and notify UI
  updateStatus(status, error = null) {
      this.connectionState.status = status;
      this.connectionState.error = error;
      
      this.errorHandler.debug('Connection', `Status updated: ${status}${error ? ` (${error})` : ''}`);
      
      // Notify content scripts
      chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                  type: 'CONNECTION_STATUS',
                  status: status
              }).catch(() => {});
          });
      });
  }
  
  // Schedule retry if needed
  scheduleRetryIfNeeded(error) {
      this.connectionState.attempts++;
      
      // Max 2 attempts
      if (this.connectionState.attempts >= 1) {
          this.errorHandler.error('Connection', `Connection failed after ${this.connectionState.attempts} attempts`);
          this.sendSystemMessage(error.message);
          return;
      }
      
      // Schedule retry
      const delay = 1500; // 1.5 second delay between attempts
      this.errorHandler.info('Connection', `Retrying in ${delay}ms (attempt ${this.connectionState.attempts + 1})`);
      
      this.retryTimeout = setTimeout(() => {
          this.connect();
      }, delay);
  }
  
  // Send system message with appropriate error
  sendSystemMessage(originalError) {
      let message = 'Connection failed.';
      
      if (originalError.includes('No API key')) {
        message = 'No API key configured - please add your API key in settings.';
      } else if (originalError.includes('API key') || 
              originalError.includes('401') || 
              originalError.includes('403') ||
              originalError.includes('Invalid API key')) {
            message = 'Connection failed - please check your API key.';
      } else if (originalError.includes('network') || 
                originalError.includes('ERR_NETWORK') ||
              originalError.includes('offline')) {
          message = 'Connection failed - please check your internet connection.';
      } else {
          message = 'Connection failed - please check your API key and internet connection.';
      }
      
      message += ' Click ↻ to retry.';
      
      if (this.conversationManager) {
          this.conversationManager.addMessage(message, 'system', null);
      }
  }
  
  // Manual reconnect - just call connect()
  manualReconnect() {
      this.errorHandler.info('Connection', 'Manual reconnection initiated');
      this.stopRetries();
      this.connectionState.attempts = 0; // Reset attempt counter for manual retry

      if (this.conversationManager) {
        this.clearConnectionMessages();
      }

      this.connect();
  }
  
  // Context reset - just call connect()
  resetContext() {
      this.errorHandler.info('Connection', 'Resetting connection context');
      this.stopRetries();
      this.currentResponse = '';
      this.connect();
  }
  
  // Stop any ongoing retries
  stopRetries() {
      if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
      }
  }
  
  // Network monitoring using browser online/offline events
  startNetworkMonitoring() {
      // Listen for browser online/offline events
      globalThis.addEventListener('online', () => {
          this.errorHandler.info('Connection', 'Network came back online');
          if (this.connectionState.status === 'failed') {
              // Try to reconnect when network comes back
              this.connect();
          }
      });
      
      globalThis.addEventListener('offline', () => {
          this.errorHandler.info('Connection', 'Network went offline');
          this.updateStatus('failed', 'Network offline');
      });
      
      // Check initial online status
      if (!globalThis.navigator.onLine) {
          this.updateStatus('failed', 'Network offline');
      }
  }
  
  stopNetworkMonitoring() {
      // Clean up event listeners if needed
      // Note: In a service worker context, we don't typically remove these listeners
  }

  // Improved network connectivity check with fallback URLs
  async checkNetworkConnectivity() {
      const testUrls = [
          'https://generativelanguage.googleapis.com',  // Primary service endpoint
          'https://www.googleapis.com',                 // Google APIs (fallback)
          'https://8.8.8.8',                          // Public DNS (fallback)
      ];

      for (const url of testUrls) {
          try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              
              await fetch(url, {
                  method: 'HEAD',
                  mode: 'no-cors',
                  signal: controller.signal,
                  cache: 'no-cache'
              });
              
              clearTimeout(timeoutId);
              this.errorHandler.debug('Connection', `Network connectivity check passed using ${url}`);
              return true;
          } catch (error) {
              this.errorHandler.debug('Connection', `Network check failed for ${url}: ${error.message}`);
              // Continue to next URL
          }
      }
      
      // All connectivity checks failed
      return false;
  }
  
  clearMessageTimeout(messageId) {
      if (this.messageTimeouts && this.messageTimeouts.has(`msg_${messageId}`)) {
          const timeoutId = this.messageTimeouts.get(`msg_${messageId}`);
          clearTimeout(timeoutId);
          this.messageTimeouts.delete(`msg_${messageId}`);
          this.errorHandler.debug('Connection', `Cleared timeout for message ${messageId}`);
      }
  }

  clearMessageTimeouts() {
      if (this.messageTimeouts) {
          this.messageTimeouts.forEach((timeoutId) => {
              clearTimeout(timeoutId);
          });
          this.messageTimeouts.clear();
      }
  }

  // Clean up connection
  cleanup() {
      this.stopRetries();
      this.stopNetworkMonitoring();
      this.clearMessageTimeouts();
      
      if (this.setupTimeout) {
          clearTimeout(this.setupTimeout);
          this.setupTimeout = null;
      }
      
      if (this.ws) {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          
          if (this.ws.readyState === globalThis.WebSocket.OPEN || 
              this.ws.readyState === globalThis.WebSocket.CONNECTING) {
              this.ws.close(1000, 'Connection cleanup');
          }
          this.ws = null;
      }
      
      this.onSetupComplete = null;
      this.onSetupError = null;
      this.geminiClient.clearAllPendingMessages();
  }
  
  // Public interface
  isConnected() {
      return this.connectionState.status === 'connected' && 
             this.ws && 
             this.ws.readyState === globalThis.WebSocket.OPEN;
  }
  
  getConnectionStatus() {
      return {
          websocket: this.connectionState.status,
          lastError: this.connectionState.error,
          reconnectAttempts: this.connectionState.attempts
      };
  }
  
  // Message handling
  async handleTextMessage(text, tabId, sendResponse = null) {
      // Check network connectivity first
      if (!globalThis.navigator.onLine) {
          const errorMsg = 'No internet connection - please check your network';
          this.errorHandler.info('Connection', 'navigator.onLine is false - no internet');
          this.updateStatus('failed', 'Network offline');
          if (sendResponse) {
              sendResponse({ success: false, error: errorMsg });
          }
          return;
      }
      
      // In a real browser environment, do a quick connectivity test
      if (typeof globalThis.fetch !== 'undefined' && !globalThis.navigator.userAgent.includes('jsdom')) {
          const connectivityCheckPassed = await this.checkNetworkConnectivity();
          if (!connectivityCheckPassed) {
              const errorMsg = 'No internet connection - please check your network';
              this.errorHandler.info('Connection', 'Network connectivity check failed');
              this.updateStatus('failed', 'Network offline');
              if (sendResponse) {
                  sendResponse({ success: false, error: errorMsg });
              }
              return;
          }
      }
      
      if (!this.isConnected()) {
          let error = 'Not connected to AI service';
          if (this.connectionState.status === 'connecting') {
              error = 'Still connecting - please wait...';
          } else if (this.connectionState.status === 'failed') {
              error = 'Connection failed - click ↻ to retry';
          }
          
          if (sendResponse) {
              sendResponse({ success: false, error });
          }
          return;
      }
      
      const { message, messageId } = this.geminiClient.createTextMessage(text);
      
      try {
          // Check WebSocket state before sending
          if (this.ws.readyState !== globalThis.WebSocket.OPEN) {
              throw new Error('WebSocket connection not ready');
          }
          
          this.ws.send(JSON.stringify(message));
          this.errorHandler.debug('Message', `Message sent [${messageId}]`);
          
          // Set up a timeout to detect network issues
          // If no response is received within 5 seconds, assume network problem
          const timeoutId = setTimeout(() => {
              if (this.geminiClient.getPendingMessage(`msg_${messageId}`)) {
                  this.errorHandler.logWarning('Connection', `Message timeout [${messageId}] - likely network issue`);
                  this.geminiClient.clearPendingMessage(`msg_${messageId}`);
                  this.updateStatus('failed', 'Network timeout - check your internet connection');
              }
          }, 5000);
          
          // Store timeout ID so we can clear it when response arrives
          if (!this.messageTimeouts) {
              this.messageTimeouts = new Map();
          }
          this.messageTimeouts.set(`msg_${messageId}`, timeoutId);
          
          // Message sent successfully to WebSocket
          if (sendResponse) {
              sendResponse({ success: true, messageId });
          }
      } catch (error) {
          this.geminiClient.clearPendingMessage(`msg_${messageId}`);
          const userError = this.errorHandler.handleMessageError(error.message, text);
          
          // Update connection status on send failure
          this.updateStatus('failed', 'Send failed - check connection');
          
          // Message send failed
          if (sendResponse) {
              sendResponse({ success: false, error: userError });
          }
      }
  }
  
  async handleTabScreenshot(tabId, sendResponse) {
      if (!this.isConnected()) {
          const error = 'Not connected to AI service';
          if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(error));
          return;
      }
      
      try {
          const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
          
          if (!dataUrl) {
              const error = 'Failed to capture screenshot';
              if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(error));
              return;
          }
          
          const base64Data = dataUrl.split(',')[1];
          const { message, messageId } = this.geminiClient.createScreenshotMessage(base64Data);
          
          if (this.ws && this.ws.readyState === globalThis.WebSocket.OPEN) {
              this.ws.send(JSON.stringify(message));
              if (sendResponse) sendResponse(this.errorHandler.createSuccessResponse());
          }
      } catch (error) {
          const userError = this.errorHandler.handleScreenshotError(error.message);
          if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(userError));
      }
  }
  
  sendResponseToContentScript(text, isComplete = false) {
      this.currentResponse += text;
      
      if (isComplete && this.conversationManager) {
          this.conversationManager.addMessage(this.currentResponse, 'ai', null);
          this.currentResponse = '';
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
  
  async getCombinedSystemPrompt() {
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

  async getSelectedModel() {
      try {
          const result = await chrome.storage.local.get(['selectedModel']);
          const selectedModel = result.selectedModel || 'gemini-2.0-flash-live-001';
          this.errorHandler.debug('Connection', `Retrieved model: ${selectedModel}`);
          return selectedModel;
      } catch (error) {
          this.errorHandler.handleStorageError(error, 'get selected model');
          this.errorHandler.debug('Connection', 'Falling back to default model: gemini-2.0-flash-live-001');
          return 'gemini-2.0-flash-live-001';
      }
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
  
  handlePromptUpdate() {
      this.errorHandler.info('Connection', 'Prompt updated, reconnecting');
      this.connect();
  }
};