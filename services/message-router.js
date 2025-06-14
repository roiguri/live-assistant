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
        this.registerHandler('SEND_TEXT_MESSAGE', (message, sender, sendResponse) => {
            if (this.connectionManager) {
                this.connectionManager.handleTextMessage(message.text, sender.tab.id, sendResponse);
                return true; // Keep channel open for async response
            } else {
                sendResponse({ success: false, error: 'No connection manager available' });
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
            if (this.conversationManager) {
                const limit = message.limit || 50;
                const messages = this.conversationManager.getConversation(limit);
                sendResponse({ messages });
                this.errorHandler.debug('MessageRouter', 'GET_CONVERSATION sent', {
                    messageCount: messages.length, limit
                });
            } else {
                sendResponse({ messages: [] });
                this.errorHandler.debug('MessageRouter', 'GET_CONVERSATION - no conversation manager');
            }
        });

        // CLEAR_CONVERSATION: Clear conversation history across all tabs
        // This will trigger clearing storage and broadcasting the update
        this.registerHandler('CLEAR_CONVERSATION', (message, sender, sendResponse) => {
            try {
                if (this.conversationManager) {
                    this.conversationManager.clearConversation();
                    this.errorHandler.debug('MessageRouter', 'CLEAR_CONVERSATION completed');
                } else {
                    this.errorHandler.debug('MessageRouter', 'CLEAR_CONVERSATION - no conversation manager');
                }
            } catch (error) {
                this.errorHandler.error('MessageRouter', 'CLEAR_CONVERSATION failed', error.message);
                // Continue gracefully - conversation clearing failure shouldn't break the UI
            }
            sendResponse({ success: true });
        });

        // SET_UI_STATE: Update UI state across all tabs
        // This will trigger storing the state and broadcasting to all tabs
        this.registerHandler('SET_UI_STATE', async (message, sender, sendResponse) => {
            try {
                if (this.conversationManager) {
                    const success = await this.conversationManager.setUIState(message.uiState);
                    this.errorHandler.debug('MessageRouter', 'SET_UI_STATE completed', {
                        uiState: message.uiState,
                        success
                    });
                    sendResponse({ success });
                } else {
                    this.errorHandler.debug('MessageRouter', 'SET_UI_STATE - no conversation manager');
                    sendResponse({ success: false });
                }
            } catch (error) {
                this.errorHandler.error('MessageRouter', 'SET_UI_STATE failed', error.message);
                sendResponse({ success: false, error: error.message });
            }
            return true; // Keep response channel open for async operation
        });

        // GET_UI_STATE: Retrieve current UI state for new tabs
        // This loads the stored UI state when a tab is opened or refreshed
        this.registerHandler('GET_UI_STATE', (message, sender, sendResponse) => {
            if (this.conversationManager) {
                const uiState = this.conversationManager.getUIState();
                sendResponse({ uiState });
                this.errorHandler.debug('MessageRouter', 'GET_UI_STATE sent', {
                    uiState
                });
            } else {
                sendResponse({ uiState: 'minimal' });
                this.errorHandler.debug('MessageRouter', 'GET_UI_STATE - no conversation manager, defaulting to minimal');
            }
        });

        // REMOVE_LAST_USER_MESSAGE: Remove the last user message from conversation history
        // This is used when a message fails to send and needs to be removed from history
        this.registerHandler('REMOVE_LAST_USER_MESSAGE', async (message, sender, sendResponse) => {
            try {
                if (this.conversationManager) {
                    await this.conversationManager.removeLastUserMessage();
                    this.errorHandler.debug('MessageRouter', 'REMOVE_LAST_USER_MESSAGE completed');
                    sendResponse({ success: true });
                } else {
                    this.errorHandler.debug('MessageRouter', 'REMOVE_LAST_USER_MESSAGE - no conversation manager');
                    sendResponse({ success: false });
                }
            } catch (error) {
                this.errorHandler.error('MessageRouter', 'REMOVE_LAST_USER_MESSAGE failed', error.message);
                sendResponse({ success: false, error: error.message });
            }
            return true; // Keep response channel open for async operation
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
                // Handle both sync handlers returning true and async handlers
                if (result === true || (result && typeof result.then === 'function')) {
                    return true;
                }
                return false;
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