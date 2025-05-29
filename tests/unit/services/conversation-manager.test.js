// Import test helpers
require('../../config/test-helpers.js');

// Load the service
require('../../../services/conversation-manager.js');

describe('ConversationManager', () => {
  let conversationManager;
  
  beforeEach(() => {
    // Reset Chrome API mocks
    chrome.storage.local.get.mockClear();
    chrome.storage.local.set.mockClear();
    
    // Create new instance for each test (this will call init)
    conversationManager = new globalThis.ConversationManager();
  });
  
  describe('Step 1: Initial Setup', () => {
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

  describe('Step 3: Storage Loading', () => {
    test('init method calls loadFromStorage and logs success', async () => {
      const mockMessages = [
        { id: '1', text: 'Hello', sender: 'user', timestamp: 123 },
        { id: '2', text: 'Hi!', sender: 'ai', timestamp: 124 }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ conversation: mockMessages });
      
      const testManager = new globalThis.ConversationManager();
      await testManager.init();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['conversation']);
      expect(testManager.messages).toEqual(mockMessages);
    });

    test('loadFromStorage loads existing conversation from storage', async () => {
      const mockMessages = [
        { id: '1', text: 'Hello', sender: 'user', timestamp: 123 },
        { id: '2', text: 'Hi!', sender: 'ai', timestamp: 124 }
      ];
      
      chrome.storage.local.get.mockResolvedValue({ conversation: mockMessages });
      
      await conversationManager.loadFromStorage();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['conversation']);
      expect(conversationManager.messages).toEqual(mockMessages);
    });

    test('loadFromStorage handles empty storage gracefully', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      
      await conversationManager.loadFromStorage();
      
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['conversation']);
      expect(conversationManager.messages).toEqual([]);
    });

    test('loadFromStorage handles storage errors gracefully', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      
      await conversationManager.loadFromStorage();
      
      expect(conversationManager.messages).toEqual([]);
    });

    test('saveToStorage saves messages with timestamp', async () => {
      const testMessages = [
        { id: '1', text: 'Test', sender: 'user', timestamp: 123 }
      ];
      
      conversationManager.messages = testMessages;
      chrome.storage.local.set.mockResolvedValue();
      
      await conversationManager.saveToStorage();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        conversation: testMessages,
        lastUpdated: expect.any(Number)
      });
    });

    test('saveToStorage handles storage errors gracefully', async () => {
      conversationManager.messages = [{ id: '1', text: 'Test' }];
      chrome.storage.local.set.mockRejectedValue(new Error('Storage full'));
      
      // Should not throw
      await expect(conversationManager.saveToStorage()).resolves.toBeUndefined();
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
      chrome.storage.local.get.mockClear();
      chrome.storage.local.set.mockClear();
    });

    test('addMessage creates message with correct structure', async () => {
      chrome.storage.local.set.mockResolvedValue();
      
      const testText = 'Hello world';
      const testSender = 'user';
      const testTabId = 123;
      
      const result = await conversationManager.addMessage(testText, testSender, testTabId);
      
      expect(result).toMatchObject({
        id: expect.stringMatching(/^msg_\d+_0\.\d+$/),
        text: testText,
        sender: testSender,
        timestamp: expect.any(Number)
      });
    });

    test('addMessage adds message to internal array', async () => {
      chrome.storage.local.set.mockResolvedValue();
      
      await conversationManager.addMessage('Message 1', 'user', 123);
      await conversationManager.addMessage('Message 2', 'ai', 123);
      
      const messages = conversationManager.getConversation();
      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe('Message 1');
      expect(messages[1].text).toBe('Message 2');
    });

    test('addMessage calls saveToStorage', async () => {
      chrome.storage.local.set.mockResolvedValue();
      
      await conversationManager.addMessage('Test message', 'user', 123);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        conversation: expect.arrayContaining([
          expect.objectContaining({
            text: 'Test message',
            sender: 'user'
          })
        ]),
        lastUpdated: expect.any(Number)
      });
    });

    test('addMessage enforces maxMessages limit', async () => {
      chrome.storage.local.set.mockResolvedValue();
      
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
      chrome.storage.local.set.mockResolvedValue();
      
      const message1 = await conversationManager.addMessage('Message 1', 'user', 123);
      const message2 = await conversationManager.addMessage('Message 2', 'user', 123);
      
      expect(message1.id).not.toBe(message2.id);
      expect(message1.id).toMatch(/^msg_\d+_0\.\d+$/);
      expect(message2.id).toMatch(/^msg_\d+_0\.\d+$/);
    });

    test('addMessage handles storage errors gracefully', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Storage failed'));
      
      // Should not throw
      const result = await conversationManager.addMessage('Test message', 'user', 123);
      
      expect(result).toBeDefined();
      expect(result.text).toBe('Test message');
      
      // Message should still be in memory even if storage failed
      const messages = conversationManager.getConversation();
      expect(messages).toHaveLength(1);
    });

    test('addMessage returns message that matches internal storage', async () => {
      chrome.storage.local.set.mockResolvedValue();
      
      const returned = await conversationManager.addMessage('Test message', 'user', 123);
      const stored = conversationManager.getConversation();
      
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(returned);
    });
  });
  
  // TODO: Add tests for each step as we implement
  // Step 6: Broadcasting tests
  // Step 8: Clear conversation tests
});