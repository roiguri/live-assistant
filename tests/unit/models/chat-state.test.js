// ChatState Model Unit Tests
describe('ChatState', () => {
  let mockObserver;
  
  // Helper function to reset state for tests that need clean slate
  function resetChatState() {
    window.ChatState.clearMessages();
    window.ChatState.setState('minimal');
  }
  
  describe('initial state', () => {
    it('should have MINIMAL state as default', () => {
      // Reload module to test true initial state
      global.reloadChatState();
      
      expect(window.ChatState.getState()).toBe('minimal');
      expect(window.ChatState.isMinimalState()).toBe(true);
      expect(window.ChatState.isRecentState()).toBe(false);
      expect(window.ChatState.isFullState()).toBe(false);
    });
  });

  describe('addMessage', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should store message correctly with all properties', () => {
      const testText = 'Hello world';
      const testSender = 'user';
      
      const result = window.ChatState.addMessage(testText, testSender);
      
      expect(result).toMatchObject({
        text: testText,
        sender: testSender,
        timestamp: expect.any(Number)
      });
      
      const messages = window.ChatState.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(result);
    });

    it('should default sender to "user" when not specified', () => {
      const result = window.ChatState.addMessage('Test message');
      
      expect(result.sender).toBe('user');
    });

    it('should generate timestamp close to current time', () => {
      const beforeTime = Date.now();
      const result = window.ChatState.addMessage('Test');
      const afterTime = Date.now();
      
      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('setState', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should transition to valid states correctly', () => {
      expect(window.ChatState.setState('recent')).toBe(true);
      expect(window.ChatState.getState()).toBe('recent');
      expect(window.ChatState.isRecentState()).toBe(true);
      
      expect(window.ChatState.setState('full')).toBe(true);
      expect(window.ChatState.getState()).toBe('full');
      expect(window.ChatState.isFullState()).toBe(true);
      
      expect(window.ChatState.setState('minimal')).toBe(true);
      expect(window.ChatState.getState()).toBe('minimal');
      expect(window.ChatState.isMinimalState()).toBe(true);
    });

    it('should handle case-insensitive state names', () => {
      expect(window.ChatState.setState('RECENT')).toBe(true);
      expect(window.ChatState.getState()).toBe('RECENT');
      
      expect(window.ChatState.setState('Full')).toBe(true);
      expect(window.ChatState.getState()).toBe('Full');
    });

    it('should reject invalid state changes', () => {
      expect(window.ChatState.setState('invalid')).toBe(false);
      expect(window.ChatState.setState('')).toBe(false);
      
      // These will throw errors due to toUpperCase() call on null/undefined
      expect(() => window.ChatState.setState(null)).toThrow();
      expect(() => window.ChatState.setState(undefined)).toThrow();
      
      // State should remain unchanged for valid checks
      expect(window.ChatState.getState()).toBe('minimal');
    });
  });

  describe('getLastMessage', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should return correct last message', () => {
      window.ChatState.addMessage('First message', 'user');
      window.ChatState.addMessage('Second message', 'ai');
      const lastMessage = window.ChatState.addMessage('Last message', 'user');
      
      expect(window.ChatState.getLastMessage()).toEqual(lastMessage);
    });

    it('should return null when no messages exist', () => {
      expect(window.ChatState.getLastMessage()).toBeNull();
    });
  });

  describe('clearMessages', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should empty messages array completely', () => {
      // Add some messages
      window.ChatState.addMessage('Message 1', 'user');
      window.ChatState.addMessage('Message 2', 'ai');
      window.ChatState.addMessage('Message 3', 'user');
      
      expect(window.ChatState.getMessages()).toHaveLength(3);
      
      window.ChatState.clearMessages();
      
      expect(window.ChatState.getMessages()).toHaveLength(0);
      expect(window.ChatState.getLastMessage()).toBeNull();
    });
  });

  describe('observer notifications', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should notify observers when message is added', () => {
      const message = window.ChatState.addMessage('Test message', 'user');
      
      expect(mockObserver).toHaveBeenCalledWith('message-added', message);
    });

    it('should notify observers when messages are cleared', () => {
      window.ChatState.addMessage('Test message');
      mockObserver.mockClear(); // Clear previous calls
      
      window.ChatState.clearMessages();
      
      expect(mockObserver).toHaveBeenCalledWith('messages-cleared', undefined);
      expect(mockObserver).toHaveBeenCalledTimes(1);
    });

    it('should notify observers when state changes', () => {
      mockObserver.mockClear(); // Clear initial setup calls
      
      window.ChatState.setState('recent');
      
      expect(mockObserver).toHaveBeenCalledWith('state-changed', {
        oldState: 'minimal',
        newState: 'recent'
      });
    });

    it('should notify multiple observers', () => {
      const secondObserver = jest.fn();
      window.ChatState.addObserver(secondObserver);
      
      window.ChatState.addMessage('Test');
      
      expect(mockObserver).toHaveBeenCalled();
      expect(secondObserver).toHaveBeenCalled();
    });
  });

  describe('state query methods', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should return correct booleans for each state', () => {
      // Test minimal state
      window.ChatState.setState('minimal');
      expect(window.ChatState.isMinimalState()).toBe(true);
      expect(window.ChatState.isRecentState()).toBe(false);
      expect(window.ChatState.isFullState()).toBe(false);
      
      // Test recent state
      window.ChatState.setState('recent');
      expect(window.ChatState.isMinimalState()).toBe(false);
      expect(window.ChatState.isRecentState()).toBe(true);
      expect(window.ChatState.isFullState()).toBe(false);
      
      // Test full state
      window.ChatState.setState('full');
      expect(window.ChatState.isMinimalState()).toBe(false);
      expect(window.ChatState.isRecentState()).toBe(false);
      expect(window.ChatState.isFullState()).toBe(true);
    });
  });

  describe('message immutability', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should return copy of messages to prevent external modification', () => {
      window.ChatState.addMessage('Original message', 'user');
      
      const messages = window.ChatState.getMessages();
      messages.push({ text: 'Injected message', sender: 'hacker' });
      
      // Original messages should be unchanged
      expect(window.ChatState.getMessages()).toHaveLength(1);
      expect(window.ChatState.getMessages()[0].text).toBe('Original message');
    });
  });

  describe('setMessages', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should replace messages array with new messages', () => {
      // Add some initial messages
      window.ChatState.addMessage('Old message 1', 'user');
      window.ChatState.addMessage('Old message 2', 'ai');
      expect(window.ChatState.getMessages()).toHaveLength(2);
      
      // Set new messages array
      const newMessages = [
        { id: '1', text: 'New message 1', sender: 'user', timestamp: 123 },
        { id: '2', text: 'New message 2', sender: 'ai', timestamp: 124 },
        { id: '3', text: 'New message 3', sender: 'user', timestamp: 125 }
      ];
      
      window.ChatState.setMessages(newMessages);
      
      const currentMessages = window.ChatState.getMessages();
      expect(currentMessages).toHaveLength(3);
      expect(currentMessages).toEqual(newMessages);
    });

    it('should create copy of provided messages to prevent external mutation', () => {
      const originalMessages = [
        { id: '1', text: 'Message 1', sender: 'user', timestamp: 123 }
      ];
      
      window.ChatState.setMessages(originalMessages);
      
      // Modify original array
      originalMessages.push({ id: '2', text: 'Added later', sender: 'user', timestamp: 124 });
      
      // ChatState should be unchanged
      expect(window.ChatState.getMessages()).toHaveLength(1);
      expect(window.ChatState.getMessages()[0].text).toBe('Message 1');
    });

    it('should handle empty messages array', () => {
      // Add some messages first
      window.ChatState.addMessage('Message 1', 'user');
      window.ChatState.addMessage('Message 2', 'ai');
      expect(window.ChatState.getMessages()).toHaveLength(2);
      
      // Set to empty array
      window.ChatState.setMessages([]);
      
      expect(window.ChatState.getMessages()).toHaveLength(0);
      expect(window.ChatState.getLastMessage()).toBeNull();
    });

    it('should notify observers with messages-updated event', () => {
      const newMessages = [
        { id: '1', text: 'New message', sender: 'user', timestamp: 123 }
      ];
      
      mockObserver.mockClear(); // Clear previous calls
      
      window.ChatState.setMessages(newMessages);
      
      expect(mockObserver).toHaveBeenCalledWith('messages-updated', { 
        messages: newMessages 
      });
      expect(mockObserver).toHaveBeenCalledTimes(1);
    });

    it('should update getLastMessage correctly', () => {
      const newMessages = [
        { id: '1', text: 'First', sender: 'user', timestamp: 123 },
        { id: '2', text: 'Second', sender: 'ai', timestamp: 124 },
        { id: '3', text: 'Last', sender: 'user', timestamp: 125 }
      ];
      
      window.ChatState.setMessages(newMessages);
      
      const lastMessage = window.ChatState.getLastMessage();
      expect(lastMessage).toEqual(newMessages[2]);
      expect(lastMessage.text).toBe('Last');
    });
  });

  describe('STATES constants', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should expose correct state constants', () => {
      expect(window.ChatState.STATES).toEqual({
        MINIMAL: 'minimal',
        RECENT: 'recent',
        FULL: 'full'
      });
    });
  });
}); 