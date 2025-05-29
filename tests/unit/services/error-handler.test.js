// ErrorHandler Service Unit Tests
describe('ErrorHandler', () => {
  let errorHandler;
  let mockConsole;
  let mockChrome;

  beforeEach(() => {
    // Create fresh instance
    errorHandler = new global.ErrorHandler();
    
    // Mock console methods
    mockConsole = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    // Replace console methods
    global.console = mockConsole;
    
    // Mock chrome APIs
    mockChrome = {
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(() => Promise.resolve())
      }
    };
    global.chrome = mockChrome;
  });

  describe('log level filtering', () => {
    it('should filter logs based on current log level', () => {
      errorHandler.setLogLevel('warn');
      
      errorHandler.error('Test', 'Error message');
      errorHandler.warn('Test', 'Warning message');
      errorHandler.info('Test', 'Info message');
      errorHandler.debug('Test', 'Debug message');
      
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('should allow all logs when level is debug', () => {
      errorHandler.setLogLevel('debug');
      
      errorHandler.error('Test', 'Error message');
      errorHandler.warn('Test', 'Warning message');
      errorHandler.info('Test', 'Info message');
      errorHandler.debug('Test', 'Debug message');
      
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    it('should only show errors when level is error', () => {
      errorHandler.setLogLevel('error');
      
      errorHandler.error('Test', 'Error message');
      errorHandler.warn('Test', 'Warning message');
      errorHandler.info('Test', 'Info message');
      errorHandler.debug('Test', 'Debug message');
      
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('should ignore invalid log levels', () => {
      const originalLevel = errorHandler.logLevel;
      
      errorHandler.setLogLevel('invalid');
      
      expect(errorHandler.logLevel).toBe(originalLevel);
    });
  });

  describe('handleConnectionError', () => {
    it('should return user-friendly message for API key errors', () => {
      const result = errorHandler.handleConnectionError('Invalid API key provided');
      
      expect(result).toBe('Please check your API key in settings');
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(Connection\):$/),
        'Connection error: Invalid API key provided'
      );
    });

    it('should return network error message for network issues', () => {
      const result = errorHandler.handleConnectionError('Network fetch failed');
      
      expect(result).toBe('Network error - please check your internet connection');
    });

    it('should return timeout message for timeout errors', () => {
      const result = errorHandler.handleConnectionError('Request timeout occurred');
      
      expect(result).toBe('Request timed out - please try again');
    });

    it('should return generic message for unknown errors', () => {
      const result = errorHandler.handleConnectionError('Unknown connection issue');
      
      expect(result).toBe('Connection failed');
    });

    it('should notify content scripts of connection errors', () => {
      mockChrome.tabs.query.mockImplementation((options, callback) => {
        callback([{ id: 1 }, { id: 2 }]);
      });
      
      errorHandler.handleConnectionError('Test error');
      
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'CONNECTION_ERROR',
        error: 'Connection failed',
        technical: 'Test error'
      });
    });
  });

  describe('handleApiError', () => {
    it('should map 401/403 status codes correctly', () => {
      const result1 = errorHandler.handleApiError('HTTP 401 Unauthorized');
      const result2 = errorHandler.handleApiError('Error 403 Forbidden');
      
      expect(result1).toBe('Invalid API key - please check your settings');
      expect(result2).toBe('Invalid API key - please check your settings');
    });

    it('should map 429 status code to rate limit message', () => {
      const result = errorHandler.handleApiError('HTTP 429 Too Many Requests');
      
      expect(result).toBe('Rate limit exceeded - please wait a moment');
    });

    it('should map 5xx status codes to service unavailable', () => {
      const result1 = errorHandler.handleApiError('HTTP 500 Internal Server Error');
      const result2 = errorHandler.handleApiError('Error 502 Bad Gateway');
      const result3 = errorHandler.handleApiError('Status 503 Service Unavailable');
      
      expect(result1).toBe('AI service temporarily unavailable');
      expect(result2).toBe('AI service temporarily unavailable');
      expect(result3).toBe('AI service temporarily unavailable');
    });

    it('should return generic message for unknown API errors', () => {
      const result = errorHandler.handleApiError('Unknown API error');
      
      expect(result).toBe('AI service error');
    });

    it('should notify content scripts of API errors', () => {
      mockChrome.tabs.query.mockImplementation((options, callback) => {
        callback([{ id: 1 }]);
      });
      
      errorHandler.handleApiError('Test API error');
      
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'API_ERROR',
        error: 'AI service error',
        technical: 'Test API error'
      });
    });
  });

  describe('handleMessageError', () => {
    it('should include message context for short messages', () => {
      const result = errorHandler.handleMessageError('Send failed', 'Hello');
      
      expect(result).toBe('Failed to send "Hello" - please try again');
    });

    it('should use generic message for long messages', () => {
      const longMessage = 'A'.repeat(60);
      const result = errorHandler.handleMessageError('Send failed', longMessage);
      
      expect(result).toBe('Failed to send message - please try again');
    });

    it('should handle empty message text', () => {
      const result = errorHandler.handleMessageError('Send failed', '');
      
      expect(result).toBe('Failed to send "" - please try again');
    });

    it('should notify content scripts with original message', () => {
      mockChrome.tabs.query.mockImplementation((options, callback) => {
        callback([{ id: 1 }]);
      });
      
      errorHandler.handleMessageError('Test error', 'Test message');
      
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'MESSAGE_ERROR',
        error: 'Failed to send "Test message" - please try again',
        originalMessage: 'Test message'
      });
    });
  });

  describe('handleScreenshotError', () => {
    it('should categorize permission failures', () => {
      const result = errorHandler.handleScreenshotError('permission denied to capture screen');
      
      expect(result).toBe('Screenshot permission denied');
    });

    it('should categorize tab-related failures', () => {
      const result = errorHandler.handleScreenshotError('Cannot capture active tab');
      
      expect(result).toBe('Cannot capture this tab');
    });

    it('should return generic message for unknown screenshot errors', () => {
      const result = errorHandler.handleScreenshotError('Unknown screenshot error');
      
      expect(result).toBe('Screenshot failed');
    });

    it('should notify content scripts of screenshot errors', () => {
      mockChrome.tabs.query.mockImplementation((options, callback) => {
        callback([{ id: 1 }]);
      });
      
      errorHandler.handleScreenshotError('Test screenshot error');
      
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'SCREENSHOT_ERROR',
        error: 'Screenshot failed'
      });
    });
  });

  describe('logSuccess and logWarning', () => {
    it('should log successful operations at info level', () => {
      errorHandler.logSuccess('Connection', 'Connected to API');
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(Connection\):$/),
        'Connected to API successful'
      );
    });

    it('should log successful operations with details', () => {
      const details = { duration: '100ms', endpoint: '/api/v1' };
      
      errorHandler.logSuccess('API', 'Request completed', details);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(API\):$/),
        'Request completed successful',
        details
      );
    });

    it('should log warnings correctly', () => {
      const details = { retryCount: 3 };
      
      errorHandler.logWarning('Connection', 'Retry attempt', details);
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(Connection\):$/),
        'Retry attempt',
        details
      );
    });

    it('should log warnings without details', () => {
      errorHandler.logWarning('Test', 'Warning message');
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(Test\):$/),
        'Warning message'
      );
    });
  });

  describe('createErrorResponse and createSuccessResponse', () => {
    it('should create error response with correct format', () => {
      const result = errorHandler.createErrorResponse('Test error', 'TEST_ERROR');
      
      expect(result).toEqual({
        success: false,
        error: 'Test error',
        code: 'TEST_ERROR',
        timestamp: expect.any(Number)
      });
    });

    it('should create error response with default code', () => {
      const result = errorHandler.createErrorResponse('Test error');
      
      expect(result).toEqual({
        success: false,
        error: 'Test error',
        code: 'UNKNOWN_ERROR',
        timestamp: expect.any(Number)
      });
    });

    it('should create success response with data and message', () => {
      const testData = { result: 'success' };
      const result = errorHandler.createSuccessResponse(testData, 'Operation completed');
      
      expect(result).toEqual({
        success: true,
        timestamp: expect.any(Number),
        data: testData,
        message: 'Operation completed'
      });
    });

    it('should create success response without optional fields', () => {
      const result = errorHandler.createSuccessResponse();
      
      expect(result).toEqual({
        success: true,
        timestamp: expect.any(Number)
      });
    });

    it('should generate timestamps close to current time', () => {
      const beforeTime = Date.now();
      const result = errorHandler.createErrorResponse('Test');
      const afterTime = Date.now();
      
      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('formatError', () => {
    it('should include timestamp in formatted error', () => {
      const error = new Error('Test error');
      const context = 'Test context';
      
      const result = errorHandler.formatError(error, context);
      
      expect(result).toEqual({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        context: context,
        message: 'Test error',
        stack: expect.any(String),
        type: 'Error'
      });
    });

    it('should handle string errors', () => {
      const result = errorHandler.formatError('String error', 'Test context');
      
      expect(result).toEqual({
        timestamp: expect.any(String),
        context: 'Test context',
        message: 'String error',
        stack: null,
        type: 'Error'
      });
    });

    it('should handle errors without context', () => {
      const error = new TypeError('Type error');
      
      const result = errorHandler.formatError(error);
      
      expect(result).toEqual({
        timestamp: expect.any(String),
        context: '',
        message: 'Type error',
        stack: expect.any(String),
        type: 'TypeError'
      });
    });
  });

  describe('performance logging', () => {
    it('should track operation performance', () => {
      // Test slow operation (> 5000ms) - should use warn level
      errorHandler.logPerformance('Screenshot', 'capture', 6000);
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(Screenshot\):$/),
        'Slow capture: 6000ms'
      );
    });

    it('should log fast operations at debug level', () => {
      errorHandler.setLogLevel('debug'); // Enable debug logging
      errorHandler.logPerformance('API', 'request', 150);
      
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] AI Assistant \(API\):$/),
        'request: 150ms'
      );
    });
  });

  describe('content script notification', () => {
    it('should handle chrome API availability', () => {
      // Test when chrome is available
      mockChrome.tabs.query.mockImplementation((options, callback) => {
        callback([{ id: 1 }]);
      });
      
      errorHandler.handleConnectionError('Test error');
      
      expect(mockChrome.tabs.query).toHaveBeenCalled();
    });

    it('should handle chrome API unavailability', () => {
      // Test when chrome is not available
      delete global.chrome;
      
      // Should not throw error
      expect(() => {
        errorHandler.handleConnectionError('Test error');
      }).not.toThrow();
    });

    it('should handle sendMessage errors gracefully', () => {
      mockChrome.tabs.query.mockImplementation((options, callback) => {
        callback([{ id: 1 }]);
      });
      
      // Mock sendMessage to reject
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message) => {
        return Promise.reject(new Error('Tab not found'));
      });
      
      // Should not throw error
      expect(() => {
        errorHandler.handleConnectionError('Test error');
      }).not.toThrow();
    });
  });

  describe('log level changes', () => {
    it('should apply log level changes immediately', () => {
      // Start with debug level
      errorHandler.setLogLevel('debug');
      errorHandler.debug('Test', 'Debug message 1');
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      
      // Change to error level
      errorHandler.setLogLevel('error');
      errorHandler.debug('Test', 'Debug message 2');
      errorHandler.error('Test', 'Error message 1');
      
      // Debug should not be called again, error should be called
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
    });

    it('should validate log levels correctly', () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      
      validLevels.forEach(level => {
        errorHandler.setLogLevel(level);
        expect(errorHandler.logLevel).toBe(level);
      });
    });

    it('should maintain current level for invalid inputs', () => {
      const originalLevel = errorHandler.logLevel;
      
      errorHandler.setLogLevel('invalid');
      errorHandler.setLogLevel(null);
      errorHandler.setLogLevel(undefined);
      errorHandler.setLogLevel(123);
      
      expect(errorHandler.logLevel).toBe(originalLevel);
    });
  });
}); 