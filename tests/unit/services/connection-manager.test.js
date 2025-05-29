// Load services for testing
require('../setup/load-models');
require('../../config/test-helpers');

// ConnectionManager Service Unit Tests
describe('ConnectionManager', () => {
  let connectionManager;

  beforeEach(() => {
    // Create fresh instance
    connectionManager = new global.ConnectionManager();
    
    // Setup Chrome API default responses
    global.chrome.storage.local.get.mockResolvedValue({ customInstructions: '' });
    global.chrome.tabs.query.mockImplementation((options, callback) => 
      callback([{ id: 1 }, { id: 2 }])
    );
    global.chrome.tabs.sendMessage.mockResolvedValue();
    global.chrome.tabs.captureVisibleTab.mockResolvedValue(global.testData.testScreenshot);
  });

  describe('constructor and dependencies', () => {
    it('should initialize correctly', () => {
      expect(connectionManager).toBeDefined();
      expect(connectionManager.ws).toBeNull();
      expect(connectionManager.setupComplete).toBe(false);
    });

    it('should initialize with correct default state', () => {
      expect(connectionManager.connectionState).toEqual({
        websocket: 'disconnected',
        lastError: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000
      });
      expect(connectionManager.reconnectTimeout).toBeNull();
      expect(connectionManager.pingInterval).toBeNull();
    });

    it('should have required service dependencies', () => {
      expect(connectionManager.geminiClient).toBeDefined();
      expect(connectionManager.apiService).toBeDefined();
      expect(connectionManager.errorHandler).toBeDefined();
    });
  });

  describe('system prompt management', () => {
    it('should return default system prompt', () => {
      const prompt = connectionManager._getDefaultSystemPrompt();
      
      expect(prompt).toContain('You are a helpful AI assistant');
      expect(prompt).toContain('Analyze screenshots');
      expect(prompt).toContain('Be concise but helpful');
    });

    it('should combine default prompt with custom instructions', async () => {
      global.chrome.storage.local.get.mockResolvedValue({ 
        customInstructions: 'Be extra friendly' 
      });
      
      const prompt = await connectionManager._getCombinedSystemPrompt();
      
      expect(prompt).toContain('You are a helpful AI assistant');
      expect(prompt).toContain('User Instructions:\nBe extra friendly');
    });

    it('should return default prompt when no custom instructions', async () => {
      global.chrome.storage.local.get.mockResolvedValue({ customInstructions: '' });
      
      const prompt = await connectionManager._getCombinedSystemPrompt();
      
      expect(prompt).toEqual(connectionManager._getDefaultSystemPrompt());
      expect(prompt).not.toContain('User Instructions');
    });

    it('should handle storage errors gracefully', async () => {
      global.chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      jest.spyOn(connectionManager.errorHandler, 'handleStorageError').mockImplementation(() => {});
      
      const prompt = await connectionManager._getCombinedSystemPrompt();
      
      expect(prompt).toEqual(connectionManager._getDefaultSystemPrompt());
      expect(connectionManager.errorHandler.handleStorageError).toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('should report not connected when no WebSocket', () => {
      connectionManager.ws = null;
      
      expect(connectionManager.isConnected()).toBeFalsy();
    });

    it('should report not connected when WebSocket not open', () => {
      connectionManager.ws = new global.WebSocket('test://url');
      connectionManager.ws.readyState = global.WebSocket.CONNECTING;
      connectionManager.connectionState.websocket = 'connecting';
      
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should report connected when WebSocket open and state connected', async () => {
      connectionManager.ws = new global.WebSocket('test://url');
      connectionManager.connectionState.websocket = 'connected';
      
      // Wait for mock WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(connectionManager.isConnected()).toBe(true);
    });

    it('should return current connection status', () => {
      const status = connectionManager.getConnectionStatus();
      
      expect(status).toEqual({
        websocket: 'disconnected',
        lastError: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000
      });
    });
  });

  describe('content script communication', () => {
    it('should send response to all tabs', () => {
      connectionManager.sendResponseToContentScript('Test response', true);
      
      expect(global.chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'AI_RESPONSE',
        text: 'Test response',
        isComplete: true
      });
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'AI_RESPONSE',
        text: 'Test response',
        isComplete: true
      });
    });

    it('should send error to all tabs', () => {
      connectionManager.sendErrorToContentScript('Test error');
      
      expect(global.chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'AI_ERROR',
        error: 'Test error'
      });
    });

    it('should handle sendMessage failures gracefully', () => {
      global.chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));
      
      // Should not throw error
      expect(() => {
        connectionManager.sendResponseToContentScript('Test response');
      }).not.toThrow();
    });
  });

  describe('setup messaging', () => {
    it('should send setup message when connected', async () => {
      // Setup WebSocket connection
      connectionManager.ws = new global.WebSocket('test://url');
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
      
      jest.spyOn(connectionManager.geminiClient, 'createSetupMessage').mockReturnValue({ type: 'setup' });
      jest.spyOn(connectionManager.errorHandler, 'debug').mockImplementation(() => {});
      
      await connectionManager.sendSetupMessage();
      
      expect(connectionManager.geminiClient.createSetupMessage).toHaveBeenCalled();
      expect(connectionManager.ws.lastSentData).toBeDefined();
      expect(connectionManager.errorHandler.debug).toHaveBeenCalledWith('Connection', 'Setup message sent');
    });

    it('should not send setup message when not connected', async () => {
      connectionManager.ws = null;
      jest.spyOn(connectionManager.geminiClient, 'createSetupMessage').mockReturnValue({ type: 'setup' });
      jest.spyOn(connectionManager.errorHandler, 'debug').mockImplementation(() => {});
      
      await connectionManager.sendSetupMessage();
      
      expect(connectionManager.geminiClient.createSetupMessage).toHaveBeenCalled();
      expect(connectionManager.errorHandler.debug).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should handle text messages when connected', async () => {
      // Setup connected state
      connectionManager.ws = new global.WebSocket('test://url');
      connectionManager.connectionState.websocket = 'connected';
      await new Promise(resolve => setTimeout(resolve, 20));
      
      jest.spyOn(connectionManager.geminiClient, 'createTextMessage').mockReturnValue({
        message: { type: 'text', text: 'Hello' },
        messageId: 'test123'
      });
      jest.spyOn(connectionManager.errorHandler, 'debug').mockImplementation(() => {});
      
      await connectionManager.handleTextMessage('Hello', 1);
      
      expect(connectionManager.geminiClient.createTextMessage).toHaveBeenCalledWith('Hello');
      expect(connectionManager.ws.lastSentData).toBeDefined();
      expect(connectionManager.errorHandler.debug).toHaveBeenCalledWith('Message', 'Message sent [test123]');
    });

    it('should handle disconnected state for text messages', async () => {
      connectionManager.ws = null;
      jest.spyOn(connectionManager.errorHandler, 'handleConnectionError').mockReturnValue('Connection failed');
      
      await connectionManager.handleTextMessage('Hello', 1);
      
      expect(connectionManager.errorHandler.handleConnectionError).toHaveBeenCalledWith('Not connected to AI service');
      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'AI_ERROR',
        error: 'Not connected to AI service'
      });
    });
  });

  describe('screenshot handling', () => {
    it('should capture and send screenshot when connected', async () => {
      connectionManager.ws = new global.WebSocket('test://url');
      connectionManager.connectionState.websocket = 'connected';
      await new Promise(resolve => setTimeout(resolve, 20));
      
      jest.spyOn(connectionManager.geminiClient, 'createScreenshotMessage').mockReturnValue({
        message: { type: 'screenshot' },
        messageId: 'screenshot123'
      });
      jest.spyOn(connectionManager.errorHandler, 'logPerformance').mockImplementation(() => {});
      jest.spyOn(connectionManager.errorHandler, 'createSuccessResponse').mockReturnValue({ success: true });
      
      const mockSendResponse = jest.fn();
      await connectionManager.handleTabScreenshot(1, mockSendResponse);
      
      expect(global.chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, {
        format: 'jpeg',
        quality: 80
      });
      expect(connectionManager.geminiClient.createScreenshotMessage).toHaveBeenCalled();
      expect(connectionManager.errorHandler.logPerformance).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle disconnected state for screenshots', async () => {
      connectionManager.ws = null;
      jest.spyOn(connectionManager.errorHandler, 'handleConnectionError').mockReturnValue('Connection failed');
      jest.spyOn(connectionManager.errorHandler, 'createErrorResponse').mockReturnValue({ success: false, error: 'Connection failed' });
      
      const mockSendResponse = jest.fn();
      await connectionManager.handleTabScreenshot(1, mockSendResponse);
      
      expect(connectionManager.errorHandler.handleConnectionError).toHaveBeenCalledWith('Not connected to AI service');
      expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Connection failed' });
    });
  });

  describe('AI message storage', () => {
    let mockConversationManager;

    beforeEach(() => {
      mockConversationManager = {
        addMessage: jest.fn().mockResolvedValue({ id: 'msg_123' })
      };
      connectionManager.setConversationManager(mockConversationManager);
    });

    test('stores complete AI responses', () => {
      const completeText = 'This is a complete AI response';
      
      connectionManager.sendResponseToContentScript(completeText, true);
      
      expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
        completeText, 
        'ai', 
        null
      );
    });

    test('stores streaming AI responses when complete', () => {
      // Send streaming chunks
      connectionManager.sendResponseToContentScript('Hello ', false);
      connectionManager.sendResponseToContentScript('world! ', false);
      connectionManager.sendResponseToContentScript('How are you?', true);
      
      // Should only store once when complete
      expect(mockConversationManager.addMessage).toHaveBeenCalledTimes(1);
      expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
        'Hello world! How are you?', 
        'ai', 
        null
      );
    });

    test('does not store incomplete AI responses', () => {
      connectionManager.sendResponseToContentScript('Partial response', false);
      
      expect(mockConversationManager.addMessage).not.toHaveBeenCalled();
    });

    test('resets response tracking after completion', () => {
      // First complete response
      connectionManager.sendResponseToContentScript('First response', true);
      
      // Second response should start fresh
      connectionManager.sendResponseToContentScript('Second ', false);
      connectionManager.sendResponseToContentScript('response', true);
      
      expect(mockConversationManager.addMessage).toHaveBeenCalledTimes(2);
      expect(mockConversationManager.addMessage).toHaveBeenNthCalledWith(
        1, 'First response', 'ai', null
      );
      expect(mockConversationManager.addMessage).toHaveBeenNthCalledWith(
        2, 'Second response', 'ai', null
      );
    });

    test('handles missing conversation manager gracefully', () => {
      connectionManager.setConversationManager(null);
      
      expect(() => {
        connectionManager.sendResponseToContentScript('Test response', true);
      }).not.toThrow();
    });
  });
}); 