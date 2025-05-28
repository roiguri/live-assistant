// Gemini Client - Handles API formatting and response parsing
globalThis.GeminiClient = class GeminiClient {
    constructor() {
        this.messageCounter = 0;
        this.pendingMessages = new Map();
        this.errorHandler = new globalThis.ErrorHandler();
    }

    // Format setup message for Gemini Live API
    createSetupMessage(systemPrompt) {
        return {
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
        };
    }

    // Format text message for Gemini Live API
    createTextMessage(text) {
        const messageId = ++this.messageCounter;
        const message = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: text }]
                }],
                turnComplete: true
            }
        };

        // Track pending message
        this.pendingMessages.set(`msg_${messageId}`, {
            text: text,
            timestamp: Date.now(),
            messageId: messageId
        });

        this.errorHandler.debug('GeminiClient', `Text message created [${messageId}]`);
        return { message, messageId };
    }

    // Format screenshot message for Gemini Live API
    createScreenshotMessage(base64Data) {
        const messageId = ++this.messageCounter;
        const message = {
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
        };

        // Track pending message
        this.pendingMessages.set(`screenshot_${messageId}`, {
            type: 'screenshot',
            timestamp: Date.now(),
            messageId: messageId
        });

        this.errorHandler.debug('GeminiClient', `Screenshot message created [${messageId}]`, {
            dataSize: `${Math.round(base64Data.length / 1024)}KB`
        });
        return { message, messageId };
    }

    // Create health ping message
    createHealthPing() {
        return {
            clientContent: {
                turns: []
            }
        };
    }

    // Parse Gemini response and extract relevant data
    parseResponse(responseData) {
        let response;
        
        // Handle different input types
        if (responseData instanceof Blob) {
            // Return a promise for Blob data
            return responseData.text().then(text => {
                try {
                    return this._processParsedResponse(JSON.parse(text));
                } catch (e) {
                    this.errorHandler.error('GeminiClient', 'Failed to parse Blob text as JSON', e.message);
                    return { type: 'error', error: 'Failed to parse response' };
                }
            });
        } else if (typeof responseData === 'string') {
            try {
                response = JSON.parse(responseData);
            } catch (e) {
                this.errorHandler.error('GeminiClient', 'Failed to parse string as JSON', e.message);
                return { type: 'error', error: 'Failed to parse response' };
            }
        } else {
            this.errorHandler.error('GeminiClient', `Unknown response type: ${typeof responseData}`);
            return { type: 'error', error: 'Unknown response format' };
        }

        return this._processParsedResponse(response);
    }

    // Process parsed JSON response
    _processParsedResponse(response) {
        this.errorHandler.debug('GeminiClient', 'Processing response', {
            hasSetupComplete: !!response.setupComplete,
            hasServerContent: !!response.serverContent,
            hasToolCall: !!response.toolCall,
            hasError: !!response.error,
            hasUsageMetadata: !!response.usageMetadata
        });

        // Setup completion
        if (response.setupComplete) {
            return {
                type: 'setup_complete'
            };
        }

        // Server content (AI response)
        if (response.serverContent) {
            let responseText = '';
            
            if (response.serverContent.modelTurn && response.serverContent.modelTurn.parts) {
                response.serverContent.modelTurn.parts.forEach(part => {
                    if (part.text) {
                        responseText += part.text;
                    }
                });
            }

            const isComplete = response.serverContent.turnComplete === true;

            this.errorHandler.debug('GeminiClient', 'Content response', {
                textLength: responseText.length,
                isComplete: isComplete
            });

            return {
                type: 'content',
                text: responseText,
                isComplete: isComplete
            };
        }

        // Tool call
        if (response.toolCall) {
            this.errorHandler.info('GeminiClient', 'Tool call received', response.toolCall);
            return {
                type: 'tool_call',
                toolCall: response.toolCall
            };
        }

        // Error response
        if (response.error) {
            this.errorHandler.error('GeminiClient', 'API error response', response.error);
            return {
                type: 'error',
                error: response.error
            };
        }

        // Usage metadata (can be ignored)
        if (response.usageMetadata) {
            this.errorHandler.debug('GeminiClient', 'Usage metadata', response.usageMetadata);
            return {
                type: 'metadata',
                metadata: response.usageMetadata
            };
        }

        // Unknown response type
        const knownKeys = ['setupComplete', 'serverContent', 'toolCall', 'error', 'usageMetadata'];
        const unknownKeys = Object.keys(response).filter(key => !knownKeys.includes(key));
        
        if (unknownKeys.length > 0) {
            this.errorHandler.logWarning('GeminiClient', 'Unknown response keys detected', {
                unknownKeys: unknownKeys,
                response: response
            });
            return {
                type: 'unknown',
                response: response
            };
        }

        return {
            type: 'empty'
        };
    }

    // Get pending message info
    getPendingMessage(messageId) {
        return this.pendingMessages.get(messageId);
    }

    // Clear pending message
    clearPendingMessage(messageId) {
        const cleared = this.pendingMessages.delete(messageId);
        if (cleared) {
            this.errorHandler.debug('GeminiClient', `Cleared pending message [${messageId}]`);
        }
        return cleared;
    }

    // Clear all pending messages
    clearAllPendingMessages() {
        const count = this.pendingMessages.size;
        this.pendingMessages.clear();
        if (count > 0) {
            this.errorHandler.info('GeminiClient', `Cleared ${count} pending messages`);
        }
    }

    // Get pending message count
    getPendingMessageCount() {
        return this.pendingMessages.size;
    }

    // Clean up old pending messages (older than 30 seconds)
    cleanupOldPendingMessages() {
        const now = Date.now();
        const timeout = 30000; // 30 seconds
        let cleanedCount = 0;

        for (const [key, message] of this.pendingMessages) {
            if (now - message.timestamp > timeout) {
                this.pendingMessages.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.errorHandler.logWarning('GeminiClient', `Cleaned up ${cleanedCount} old pending messages`);
        }
    }
};