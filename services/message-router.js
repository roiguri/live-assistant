// Message Router - Routes messages between content scripts and services
globalThis.MessageRouter = class MessageRouter {
    constructor() {
        this.handlers = new Map();
        this.errorHandler = new globalThis.ErrorHandler();
        this.setupDefaultHandlers();
    }

    setupDefaultHandlers(connectionManager = null) {
        if (connectionManager) {
            this.connectionManager = connectionManager;
        }

        // Register default message handlers
        
        // SEND_TEXT_MESSAGE: Send user text to AI for processing and response generation
        // This triggers actual AI communication through the Gemini Live API
        this.registerHandler('SEND_TEXT_MESSAGE', (message, sender) => {
            if (this.connectionManager) {
                this.connectionManager.handleTextMessage(message.text, sender.tab.id);
            }
        });

        this.registerHandler('TAKE_SCREENSHOT', (message, sender, sendResponse) => {
            if (this.connectionManager) {
                this.connectionManager.handleTabScreenshot(sender.tab.id, sendResponse);
                return true; // Keep channel open for async response
            }
        });

        this.registerHandler('GET_CONNECTION_STATUS', (message, sender, sendResponse) => {
            if (this.connectionManager) {
                const status = this.connectionManager.getConnectionStatus();
                sendResponse(status);
            }
        });

        this.registerHandler('MANUAL_RECONNECT', (message, sender, sendResponse) => {
            if (this.connectionManager) {
                this.connectionManager.manualReconnect();
                sendResponse({ success: true });
            }
        });

        this.registerHandler('PROMPT_UPDATED', (message, sender, sendResponse) => {
            if (this.connectionManager) {
                this.connectionManager.handlePromptUpdate();
                sendResponse({ success: true });
            }
        });

        // ADD_MESSAGE: Add message to conversation history
        // This will trigger adding the message to the conversation manager
        this.registerHandler('ADD_MESSAGE', async (message, sender, sendResponse) => {
            if (this.conversationManager) {
                try {
                    await this.conversationManager.addMessage(
                        message.text, 
                        message.sender, 
                        sender.tab.id
                    );
                } catch (error) {
                    this.errorHandler.error('MessageRouter', 'ADD_MESSAGE failed', error.message);
                    // Continue gracefully - conversation storage failure shouldn't break the UI
                }
            }
            sendResponse({ success: true });
        });

        // GET_CONVERSATION: Retrieve conversation history for displaying in new tabs
        // This loads stored messages when a tab is opened or refreshed
        this.registerHandler('GET_CONVERSATION', (message, sender, sendResponse) => {
            this.errorHandler.debug('MessageRouter', 'GET_CONVERSATION received');
            sendResponse({ messages: [] }); // Empty for now
        });

        // CLEAR_CONVERSATION: Clear conversation history across all tabs
        // This will trigger clearing storage and broadcasting the update
        this.registerHandler('CLEAR_CONVERSATION', (message, sender, sendResponse) => {
            this.errorHandler.debug('MessageRouter', 'CLEAR_CONVERSATION received');
            sendResponse({ success: true });
        });
    }

    registerHandler(messageType, handler) {
        this.handlers.set(messageType, handler);
    }

    handleMessage(message, sender, sendResponse) {
        const handler = this.handlers.get(message.type);
        
        if (handler) {
            try {
                const result = handler(message, sender, sendResponse);
                // Return true if handler needs to keep response channel open
                return result === true;
            } catch (error) {
                this.errorHandler.error('MessageRouter', `Error handling ${message.type}`, error.message);
                if (sendResponse) {
                    sendResponse({ success: false, error: error.message });
                }
                return false;
            }
        } else {
            this.errorHandler.logWarning('MessageRouter', `No handler for message type: ${message.type}`);
            return false;
        }
    }

    // Broadcast message to all tabs
    broadcastToAllTabs(message) {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // Ignore errors for tabs without content script
                });
            });
        });
    }

    // Send message to specific tab
    sendToTab(tabId, message, callback = null) {
        if (callback) {
            chrome.tabs.sendMessage(tabId, message, callback);
        } else {
            chrome.tabs.sendMessage(tabId, message).catch(() => {
                // Ignore errors for tabs without content script
            });
        }
    }

    setConversationManager(conversationManager) {
        this.conversationManager = conversationManager;
    }
};