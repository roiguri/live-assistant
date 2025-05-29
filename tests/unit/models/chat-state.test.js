// ChatState Model Unit Tests
describe('ChatState', () => {
  let mockObserver;
  
  // Helper function to reset state for tests that need clean slate
  function resetChatState() {
    window.ChatState.setMessages([]); // Use setMessages instead of clearMessages
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

  describe('setMessages', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should update messages array correctly', () => {
      const testMessages = [
        { text: 'Hello', sender: 'user', timestamp: Date.now() },
        { text: 'Hi there!', sender: 'ai', timestamp: Date.now() + 1000 }
      ];
      
      window.ChatState.setMessages(testMessages);
      
      const messages = window.ChatState.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages).toEqual(testMessages);
    });

    it('should notify observers when messages are updated', () => {
      const testMessages = [
        { text: 'Test message', sender: 'user', timestamp: Date.now() }
      ];
      
      window.ChatState.setMessages(testMessages);
      
      expect(mockObserver).toHaveBeenCalledWith('messages-updated', { messages: testMessages });
    });

    it('should handle empty messages array', () => {
      // First add some messages
      window.ChatState.setMessages([
        { text: 'Message 1', sender: 'user', timestamp: Date.now() }
      ]);
      
      // Then clear them
      window.ChatState.setMessages([]);
      
      expect(window.ChatState.getMessages()).toHaveLength(0);
      expect(window.ChatState.getLastMessage()).toBeNull();
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
      const messages = [
        { text: 'First message', sender: 'user', timestamp: Date.now() },
        { text: 'Second message', sender: 'ai', timestamp: Date.now() + 1000 },
        { text: 'Last message', sender: 'user', timestamp: Date.now() + 2000 }
      ];
      
      window.ChatState.setMessages(messages);
      
      expect(window.ChatState.getLastMessage()).toEqual(messages[2]);
    });

    it('should return null when no messages exist', () => {
      expect(window.ChatState.getLastMessage()).toBeNull();
    });
  });

  describe('observer notifications', () => {
    beforeEach(() => {
      resetChatState();
      mockObserver = jest.fn();
      window.ChatState.addObserver(mockObserver);
    });

    it('should notify observers when messages are updated', () => {
      const testMessages = [
        { text: 'Test message', sender: 'user', timestamp: Date.now() }
      ];
      
      window.ChatState.setMessages(testMessages);
      
      expect(mockObserver).toHaveBeenCalledWith('messages-updated', { messages: testMessages });
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
      
      const testMessages = [{ text: 'Test', sender: 'user', timestamp: Date.now() }];
      window.ChatState.setMessages(testMessages);
      
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
      const originalMessages = [
        { text: 'Original message', sender: 'user', timestamp: Date.now() }
      ];
      
      window.ChatState.setMessages(originalMessages);
      
      const returnedMessages = window.ChatState.getMessages();
      returnedMessages.push({ text: 'Hacked message', sender: 'hacker' });
      
      // Original state should be unchanged
      expect(window.ChatState.getMessages()).toHaveLength(1);
      expect(window.ChatState.getMessages()[0].text).toBe('Original message');
    });

    it('should create new array when setting messages', () => {
      const testMessages = [
        { text: 'Old message 1', sender: 'user', timestamp: Date.now() },
        { text: 'Old message 2', sender: 'ai', timestamp: Date.now() + 1000 }
      ];
      
      window.ChatState.setMessages(testMessages);
      
      // Modify original array
      testMessages.push({ text: 'New message', sender: 'user', timestamp: Date.now() + 2000 });
      
      // ChatState should be unaffected
      expect(window.ChatState.getMessages()).toHaveLength(2);
    });
  });

  describe('STATES constant', () => {
    it('should export all required state constants', () => {
      expect(window.ChatState.STATES.MINIMAL).toBe('minimal');
      expect(window.ChatState.STATES.RECENT).toBe('recent');
      expect(window.ChatState.STATES.FULL).toBe('full');
    });
  });

  describe('API completeness', () => {
    it('should export all required public methods', () => {
      // Note: addMessage and clearMessages removed for background integration
      expect(typeof window.ChatState.setMessages).toBe('function');
      expect(typeof window.ChatState.setState).toBe('function');
      expect(typeof window.ChatState.getState).toBe('function');
      expect(typeof window.ChatState.getMessages).toBe('function');
      expect(typeof window.ChatState.getLastMessage).toBe('function');
      expect(typeof window.ChatState.addObserver).toBe('function');
      expect(typeof window.ChatState.isMinimalState).toBe('function');
      expect(typeof window.ChatState.isRecentState).toBe('function');
      expect(typeof window.ChatState.isFullState).toBe('function');
    });
  });
}); 