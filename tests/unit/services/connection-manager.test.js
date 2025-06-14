const path = require('path');

require('../../config/test-helpers.js');

// Load the services under test  
require('../setup/load-models.js');

describe('ConnectionManager', () => {
  let connectionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh instance for each test
    connectionManager = new globalThis.ConnectionManager();
    
    // Mock WebSocket
    global.WebSocket = jest.fn().mockImplementation(() => ({
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      lastSentData: null
    }));
    
    // Mock chrome APIs
    global.chrome = {
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        captureVisibleTab: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };
    
    // Mock setTimeout/clearTimeout for tests that use timers
    jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback();
      return 123; // Mock timer ID
    });
    jest.spyOn(global, 'clearTimeout').mockImplementation(() => {});
  });

  describe('constructor and dependencies', () => {
    it('should initialize correctly', () => {
      expect(connectionManager).toBeDefined();
      expect(connectionManager.ws).toBeNull();
      expect(connectionManager.geminiClient).toBeDefined();
      expect(connectionManager.apiService).toBeDefined();
      expect(connectionManager.errorHandler).toBeDefined();
    });

    it('should initialize with correct default state', () => {
      expect(connectionManager.connectionState).toEqual({
        status: 'disconnected',
        error: null,
        attempts: 0
      });
    });

    it('should have required service dependencies', () => {
      expect(connectionManager.geminiClient).toBeInstanceOf(globalThis.GeminiClient);
      expect(connectionManager.apiService).toBeInstanceOf(globalThis.ApiService);
      expect(connectionManager.errorHandler).toBeInstanceOf(globalThis.ErrorHandler);
    });
  });

  describe('system prompt management', () => {
    it('should return default system prompt', async () => {
      global.chrome.storage.local.get.mockResolvedValue({});
      
      const prompt = await connectionManager.getCombinedSystemPrompt();
      
      expect(prompt).toContain('You are a helpful AI assistant');
      expect(prompt).toContain('Analyze screenshots');
    });

    it('should combine default prompt with custom instructions', async () => {
      global.chrome.storage.local.get.mockResolvedValue({
        customInstructions: 'Be extra friendly'
      });
      
      const prompt = await connectionManager.getCombinedSystemPrompt();
      
      expect(prompt).toContain('You are a helpful AI assistant');
      expect(prompt).toContain('User Instructions:\nBe extra friendly');
    });

    it('should return default prompt when no custom instructions', async () => {
      global.chrome.storage.local.get.mockResolvedValue({ customInstructions: '' });
      
      const prompt = await connectionManager.getCombinedSystemPrompt();
      
      expect(prompt).not.toContain('User Instructions');
    });

    it('should handle storage errors gracefully', async () => {
      global.chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      jest.spyOn(connectionManager.errorHandler, 'handleStorageError').mockImplementation(() => {});
      
      const prompt = await connectionManager.getCombinedSystemPrompt();
      
      expect(connectionManager.errorHandler.handleStorageError).toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('should report not connected when no WebSocket', () => {
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should report not connected when WebSocket not open', () => {
      connectionManager.ws = { readyState: 0 }; // CONNECTING
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should report connected when WebSocket open and state connected', async () => {
      connectionManager.connectionState.status = 'connected';
      connectionManager.ws = { readyState: globalThis.WebSocket.OPEN };
      
      expect(connectionManager.isConnected()).toBe(true);
    });

    it('should return current connection status', () => {
      const status = connectionManager.getConnectionStatus();
      
      expect(status).toEqual({
        websocket: 'disconnected',
        lastError: null,
        reconnectAttempts: 0
      });
    });
  });

  describe('content script communication', () => {
    it('should send response to all tabs', () => {
      global.chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }, { id: 2 }]);
      });
      global.chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());

      connectionManager.sendResponseToContentScript('Hello', true);

      expect(global.chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'AI_RESPONSE',
        text: 'Hello',
        isComplete: true
      });
    });

    it('should send error to all tabs', () => {
      global.chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      global.chrome.tabs.sendMessage.mockImplementation(() => Promise.resolve());

      connectionManager.sendErrorToContentScript('Test error');

      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'AI_ERROR',
        error: 'Test error'
      });
    });

    it('should handle sendMessage failures gracefully', () => {
      global.chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      global.chrome.tabs.sendMessage.mockImplementation(() => Promise.reject(new Error('Tab error')));

      expect(() => {
        connectionManager.sendResponseToContentScript('Hello', true);
      }).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should handle disconnected state for text messages', async () => {
      const sendResponse = jest.fn();
      
      await connectionManager.handleTextMessage('Hello', 1, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Not connected to AI service'
      });
    });

    it('should handle connecting state for text messages', async () => {
      connectionManager.connectionState.status = 'connecting';
      const sendResponse = jest.fn();
      
      await connectionManager.handleTextMessage('Hello', 1, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Still connecting - please wait...'
      });
    });

    it('should handle failed state for text messages', async () => {
      connectionManager.connectionState.status = 'failed';
      const sendResponse = jest.fn();
      
      await connectionManager.handleTextMessage('Hello', 1, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Connection failed - click ↻ to retry'
      });
    });
  });

  describe('screenshot handling', () => {
    it('should handle disconnected state for screenshots', async () => {
      const mockSendResponse = jest.fn();
      jest.spyOn(connectionManager.errorHandler, 'createErrorResponse').mockReturnValue({ 
        success: false, 
        error: 'Not connected to AI service',
        code: 'UNKNOWN_ERROR',
        timestamp: expect.any(Number)
      });
      
      await connectionManager.handleTabScreenshot(1, mockSendResponse);
      
      expect(mockSendResponse).toHaveBeenCalledWith({ 
        success: false, 
        error: 'Not connected to AI service',
        code: 'UNKNOWN_ERROR',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('AI message storage', () => {
    it('stores complete AI responses', () => {
      const mockConversationManager = {
        addMessage: jest.fn()
      };
      connectionManager.conversationManager = mockConversationManager;
      connectionManager.currentResponse = 'Hello';

      connectionManager.sendResponseToContentScript(' world', true);

      expect(mockConversationManager.addMessage).toHaveBeenCalledWith('Hello world', 'ai', null);
      expect(connectionManager.currentResponse).toBe('');
    });

    it('does not store incomplete AI responses', () => {
      const mockConversationManager = {
        addMessage: jest.fn()
      };
      connectionManager.conversationManager = mockConversationManager;

      connectionManager.sendResponseToContentScript('Hello', false);

      expect(mockConversationManager.addMessage).not.toHaveBeenCalled();
      expect(connectionManager.currentResponse).toBe('Hello');
    });

    it('handles missing conversation manager gracefully', () => {
      connectionManager.conversationManager = null;

      expect(() => {
        connectionManager.sendResponseToContentScript('Hello', true);
      }).not.toThrow();
    });
  });

  describe('context reset', () => {
    beforeEach(() => {
      jest.spyOn(connectionManager, 'stopRetries').mockImplementation(() => {});
      jest.spyOn(connectionManager, 'connect').mockImplementation(() => {});
      jest.spyOn(connectionManager.errorHandler, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('resets all connection state and clears streaming response', () => {
      connectionManager.currentResponse = 'some text';
      
      connectionManager.resetContext();
      
      expect(connectionManager.currentResponse).toBe('');
      expect(connectionManager.errorHandler.info).toHaveBeenCalledWith('Connection', 'Resetting connection context');
      expect(connectionManager.stopRetries).toHaveBeenCalled();
      expect(connectionManager.connect).toHaveBeenCalled();
    });

    it('logs context reset action', () => {
      connectionManager.resetContext();
      
      expect(connectionManager.errorHandler.info).toHaveBeenCalledWith('Connection', 'Resetting connection context');
    });
  });

  describe('manual reconnect', () => {
    beforeEach(() => {
      jest.spyOn(connectionManager, 'stopRetries').mockImplementation(() => {});
      jest.spyOn(connectionManager, 'clearConnectionMessages').mockImplementation(() => {});
      jest.spyOn(connectionManager, 'connect').mockImplementation(() => {});
      jest.spyOn(connectionManager.errorHandler, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('resets attempt counter and reconnects', () => {
      connectionManager.connectionState.attempts = 3;
      
      connectionManager.manualReconnect();
      
      expect(connectionManager.connectionState.attempts).toBe(0);
      expect(connectionManager.stopRetries).toHaveBeenCalled();
      expect(connectionManager.connect).toHaveBeenCalled();
    });

    it('clears connection messages when conversation manager exists', () => {
      connectionManager.conversationManager = { messages: [] };
      
      connectionManager.manualReconnect();
      
      expect(connectionManager.clearConnectionMessages).toHaveBeenCalled();
    });
  });
}); 