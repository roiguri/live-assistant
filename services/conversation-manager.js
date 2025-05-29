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
    
    // Stub methods for now - will be implemented in later steps
    async addMessage(text, sender, fromTabId) {
        this.errorHandler.debug('ConversationManager', 'addMessage called', {
            text: text.substring(0, 50) + '...', 
            sender, 
            fromTabId
        });
        // TODO: Implement in Step 5
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
        this.errorHandler.debug('ConversationManager', 'broadcastUpdate called');
        // TODO: Implement in Step 6
    }
    
    getConversation(limit = 50) {
        this.errorHandler.debug('ConversationManager', 'getConversation called', { limit });
        return this.messages.slice(-limit);
    }
    
    clearConversation() {
        this.errorHandler.debug('ConversationManager', 'clearConversation called');
        // TODO: Implement in Step 8
    }
};