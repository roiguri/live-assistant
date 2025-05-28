// GeminiClient Service Unit Tests
describe('GeminiClient', () => {
  let geminiClient;
  let mockErrorHandler;

  beforeEach(() => {
    // Create fresh instance
    geminiClient = new global.GeminiClient();
    
    // Mock ErrorHandler methods
    mockErrorHandler = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logWarning: jest.fn()
    };
    geminiClient.errorHandler = mockErrorHandler;
  });

  describe('createSetupMessage', () => {
    it('should format setup message correctly', () => {
      const systemPrompt = 'You are a helpful AI assistant.';
      
      const result = geminiClient.createSetupMessage(systemPrompt);
      
      expect(result).toEqual({
        setup: {
          model: "models/gemini-2.0-flash-exp",
          generationConfig: {
            responseModalities: ["TEXT"]
          },
          systemInstruction: {
            parts: [{
              text: systemPrompt
            }]
          }
        }
      });
    });

    it('should handle empty system prompt', () => {
      const result = geminiClient.createSetupMessage('');
      
      expect(result.setup.systemInstruction.parts[0].text).toBe('');
    });

    it('should handle special characters in system prompt', () => {
      const specialPrompt = 'System with "quotes" and \n newlines';
      
      const result = geminiClient.createSetupMessage(specialPrompt);
      
      expect(result.setup.systemInstruction.parts[0].text).toBe(specialPrompt);
    });
  });

  describe('createTextMessage', () => {
    it('should increment counter and return message with ID', () => {
      const text1 = 'First message';
      const text2 = 'Second message';
      
      const result1 = geminiClient.createTextMessage(text1);
      const result2 = geminiClient.createTextMessage(text2);
      
      expect(result1.messageId).toBe(1);
      expect(result2.messageId).toBe(2);
      expect(result1.message.clientContent.turns[0].parts[0].text).toBe(text1);
      expect(result2.message.clientContent.turns[0].parts[0].text).toBe(text2);
    });

    it('should format text message correctly', () => {
      const testText = 'Hello, how are you?';
      
      const result = geminiClient.createTextMessage(testText);
      
      expect(result.message).toEqual({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{ text: testText }]
          }],
          turnComplete: true
        }
      });
    });

    it('should track pending message correctly', () => {
      const testText = 'Test message';
      
      const result = geminiClient.createTextMessage(testText);
      
      const pendingMessage = geminiClient.getPendingMessage(`msg_${result.messageId}`);
      expect(pendingMessage).toMatchObject({
        text: testText,
        messageId: result.messageId,
        timestamp: expect.any(Number)
      });
    });

    it('should call debug logger', () => {
      geminiClient.createTextMessage('Test');
      
      expect(mockErrorHandler.debug).toHaveBeenCalledWith(
        'GeminiClient',
        'Text message created [1]'
      );
    });
  });

  describe('createScreenshotMessage', () => {
    it('should handle base64 data correctly', () => {
      const base64Data = testData.testScreenshot.replace('data:image/jpeg;base64,', '');
      
      const result = geminiClient.createScreenshotMessage(base64Data);
      
      expect(result.message).toEqual({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            }]
          }],
          turnComplete: true
        }
      });
    });

    it('should track screenshot pending message', () => {
      const base64Data = 'VGVzdCBkYXRh'; // "Test data" in base64
      
      const result = geminiClient.createScreenshotMessage(base64Data);
      
      const pendingMessage = geminiClient.getPendingMessage(`screenshot_${result.messageId}`);
      expect(pendingMessage).toMatchObject({
        type: 'screenshot',
        messageId: result.messageId,
        timestamp: expect.any(Number)
      });
    });

    it('should increment counter for screenshots', () => {
      geminiClient.createTextMessage('text'); // messageId 1
      const result = geminiClient.createScreenshotMessage('data'); // should be messageId 2
      
      expect(result.messageId).toBe(2);
    });

    it('should log debug information with data size', () => {
      const testData = 'A'.repeat(1024); // 1KB of data
      
      geminiClient.createScreenshotMessage(testData);
      
      expect(mockErrorHandler.debug).toHaveBeenCalledWith(
        'GeminiClient',
        'Screenshot message created [1]',
        { dataSize: '1KB' }
      );
    });
  });

  describe('parseResponse', () => {
    it('should handle valid JSON string correctly', () => {
      const jsonResponse = JSON.stringify(mockGeminiResponses.textResponse);
      
      const result = geminiClient.parseResponse(jsonResponse);
      
      expect(result).toEqual({
        type: 'content',
        text: 'Test response',
        isComplete: true
      });
    });

    it('should handle Blob responses correctly', async () => {
      const jsonData = JSON.stringify(mockGeminiResponses.setupComplete);
      
      // Create a proper Blob class mock
      class MockBlob {
        constructor(data) {
          this.data = data;
        }
        
        text() {
          return Promise.resolve(jsonData);
        }
      }
      
      // Replace global Blob for this test
      const originalBlob = global.Blob;
      global.Blob = MockBlob;
      
      const mockBlob = new MockBlob([jsonData]);
      
      const result = await geminiClient.parseResponse(mockBlob);
      
      expect(result).toEqual({
        type: 'setup_complete'
      });
      
      // Restore original Blob
      global.Blob = originalBlob;
    });

    it('should handle setup completion response', () => {
      const jsonResponse = JSON.stringify(mockGeminiResponses.setupComplete);
      
      const result = geminiClient.parseResponse(jsonResponse);
      
      expect(result).toEqual({
        type: 'setup_complete'
      });
    });

    it('should handle content responses with streaming', () => {
      const jsonResponse = JSON.stringify(mockGeminiResponses.streamingResponse);
      
      const result = geminiClient.parseResponse(jsonResponse);
      
      expect(result).toEqual({
        type: 'content',
        text: 'Partial response',
        isComplete: false
      });
    });

    it('should handle error responses correctly', () => {
      const jsonResponse = JSON.stringify(mockGeminiResponses.errorResponse);
      
      const result = geminiClient.parseResponse(jsonResponse);
      
      expect(result).toEqual({
        type: 'error',
        error: mockGeminiResponses.errorResponse.error
      });
    });

    it('should handle unknown response types', () => {
      const unknownResponse = { unknownField: 'test', otherField: 123 };
      const jsonResponse = JSON.stringify(unknownResponse);
      
      const result = geminiClient.parseResponse(jsonResponse);
      
      expect(result).toEqual({
        type: 'unknown',
        response: unknownResponse
      });
      expect(mockErrorHandler.logWarning).toHaveBeenCalledWith(
        'GeminiClient',
        'Unknown response keys detected',
        expect.objectContaining({
          unknownKeys: ['unknownField', 'otherField'],
          response: unknownResponse
        })
      );
    });

    it('should handle invalid JSON strings', () => {
      const invalidJson = '{ invalid json }';
      
      const result = geminiClient.parseResponse(invalidJson);
      
      expect(result).toEqual({
        type: 'error',
        error: 'Failed to parse response'
      });
      expect(mockErrorHandler.error).toHaveBeenCalledWith(
        'GeminiClient',
        'Failed to parse string as JSON',
        expect.any(String)
      );
    });

    it('should handle unknown data types', () => {
      const result = geminiClient.parseResponse(12345);
      
      expect(result).toEqual({
        type: 'error',
        error: 'Unknown response format'
      });
      expect(mockErrorHandler.error).toHaveBeenCalledWith(
        'GeminiClient',
        'Unknown response type: number'
      );
    });

    it('should handle malformed Blob responses', async () => {
      const invalidJsonData = '{ invalid json }';
      
      // Create a proper Blob class mock that returns invalid JSON
      class MockBlob {
        constructor(data) {
          this.data = data;
        }
        
        text() {
          return Promise.resolve(invalidJsonData);
        }
      }
      
      // Replace global Blob for this test
      const originalBlob = global.Blob;
      global.Blob = MockBlob;
      
      const mockBlob = new MockBlob([invalidJsonData]);
      
      const result = await geminiClient.parseResponse(mockBlob);
      
      expect(result).toEqual({
        type: 'error',
        error: 'Failed to parse response'
      });
      expect(mockErrorHandler.error).toHaveBeenCalledWith(
        'GeminiClient',
        'Failed to parse Blob text as JSON',
        expect.any(String)
      );
      
      // Restore original Blob
      global.Blob = originalBlob;
    });
  });

  describe('pending message tracking', () => {
    it('should track and retrieve pending messages', () => {
      const { messageId } = geminiClient.createTextMessage('Test');
      
      const pending = geminiClient.getPendingMessage(`msg_${messageId}`);
      
      expect(pending).toMatchObject({
        text: 'Test',
        messageId: messageId
      });
    });

    it('should return undefined for non-existent messages', () => {
      const result = geminiClient.getPendingMessage('nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should clear specific pending messages', () => {
      const { messageId } = geminiClient.createTextMessage('Test');
      const messageKey = `msg_${messageId}`;
      
      const cleared = geminiClient.clearPendingMessage(messageKey);
      
      expect(cleared).toBe(true);
      expect(geminiClient.getPendingMessage(messageKey)).toBeUndefined();
      expect(mockErrorHandler.debug).toHaveBeenCalledWith(
        'GeminiClient',
        `Cleared pending message [${messageKey}]`
      );
    });

    it('should return false when clearing non-existent messages', () => {
      const result = geminiClient.clearPendingMessage('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should get correct pending message count', () => {
      expect(geminiClient.getPendingMessageCount()).toBe(0);
      
      geminiClient.createTextMessage('Test 1');
      expect(geminiClient.getPendingMessageCount()).toBe(1);
      
      geminiClient.createTextMessage('Test 2');
      expect(geminiClient.getPendingMessageCount()).toBe(2);
      
      geminiClient.createScreenshotMessage('data');
      expect(geminiClient.getPendingMessageCount()).toBe(3);
    });
  });

  describe('cleanup functions', () => {
    it('should clear all pending messages', () => {
      geminiClient.createTextMessage('Test 1');
      geminiClient.createTextMessage('Test 2');
      geminiClient.createScreenshotMessage('data');
      
      expect(geminiClient.getPendingMessageCount()).toBe(3);
      
      geminiClient.clearAllPendingMessages();
      
      expect(geminiClient.getPendingMessageCount()).toBe(0);
      expect(mockErrorHandler.info).toHaveBeenCalledWith(
        'GeminiClient',
        'Cleared 3 pending messages'
      );
    });

    it('should handle clearing when no pending messages exist', () => {
      geminiClient.clearAllPendingMessages();
      
      expect(geminiClient.getPendingMessageCount()).toBe(0);
      expect(mockErrorHandler.info).not.toHaveBeenCalled();
    });

    it('should cleanup old pending messages', () => {
      // Create messages and manually set old timestamps
      const { messageId: id1 } = geminiClient.createTextMessage('Test 1');
      const { messageId: id2 } = geminiClient.createTextMessage('Test 2');
      const { messageId: id3 } = geminiClient.createTextMessage('Test 3');
      
      // Mock old timestamps (older than 30 seconds)
      const oldTime = Date.now() - 35000; // 35 seconds ago
      geminiClient.pendingMessages.set(`msg_${id1}`, {
        text: 'Test 1',
        messageId: id1,
        timestamp: oldTime
      });
      geminiClient.pendingMessages.set(`msg_${id2}`, {
        text: 'Test 2', 
        messageId: id2,
        timestamp: oldTime
      });
      // id3 keeps current timestamp
      
      geminiClient.cleanupOldPendingMessages();
      
      expect(geminiClient.getPendingMessageCount()).toBe(1);
      expect(geminiClient.getPendingMessage(`msg_${id3}`)).toBeDefined();
      expect(geminiClient.getPendingMessage(`msg_${id1}`)).toBeUndefined();
      expect(geminiClient.getPendingMessage(`msg_${id2}`)).toBeUndefined();
      
      expect(mockErrorHandler.logWarning).toHaveBeenCalledWith(
        'GeminiClient',
        'Cleaned up 2 old pending messages'
      );
    });

    it('should not cleanup recent messages', () => {
      geminiClient.createTextMessage('Recent message');
      
      geminiClient.cleanupOldPendingMessages();
      
      expect(geminiClient.getPendingMessageCount()).toBe(1);
      expect(mockErrorHandler.logWarning).not.toHaveBeenCalled();
    });
  });

  describe('createHealthPing', () => {
    it('should create health ping message with empty turns', () => {
      const result = geminiClient.createHealthPing();
      
      expect(result).toEqual({
        clientContent: {
          turns: []
        }
      });
    });
  });

  describe('_processParsedResponse', () => {
    it('should process metadata responses', () => {
      const metadataResponse = {
        usageMetadata: {
          promptTokenCount: 10,
          totalTokenCount: 25
        }
      };
      
      const result = geminiClient._processParsedResponse(metadataResponse);
      
      expect(result).toEqual({
        type: 'metadata',
        metadata: metadataResponse.usageMetadata
      });
    });

    it('should handle empty responses', () => {
      const result = geminiClient._processParsedResponse({});
      
      expect(result).toEqual({
        type: 'empty'
      });
    });

    it('should log debug information for response processing', () => {
      geminiClient._processParsedResponse(mockGeminiResponses.textResponse);
      
      expect(mockErrorHandler.debug).toHaveBeenCalledWith(
        'GeminiClient',
        'Processing response',
        expect.objectContaining({
          hasSetupComplete: false,
          hasServerContent: true,
          hasToolCall: false,
          hasError: false,
          hasUsageMetadata: false
        })
      );
    });
  });
}); 