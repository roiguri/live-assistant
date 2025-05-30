// Chrome API Mocks
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    secure: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    captureVisibleTab: jest.fn()
  }
};

// Marked.js Mock for markdown parsing
global.marked = {
  parse: jest.fn((text) => {
    // Simple mock that returns basic HTML for testing
    // Replace newlines with <br> and wrap in <p> tags
    return `<p>${text.replace(/\n/g, '<br>')}</p>`;
  })
};

// WebSocket Mock with State
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    
    // Simulate connection after short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  send(data) {
    this.lastSentData = data;
  }
  
  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000 });
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;

// Standardized Gemini API Response Mocks
global.mockGeminiResponses = {
  setupComplete: { setupComplete: true },
  textResponse: {
    serverContent: {
      modelTurn: {
        parts: [{ text: "Test response" }]
      },
      turnComplete: true
    }
  },
  streamingResponse: {
    serverContent: {
      modelTurn: {
        parts: [{ text: "Partial response" }]
      },
      turnComplete: false
    }
  },
  errorResponse: {
    error: { message: "API Error", code: 400 }
  }
};

// Test Data Constants
global.testData = {
  validApiKey: 'AIza1234567890123456789012345678901234567',
  invalidApiKey: 'invalid-key',
  shortMessage: 'Hello',
  longMessage: 'A'.repeat(1000),
  testScreenshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...',
  
  chatStates: {
    minimal: 'minimal',
    recent: 'recent', 
    full: 'full'
  },
  
  mockMessages: [
    { text: 'Hello', sender: 'user', timestamp: 1640995200000 },
    { text: 'Hi there!', sender: 'ai', timestamp: 1640995201000 }
  ]
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 