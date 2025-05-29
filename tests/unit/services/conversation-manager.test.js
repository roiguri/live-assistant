// Import test helpers
require('../../config/test-helpers.js');

// Load the service
require('../../../services/conversation-manager.js');

describe('ConversationManager', () => {
  let conversationManager;
  let mockChrome;
  
  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}), // Default to empty object
          set: jest.fn().mockResolvedValue()
        }
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn().mockResolvedValue() // Ensure it returns a promise
      },
      runtime: {
        lastError: null
      }
    };
    mockChrome = global.chrome;
    
    // Reset Chrome API mocks
    chrome.storage.local.get.mockClear();
    chrome.storage.local.set.mockClear();
    chrome.tabs.query.mockClear();
    chrome.tabs.sendMessage.mockClear();
    
    // Create new instance for each test (this will call init)
    conversationManager = new globalThis.ConversationManager();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Initial Setup', () => {
    test('initializes with empty messages array', () => {
      expect(conversationManager.messages).toEqual([]);
      expect(conversationManager.maxMessages).toBe(100);
      expect(conversationManager.errorHandler).toBeDefined();
    });
    
    test('has all required stub methods', () => {
      expect(typeof conversationManager.addMessage).toBe('function');
      expect(typeof conversationManager.loadFromStorage).toBe('function');
      expect(typeof conversationManager.saveToStorage).toBe('function');
      expect(typeof conversationManager.getConversation).toBe('function');
      expect(typeof conversationManager.clearConversation).toBe('function');
      expect(typeof conversationManager.broadcastUpdate).toBe('function');
    });
    
    test('getConversation returns empty array initially', () => {
      const result = conversationManager.getConversation();
      expect(result).toEqual([]);
    });
  });

  describe('Storage Loading', () => {
    test('init method calls loadFromStorage and logs success', async () => {
      const mockMessages = [
        { id: 'msg1', text: 'Hello', sender: 'user', timestamp: 123 },
        { id: 'msg2', text: 'Hi there!', sender: 'ai', timestamp: 124 }
      ];
      
      mockChrome.storage.local.get.mockResolvedValue({
        conversation: mockMessages,
        uiState: 'recent'
      });
      
      const testManager = new globalThis.ConversationManager();
      await testManager.init();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['conversation', 'uiState']);
      expect(testManager.messages).toEqual(mockMessages);
    });

    test('loadFromStorage loads existing conversation from storage', async () => {
      const mockMessages = [
        { id: 'msg1', text: 'Hello', sender: 'user', timestamp: 123 }
      ];
      
      mockChrome.storage.local.get.mockResolvedValue({
        conversation: mockMessages,
        uiState: 'full'
      });
      
      await conversationManager.loadFromStorage();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['conversation', 'uiState']);
      expect(conversationManager.messages).toEqual(mockMessages);
    });

    test('loadFromStorage handles empty storage gracefully', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});
      
      await conversationManager.loadFromStorage();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['conversation', 'uiState']);
      expect(conversationManager.messages).toEqual([]);
    });

    test('loadFromStorage handles storage errors gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      
      await conversationManager.loadFromStorage();
      
      expect(conversationManager.messages).toEqual([]);
    });

    test('saveToStorage saves messages with timestamp', async () => {
      const testMessages = [
        { id: 'msg1', text: 'Test', sender: 'user', timestamp: 123 }
      ];
      
      conversationManager.messages = testMessages;
      mockChrome.storage.local.set.mockResolvedValue();
      
      await conversationManager.saveToStorage();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        conversation: testMessages,
        uiState: 'minimal',
        lastUpdated: expect.any(Number)
      });
    });

    test('saveToStorage handles storage errors gracefully', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage full'));
      
      // Should not throw
      await conversationManager.saveToStorage();
    });

    test('getConversation respects limit parameter', async () => {
      const manyMessages = Array.from({ length: 20 }, (_, i) => ({
        id: `msg_${i}`,
        text: `Message ${i}`,
        sender: 'user',
        timestamp: Date.now() + i
      }));
      
      conversationManager.messages = manyMessages;
      
      const recent5 = conversationManager.getConversation(5);
      expect(recent5).toHaveLength(5);
      expect(recent5).toEqual(manyMessages.slice(-5));
      
      const recent10 = conversationManager.getConversation(10);
      expect(recent10).toHaveLength(10);
      expect(recent10).toEqual(manyMessages.slice(-10));
    });
  });
  
  describe('Add message functionality', () => {
    beforeEach(() => {
      // Reset conversation manager state
      conversationManager.messages = [];
      mockChrome.storage.local.get.mockClear();
      mockChrome.storage.local.set.mockClear();
    });

    test('addMessage creates message with correct structure', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      const testText = 'Hello world';
      const testSender = 'user';
      const testTabId = 123;
      
      const result = await conversationManager.addMessage(testText, testSender, testTabId);
      
      expect(result).toMatchObject({
        id: expect.stringMatching(/^msg_\d+_[\d.]+$/),
        text: testText,
        sender: testSender,
        timestamp: expect.any(Number)
      });
    });

    test('addMessage adds message to internal array', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      await conversationManager.addMessage('Message 1', 'user', 123);
      await conversationManager.addMessage('Message 2', 'ai', 123);
      
      const messages = conversationManager.getConversation();
      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe('Message 1');
      expect(messages[1].text).toBe('Message 2');
    });

    test('addMessage calls saveToStorage', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      await conversationManager.addMessage('Test message', 'user', 123);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        conversation: expect.arrayContaining([
          expect.objectContaining({
            text: 'Test message',
            sender: 'user'
          })
        ]),
        uiState: 'minimal',
        lastUpdated: expect.any(Number)
      });
    });

    test('addMessage enforces maxMessages limit', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      // Set a low limit for testing
      conversationManager.maxMessages = 3;
      
      await conversationManager.addMessage('Message 1', 'user', 123);
      await conversationManager.addMessage('Message 2', 'user', 123);
      await conversationManager.addMessage('Message 3', 'user', 123);
      await conversationManager.addMessage('Message 4', 'user', 123);
      
      const messages = conversationManager.getConversation();
      expect(messages).toHaveLength(3);
      expect(messages[0].text).toBe('Message 2'); // First message removed
      expect(messages[2].text).toBe('Message 4'); // Latest message kept
    });

    test('addMessage generates unique IDs', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      const message1 = await conversationManager.addMessage('Message 1', 'user', 123);
      const message2 = await conversationManager.addMessage('Message 2', 'user', 123);
      
      expect(message1.id).not.toBe(message2.id);
      expect(message1.id).toMatch(/^msg_\d+_[\d.]+$/);
      expect(message2.id).toMatch(/^msg_\d+_[\d.]+$/);
    });

    test('addMessage handles storage errors gracefully', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage failed'));
      
      // Should not throw
      const result = await conversationManager.addMessage('Test message', 'user', 123);
      
      expect(result).toBeDefined();
      expect(result.text).toBe('Test message');
      
      // Message should still be in memory even if storage failed
      const messages = conversationManager.getConversation();
      expect(messages).toHaveLength(1);
    });

    test('addMessage returns message that matches internal storage', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      const returned = await conversationManager.addMessage('Test message', 'user', 123);
      const stored = conversationManager.getConversation();
      
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(returned);
    });
  });
  
  describe('Cross-tab broadcasting', () => {
    beforeEach(() => {
      // Reset conversation manager state
      conversationManager.messages = [];
      mockChrome.storage.local.get.mockClear();
      mockChrome.storage.local.set.mockClear();
      mockChrome.tabs.query.mockClear();
      mockChrome.tabs.sendMessage.mockClear();
    });

    test('broadcastUpdate queries all tabs and sends messages', () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://google.com' },
        { id: 3, url: 'https://github.com' }
      ];
      
      // Setup mock tabs
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue();
      
      // Add some messages to broadcast
      conversationManager.messages = [
        { id: '1', text: 'Hello', sender: 'user', timestamp: 123 },
        { id: '2', text: 'World', sender: 'user', timestamp: 124 }
      ];
      
      conversationManager.broadcastUpdate();
      
      // Verify tabs.query was called
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      
      // Verify sendMessage was called for each tab
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'CONVERSATION_UPDATE',
        messages: conversationManager.messages
      });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'CONVERSATION_UPDATE',
        messages: conversationManager.messages
      });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'CONVERSATION_UPDATE',
        messages: conversationManager.messages
      });
    });

    test('broadcastUpdate handles empty tabs list', () => {
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      
      conversationManager.broadcastUpdate();
      
      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test('broadcastUpdate handles sendMessage errors gracefully', () => {
      const mockTabs = [{ id: 1 }, { id: 2 }];
      
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });
      mockChrome.tabs.sendMessage
        .mockResolvedValueOnce() // First succeeds
        .mockRejectedValueOnce(new Error('Tab closed')); // Second fails
      
      // Should not throw
      expect(() => {
        conversationManager.broadcastUpdate();
      }).not.toThrow();
      
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('addMessage triggers broadcast after storage', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue();
      
      await conversationManager.addMessage('Test message', 'user', 123);
      
      // Verify broadcast was called
      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'CONVERSATION_UPDATE',
        messages: expect.arrayContaining([
          expect.objectContaining({
            text: 'Test message',
            sender: 'user'
          })
        ])
      });
    });

    test('addMessage still works if broadcast fails', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Broadcast failed'));
      
      // Should not throw and should still return the message
      const result = await conversationManager.addMessage('Test message', 'user', 123);
      
      expect(result).toBeDefined();
      expect(result.text).toBe('Test message');
      expect(conversationManager.messages).toHaveLength(1);
    });

    test('broadcastUpdate sends current message state', () => {
      const currentMessages = [
        { id: '1', text: 'Message 1', sender: 'user', timestamp: 123 },
        { id: '2', text: 'Message 2', sender: 'ai', timestamp: 124 },
        { id: '3', text: 'Message 3', sender: 'user', timestamp: 125 }
      ];
      
      conversationManager.messages = currentMessages;
      
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue();
      
      conversationManager.broadcastUpdate();
      
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'CONVERSATION_UPDATE',
        messages: currentMessages
      });
    });
  });
  
  describe('Clear conversation functionality', () => {
    beforeEach(() => {
      // Reset conversation manager state with some test messages
      conversationManager.messages = [
        { id: 'msg_1', text: 'Hello', sender: 'user', timestamp: 123 },
        { id: 'msg_2', text: 'Hi there!', sender: 'ai', timestamp: 124 }
      ];
      mockChrome.storage.local.set.mockClear();
      mockChrome.tabs.query.mockClear();
      mockChrome.tabs.sendMessage.mockClear();
    });

    test('clearConversation empties messages array', () => {
      expect(conversationManager.messages).toHaveLength(2);
      
      conversationManager.clearConversation();
      
      expect(conversationManager.messages).toHaveLength(0);
      expect(conversationManager.messages).toEqual([]);
    });

    test('clearConversation saves empty state to storage', () => {
      mockChrome.storage.local.set.mockResolvedValue();
      
      conversationManager.clearConversation();
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        conversation: [],
        uiState: 'minimal',
        lastUpdated: expect.any(Number)
      });
    });

    test('clearConversation broadcasts update to all tabs', () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://google.com' }
      ];
      
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue();
      
      conversationManager.clearConversation();
      
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'CONVERSATION_UPDATE',
        messages: []
      });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'CONVERSATION_UPDATE',
        messages: []
      });
    });

    test('clearConversation handles storage errors gracefully', () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage full'));
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      
      expect(() => {
        conversationManager.clearConversation();
      }).not.toThrow();
      
      expect(conversationManager.messages).toHaveLength(0);
    });

    test('clearConversation handles broadcast errors gracefully', () => {
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));
      
      expect(() => {
        conversationManager.clearConversation();
      }).not.toThrow();
      
      expect(conversationManager.messages).toHaveLength(0);
    });

    describe('Connection Manager Integration', () => {
        let mockConnectionManager;

        beforeEach(() => {
            conversationManager.messages = [
                { id: 'msg_1', text: 'Hello', sender: 'user', timestamp: 123 },
                { id: 'msg_2', text: 'Hi there!', sender: 'ai', timestamp: 124 }
            ];
            mockChrome.storage.local.set.mockClear();
            mockChrome.tabs.query.mockClear();
            mockChrome.tabs.sendMessage.mockClear();

            mockConnectionManager = {
                resetContext: jest.fn()
            };
        });

        test('setConnectionManager sets the connection manager', () => {
            conversationManager.setConnectionManager(mockConnectionManager);
            
            expect(conversationManager.connectionManager).toBe(mockConnectionManager);
        });

        test('clearConversation resets Gemini context when connection manager is available', async () => {
            conversationManager.setConnectionManager(mockConnectionManager);
            mockChrome.storage.local.set.mockResolvedValue();
            mockChrome.tabs.query.mockImplementation((query, callback) => {
                callback([{ id: 1 }, { id: 2 }]);
            });
            mockChrome.tabs.sendMessage.mockResolvedValue();
            
            conversationManager.clearConversation();
            
            // Verify conversation is cleared
            expect(conversationManager.messages).toEqual([]);
            
            // Verify context reset is called
            expect(mockConnectionManager.resetContext).toHaveBeenCalledTimes(1);
            
            // Verify storage is called
            expect(mockChrome.storage.local.set).toHaveBeenCalled();
            
            // Verify broadcast is attempted (tabs.query should be called)
            expect(mockChrome.tabs.query).toHaveBeenCalled();
        });

        test('clearConversation works normally when no connection manager is set', async () => {
            // Don't set connection manager
            mockChrome.storage.local.set.mockResolvedValue();
            mockChrome.tabs.query.mockImplementation((query, callback) => {
                callback([{ id: 1 }]);
            });
            
            expect(() => {
                conversationManager.clearConversation();
            }).not.toThrow();
            
            // Verify conversation is still cleared
            expect(conversationManager.messages).toEqual([]);
            
            // Verify storage and broadcast still work
            expect(mockChrome.storage.local.set).toHaveBeenCalled();
            expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
        });

        test('clearConversation handles connection manager reset errors gracefully', async () => {
            mockConnectionManager.resetContext.mockImplementation(() => {
                throw new Error('Reset failed');
            });
            conversationManager.setConnectionManager(mockConnectionManager);
            
            mockChrome.storage.local.set.mockResolvedValue();
            mockChrome.tabs.query.mockImplementation((query, callback) => {
                callback([]);
            });
            mockChrome.tabs.sendMessage.mockResolvedValue();
            
            expect(() => {
                conversationManager.clearConversation();
            }).not.toThrow();
            
            // Verify conversation is still cleared even if reset fails
            expect(conversationManager.messages).toEqual([]);
            expect(mockConnectionManager.resetContext).toHaveBeenCalled();
            expect(mockChrome.storage.local.set).toHaveBeenCalled();
        });
    });
  });

  describe('UI State Management', () => {
    beforeEach(() => {
      conversationManager.messages = [];
      mockChrome.storage.local.set.mockClear();
      mockChrome.tabs.query.mockClear();
      mockChrome.tabs.sendMessage.mockClear();
    });

    test('setUIState updates current state', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      
      const result = await conversationManager.setUIState('full');
      
      expect(result).toBe(true);
      expect(conversationManager.currentUIState).toBe('full');
    });

    test('setUIState saves to storage', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([]);
      });
      
      await conversationManager.setUIState('recent');
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        conversation: [],
        uiState: 'recent',
        lastUpdated: expect.any(Number)
      });
    });

    test('setUIState broadcasts update', async () => {
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }, { id: 2 }]);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue();
      
      await conversationManager.setUIState('full');
      
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'UI_STATE_UPDATE',
        uiState: 'full'
      });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: 'UI_STATE_UPDATE',
        uiState: 'full'
      });
    });

    test('setUIState rejects invalid states', async () => {
      const result = await conversationManager.setUIState('invalid');
      
      expect(result).toBe(false);
      expect(conversationManager.currentUIState).toBe('minimal'); // unchanged
    });

    test('getUIState returns current state', () => {
      conversationManager.currentUIState = 'recent';
      
      const result = conversationManager.getUIState();
      expect(result).toBe('recent');
    });

    test('broadcastUIStateUpdate sends to all tabs', () => {
      conversationManager.currentUIState = 'full';
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }, { id: 2 }]);
      });
      mockChrome.tabs.sendMessage.mockResolvedValue();
      
      conversationManager.broadcastUIStateUpdate();
      
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'UI_STATE_UPDATE',
        uiState: 'full'
      });
    });

    test('broadcastUIStateUpdate handles query errors gracefully', () => {
      mockChrome.runtime.lastError = { message: 'Query failed' };
      
      expect(() => {
        conversationManager.broadcastUIStateUpdate();
      }).not.toThrow();
    });

    test('broadcastUIStateUpdate handles send message errors gracefully', () => {
      mockChrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));
      
      expect(() => {
        conversationManager.broadcastUIStateUpdate();
      }).not.toThrow();
    });
  });
});