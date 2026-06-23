// Connection Manager - Orchestrates connection services
globalThis.ConnectionManager = class ConnectionManager {
  constructor() {
    // Core dependencies
    this.geminiClient = new globalThis.GeminiClient();
    this.apiService = new globalThis.ApiService();
    this.errorHandler = new globalThis.ErrorHandler();

    // Connection services
    this.websocketService = new globalThis.WebSocketService(this.errorHandler);
    this.retryService = new globalThis.RetryService(this.errorHandler);
    this.messageQueue = new globalThis.MessageQueueService(this.errorHandler);
    this.setupService = new globalThis.SetupService(this.geminiClient, this.errorHandler);
    this.responseRouter = new globalThis.ResponseRouter(this.geminiClient, this.errorHandler);

    // Connection state
    this.connectionState = {
      status: 'disconnected',
      error: null,
      attempts: 0
    };

    // Initialize services
    this.initializeServices();
  }

  // Backward compatibility properties
  get ws() {
    return this.websocketService.ws;
  }

  set ws(value) {
    // For tests that set ws directly
    this.websocketService.ws = value;
  }

  get currentResponse() {
    return this.responseRouter.getCurrentResponse();
  }

  set currentResponse(value) {
    // For tests that set currentResponse directly
    this.responseRouter.currentResponse = value;
  }

  get conversationManager() {
    return this._conversationManager;
  }

  set conversationManager(value) {
    // Update both internal reference and responseRouter
    this._conversationManager = value;
    this.responseRouter.setConversationManager(value);
  }

  // Initialize service callbacks and event handlers
  initializeServices() {
    // WebSocket event handlers
    this.websocketService.setEventHandlers({
      onMessage: (data) => this.responseRouter.handleMessage(data),
      onClose: (event) => this.handleWebSocketClose(event)
    });

    // Response router callbacks
    this.responseRouter.setCallbacks({
      onSetupComplete: () => this.setupService.handleSetupComplete(),
      onSetupError: (error) => this.setupService.handleSetupError(error),
      onMessageCleared: (messageId) => this.messageQueue.clearMessageTimeout(`msg_${messageId}`)
    });

    // Message queue timeout callback
    this.messageQueue.onTimeout((messageId) => {
      if (this.geminiClient.getPendingMessage(messageId)) {
        this.errorHandler.logWarning('Connection', `Message timeout [${messageId}] - likely network issue`);
        this.geminiClient.clearPendingMessage(messageId);
        this.updateStatus('failed', 'Network timeout - check your internet connection');
      }
    });

    // Retry service network online callback
    this.retryService.onNetworkOnline(() => {
      if (this.connectionState.status === 'failed') {
        this.connect();
      }
    });
  }

  // Set conversation manager
  setConversationManager(conversationManager) {
    this.conversationManager = conversationManager;
  }

  // CORE METHOD - Main connection flow
  async connect() {
    this.updateStatus('connecting');
    this.errorHandler.info('Connection', `Connection attempt ${this.retryService.getAttempts() + 1}`);

    if (this._conversationManager && this.retryService.getAttempts() === 0) {
      this.clearConnectionMessages();
    }

    try {
      // Step 1: Get API key
      const apiKey = await this.apiService.getApiKey();
      if (!apiKey) {
        throw new Error('No API key configured');
      }

      // Step 2: Create WebSocket connection
      await this.websocketService.connect(apiKey);

      // Step 3: Send setup and wait for completion
      await this.setupService.sendSetupAndWait(this.websocketService);

      // Step 4: Success
      this.updateStatus('connected');
      this.retryService.resetAttempts();
      this.connectionState.attempts = 0;
      this.errorHandler.logSuccess('Connection', 'Connected successfully');

    } catch (error) {
      // Step 5: Handle failure
      this.errorHandler.error('Connection', `Connection failed: ${error.message}`);
      this.updateStatus('failed', error.message);
      this.scheduleRetryIfNeeded(error);
    }
  }

  // Handle WebSocket close event
  handleWebSocketClose(event) {
    this.errorHandler.debug('Connection', `WebSocket closed: code=${event.code}`);

    if (this.connectionState.status === 'connecting') {
      // Connection failed during setup - error already handled
      return;
    }

    // Connection lost after being established
    this.updateStatus('disconnected', 'Connection lost');
  }

  // Schedule retry if needed
  scheduleRetryIfNeeded(error) {
    const shouldRetry = this.retryService.scheduleRetry(() => this.connect(), error);
    this.connectionState.attempts = this.retryService.getAttempts();

    if (!shouldRetry) {
      // Max retries reached, send system message
      this.sendSystemMessage(error.message);
    }
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

    if (this._conversationManager) {
      this._conversationManager.addMessage(message, 'system', null);
    }
  }

  // Clear connection error messages
  clearConnectionMessages() {
    try {
      const filteredMessages = this._conversationManager.messages.filter(msg => {
        if (msg.sender !== 'system') return true;

        const connectionKeywords = [
          'Connection failed',
          'check your API key',
          'check your internet connection',
          'Click ↻ to retry',
          'Still connecting',
          'Not connected to AI service'
        ];

        return !connectionKeywords.some(keyword => msg.text.includes(keyword));
      });

      if (filteredMessages.length !== this._conversationManager.messages.length) {
        this._conversationManager.messages = filteredMessages;
        this._conversationManager.saveToStorage();
        this._conversationManager.broadcastUpdate();
        this.errorHandler.debug('Connection', 'Cleared connection error messages');
      }
    } catch (error) {
      this.errorHandler.error('Connection', 'Failed to clear connection messages', error.message);
    }
  }

  // Update connection status and notify UI
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

  // Manual reconnect
  manualReconnect() {
    this.errorHandler.info('Connection', 'Manual reconnection initiated');
    this.retryService.stopRetries();
    this.retryService.resetAttempts();
    this.connectionState.attempts = 0;

    if (this._conversationManager) {
      this.clearConnectionMessages();
    }

    this.connect();
  }

  // Context reset
  resetContext() {
    this.errorHandler.info('Connection', 'Resetting connection context');
    this.retryService.stopRetries();
    this.responseRouter.resetResponse();
    this.connect();
  }

  // Handle prompt update
  handlePromptUpdate() {
    this.errorHandler.info('Connection', 'Prompt updated, reconnecting');
    this.connect();
  }

  // Check if connected
  isConnected() {
    return this.connectionState.status === 'connected' && this.websocketService.isOpen();
  }

  // Get connection status
  getConnectionStatus() {
    return {
      websocket: this.connectionState.status,
      lastError: this.connectionState.error,
      reconnectAttempts: this.connectionState.attempts
    };
  }

  // Handle text message
  async handleTextMessage(text, tabId, sendResponse = null) {
    // Check network connectivity first
    if (!this.retryService.isOnline()) {
      const errorMsg = 'No internet connection - please check your network';
      this.errorHandler.info('Connection', 'navigator.onLine is false - no internet');
      this.updateStatus('failed', 'Network offline');
      if (sendResponse) {
        sendResponse({ success: false, error: errorMsg });
      }
      return;
    }

    // Do connectivity check in real browser environment
    if (typeof globalThis.fetch !== 'undefined' && !globalThis.navigator.userAgent.includes('jsdom')) {
      const connectivityCheckPassed = await this.retryService.checkConnectivity();
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
      this.websocketService.send(message);
      this.errorHandler.debug('Message', `Message sent [${messageId}]`);

      // Set timeout to detect network issues
      this.messageQueue.setMessageTimeout(`msg_${messageId}`, 5000);

      if (sendResponse) {
        sendResponse({ success: true, messageId });
      }
    } catch (error) {
      this.geminiClient.clearPendingMessage(`msg_${messageId}`);
      const userError = this.errorHandler.handleMessageError(error.message, text);

      this.updateStatus('failed', 'Send failed - check connection');

      if (sendResponse) {
        sendResponse({ success: false, error: userError });
      }
    }
  }

  // Handle screenshot
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

      this.websocketService.send(message);
      if (sendResponse) sendResponse(this.errorHandler.createSuccessResponse());
    } catch (error) {
      const userError = this.errorHandler.handleScreenshotError(error.message);
      if (sendResponse) sendResponse(this.errorHandler.createErrorResponse(userError));
    }
  }

  // Send response to content script (delegate to router)
  sendResponseToContentScript(text, isComplete = false) {
    this.responseRouter.sendResponseToContentScript(text, isComplete);
  }

  // Send error to content script (delegate to router)
  sendErrorToContentScript(error) {
    this.responseRouter.sendErrorToContentScript(error);
  }

  // Get combined system prompt (delegate to setup service)
  async getCombinedSystemPrompt() {
    return this.setupService.getCombinedSystemPrompt();
  }

  // Get selected model (delegate to setup service)
  async getSelectedModel() {
    return this.setupService.getSelectedModel();
  }

  // Legacy methods for backward compatibility
  clearMessageTimeout(messageId) {
    this.messageQueue.clearMessageTimeout(messageId);
  }

  clearMessageTimeouts() {
    this.messageQueue.clearAllTimeouts();
  }

  stopRetries() {
    this.retryService.stopRetries();
  }

  startNetworkMonitoring() {
    // Already handled by RetryService
  }

  stopNetworkMonitoring() {
    // No-op, handled by RetryService
  }

  async checkNetworkConnectivity() {
    return this.retryService.checkConnectivity();
  }

  // Clean up all services
  cleanup() {
    this.retryService.cleanup();
    this.messageQueue.cleanup();
    this.setupService.cleanup();
    this.responseRouter.cleanup();
    this.websocketService.cleanup();
    this.geminiClient.clearAllPendingMessages();
  }
};
