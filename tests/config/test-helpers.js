// Global window and document mocks
global.window = global.window || {};
global.document = global.document || {
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getElementById: jest.fn(),
  body: {
    appendChild: jest.fn(),
    style: {}
  }
};

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

// Shadow DOM Mocks
class MockShadowRoot {
  constructor() {
    this.children = [];
    this._getElementById = jest.fn();
  }

  appendChild(element) {
    this.children.push(element);
    return element;
  }

  getElementById(id) {
    return this._getElementById(id);
  }

  querySelector(selector) {
    // Simple mock for basic selectors
    return this.children.find(child => 
      (selector.startsWith('#') && child.id === selector.slice(1)) ||
      (selector.startsWith('.') && child.className && child.className.includes(selector.slice(1)))
    ) || null;
  }

  addEventListener(event, handler) {
    // Mock addEventListener for shadow root
    // Store the handler for testing purposes
    this._eventListeners = this._eventListeners || {};
    this._eventListeners[event] = this._eventListeners[event] || [];
    this._eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    // Mock removeEventListener for shadow root
    if (this._eventListeners && this._eventListeners[event]) {
      const index = this._eventListeners[event].indexOf(handler);
      if (index > -1) {
        this._eventListeners[event].splice(index, 1);
      }
    }
  }
}

// Mock shadow DOM globals
global.window.assistantShadowRoot = null;
global.document.getElementById = jest.fn();

// Helper to setup shadow DOM mock for tests
global.setupShadowDOMMock = function(container) {
  const mockShadowRoot = new MockShadowRoot();
  mockShadowRoot._getElementById.mockReturnValue(container);
  global.window.assistantShadowRoot = mockShadowRoot;
  
  // Mock document.getElementById for the shadow host
  const mockShadowHost = {
    id: 'ai-assistant-shadow-host',
    contains: jest.fn().mockReturnValue(false)
  };
  global.document.getElementById.mockReturnValue(mockShadowHost);
  
  return { mockShadowRoot, mockShadowHost };
};

// Helper to reset shadow DOM mocks
global.resetShadowDOMMock = function() {
  global.window.assistantShadowRoot = null;
  if (global.document.getElementById && global.document.getElementById.mockReset) {
    global.document.getElementById.mockReset();
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
  
  // Reset shadow DOM state
  global.resetShadowDOMMock();
  
  // Reset document mocks safely
  if (global.document.createElement && global.document.createElement.mockClear) {
    global.document.createElement.mockClear();
  }
  if (global.document.addEventListener && global.document.addEventListener.mockClear) {
    global.document.addEventListener.mockClear();
  }
  if (global.document.removeEventListener && global.document.removeEventListener.mockClear) {
    global.document.removeEventListener.mockClear();
  }
  if (global.document.getElementById && global.document.getElementById.mockClear) {
    global.document.getElementById.mockClear();
  }
}); 