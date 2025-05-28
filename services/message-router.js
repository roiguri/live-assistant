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
};