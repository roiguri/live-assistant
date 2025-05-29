// Conversation Manager - Centralized conversation state and storage
globalThis.ConversationManager = class ConversationManager {
    constructor() {
        this.messages = [];
        this.maxMessages = 100;
        this.errorHandler = new globalThis.ErrorHandler();
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
            const result = await chrome.storage.local.get(['conversation']);
            this.messages = result.conversation || [];
            this.errorHandler.debug('ConversationManager', 'Storage loaded', {
                messageCount: this.messages.length
            });
        } catch (error) {
            this.errorHandler.handleStorageError(error.message, 'load conversation');
            this.messages = [];
        }
    }
    
    async saveToStorage() {
        try {
            await chrome.storage.local.set({
                conversation: this.messages,
                lastUpdated: Date.now()
            });
            this.errorHandler.debug('ConversationManager', 'Saved to storage', {
                messageCount: this.messages.length
            });
        } catch (error) {
            this.errorHandler.handleStorageError(error.message, 'save conversation');
        }
    }
    
    broadcastUpdate() {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'CONVERSATION_UPDATE',
                    messages: this.messages
                }).catch(() => {
                    // Ignore tabs without content script
                });
            });
        });
        
        this.errorHandler.debug('ConversationManager', 'Broadcast sent to all tabs', {
            messageCount: this.messages.length
        });
    }
    
    getConversation(limit = 50) {
        this.errorHandler.debug('ConversationManager', 'getConversation called', { limit });
        return this.messages.slice(-limit);
    }
    
    clearConversation() {
        this.messages = [];
        this.saveToStorage();
        this.broadcastUpdate();
        
        this.errorHandler.info('ConversationManager', 'Conversation cleared and broadcast');
    }
};