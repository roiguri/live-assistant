// Conversation Manager - Centralized conversation state and storage
globalThis.ConversationManager = class ConversationManager {
    constructor() {
        this.messages = [];
        this.maxMessages = 100;
        this.currentUIState = 'minimal'; // Track current UI state across tabs
        this.errorHandler = new globalThis.ErrorHandler();
        this.connectionManager = null; // Will be set by setConnectionManager
        this.init(); // Add initialization
    }
    
    async init() {
        await this.loadFromStorage();
        this.errorHandler.info('ConversationManager', `Loaded ${this.messages.length} messages from storage`);
    }
    
    async addMessage(text, sender, fromTabId) {
        const message = {
            id: `msg_${Date.now()}_${Math.random()}`,
            text,
            sender,
            timestamp: Date.now()
        };
        
        this.messages.push(message);
        
        // Keep only recent messages
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
        
        await this.saveToStorage();
        
        // Broadcast update to all tabs
        this.broadcastUpdate();
        
        this.errorHandler.debug('ConversationManager', 'Message added and broadcast', {
            sender, textLength: text.length, totalMessages: this.messages.length
        });
        
        return message;
    }
    
    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get(['conversation', 'uiState']);
            this.messages = result.conversation || [];
            this.currentUIState = result.uiState || 'minimal';
            this.errorHandler.debug('ConversationManager', 'Storage loaded', {
                messageCount: this.messages.length,
                uiState: this.currentUIState
            });
        } catch (error) {
            this.errorHandler.handleStorageError(error.message, 'load conversation');
            this.messages = [];
            this.currentUIState = 'minimal';
        }
    }
    
    async saveToStorage() {
        try {
            await chrome.storage.local.set({
                conversation: this.messages,
                uiState: this.currentUIState,
                lastUpdated: Date.now()
            });
            this.errorHandler.debug('ConversationManager', 'Saved to storage', {
                messageCount: this.messages.length,
                uiState: this.currentUIState
            });
        } catch (error) {
            this.errorHandler.handleStorageError(error.message, 'save conversation');
        }
    }
    
    broadcastUpdate() {
        try {
            chrome.tabs.query({}, (tabs) => {
                if (chrome.runtime.lastError) {
                    this.errorHandler.error('ConversationManager', 'Broadcast query failed', chrome.runtime.lastError.message);
                    return;
                }
                
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'CONVERSATION_UPDATE',
                        messages: this.messages
                    }, (response) => {
                        // Check for errors in the callback
                        if (chrome.runtime.lastError) {
                            // Silently ignore - tab might not have content script
                            this.errorHandler.debug('ConversationManager', 'Send message failed', chrome.runtime.lastError.message);
                        }
                    });
                });
                
                this.errorHandler.debug('ConversationManager', 'Broadcast sent to all tabs', {
                    messageCount: this.messages.length,
                    tabCount: tabs.length
                });
            });
        } catch (error) {
            this.errorHandler.error('ConversationManager', 'Broadcast failed', error.message);
        }
    }
    
    broadcastUIStateUpdate() {
        try {
            chrome.tabs.query({}, (tabs) => {
                if (chrome.runtime.lastError) {
                    this.errorHandler.error('ConversationManager', 'UI state broadcast query failed', chrome.runtime.lastError.message);
                    return;
                }
                
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'UI_STATE_UPDATE',
                        uiState: this.currentUIState
                    }, (response) => {
                        // Check for errors in the callback
                        if (chrome.runtime.lastError) {
                            // Silently ignore - tab might not have content script
                            this.errorHandler.debug('ConversationManager', 'Send UI state message failed', chrome.runtime.lastError.message);
                        }
                    });
                });
                
                this.errorHandler.debug('ConversationManager', 'UI state broadcast sent to all tabs', {
                    uiState: this.currentUIState,
                    tabCount: tabs.length
                });
            });
        } catch (error) {
            this.errorHandler.error('ConversationManager', 'UI state broadcast failed', error.message);
        }
    }
    
    async setUIState(newState) {
        if (!['minimal', 'recent', 'full'].includes(newState)) {
            this.errorHandler.error('ConversationManager', 'Invalid UI state', newState);
            return false;
        }
        
        this.currentUIState = newState;
        await this.saveToStorage();
        this.broadcastUIStateUpdate();
        
        this.errorHandler.debug('ConversationManager', 'UI state updated and broadcast', {
            newState
        });
        
        return true;
    }
    
    getUIState() {
        return this.currentUIState;
    }
    
    getConversation(limit = 50) {
        this.errorHandler.debug('ConversationManager', 'getConversation called', { limit });
        return this.messages.slice(-limit);
    }
    
    async clearConversation(resetConnection = true) {
        this.messages = [];
        this.currentUIState = 'minimal'; // Reset UI state to minimal
        await this.saveToStorage();
        this.broadcastUpdate();
        this.broadcastUIStateUpdate(); // Broadcast UI state reset to all tabs
        
        // Reset Gemini conversation context to start fresh (optional)
        if (resetConnection && this.connectionManager) {
            try {
                this.connectionManager.resetContext();
                this.errorHandler.info('ConversationManager', 'Conversation cleared, UI reset to minimal, Gemini context reset');
            } catch (error) {
                this.errorHandler.error('ConversationManager', 'Context reset failed during conversation clear', error.message);
                this.errorHandler.info('ConversationManager', 'Conversation cleared, UI reset to minimal (context reset failed)');
            }
        } else if (resetConnection) {
            this.errorHandler.info('ConversationManager', 'Conversation cleared, UI reset to minimal (no connection manager)');
        } else {
            this.errorHandler.info('ConversationManager', 'Conversation cleared, UI reset to minimal (connection reset skipped)');
        }
    }
    
    setConnectionManager(connectionManager) {
        this.connectionManager = connectionManager;
    }
    
    async removeLastUserMessage() {
        // Find and remove the last user message
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i].sender === 'user') {
                const removedMessage = this.messages.splice(i, 1)[0];
                await this.saveToStorage();
                this.broadcastUpdate();
                
                this.errorHandler.debug('ConversationManager', 'Last user message removed', {
                    messageId: removedMessage.id,
                    totalMessages: this.messages.length
                });
                
                return removedMessage;
            }
        }
        
        this.errorHandler.debug('ConversationManager', 'No user message found to remove');
        return null;
    }
};