// ResponseRouter - Handles response parsing and routing from Gemini API
globalThis.ResponseRouter = class ResponseRouter {
  constructor(geminiClient, errorHandler) {
    this.geminiClient = geminiClient;
    this.errorHandler = errorHandler;
    this.currentResponse = '';
    this.conversationManager = null;

    // Callbacks for different message types
    this.callbacks = {
      onSetupComplete: null,
      onSetupError: null,
      onContent: null,
      onError: null,
      onMessageCleared: null
    };
  }

  // Set conversation manager
  setConversationManager(conversationManager) {
    this.conversationManager = conversationManager;
  }

  // Set callbacks
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Handle incoming message
  async handleMessage(responseData) {
    const result = this.geminiClient.parseResponse(responseData);

    if (result && typeof result.then === 'function') {
      const parsedResult = await result;
      this.processResult(parsedResult);
    } else {
      this.processResult(result);
    }
  }

  // Process parsed result
  processResult(result) {
    switch (result.type) {
      case 'setup_complete':
        if (this.callbacks.onSetupComplete) {
          this.callbacks.onSetupComplete();
        }
        break;

      case 'content':
        // Clear timeout for this message
        if (result.messageId && this.callbacks.onMessageCleared) {
          this.callbacks.onMessageCleared(result.messageId);
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
        if (this.callbacks.onSetupError) {
          this.callbacks.onSetupError(result.error);
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

  // Send response to content script
  sendResponseToContentScript(text, isComplete = false) {
    this.currentResponse += text;

    if (isComplete && this.conversationManager) {
      this.conversationManager.addMessage(this.currentResponse, 'ai', null);
      this.currentResponse = '';
    }

    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'AI_RESPONSE',
          text,
          isComplete
        }).catch(() => {});
      });
    });
  }

  // Send error to content script
  sendErrorToContentScript(error) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'AI_ERROR',
          error
        }).catch(() => {});
      });
    });
  }

  // Reset current response
  resetResponse() {
    this.currentResponse = '';
  }

  // Get current response
  getCurrentResponse() {
    return this.currentResponse;
  }

  // Cleanup
  cleanup() {
    this.currentResponse = '';
    this.callbacks = {
      onSetupComplete: null,
      onSetupError: null,
      onContent: null,
      onError: null,
      onMessageCleared: null
    };
  }
};
