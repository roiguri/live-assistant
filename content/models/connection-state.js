// Connection State Model - UI-specific state only (typing, streaming, timeouts)
window.ConnectionState = (function() {
    'use strict';
    
    let currentTypingId = null;
    let currentResponseElement = null;
    let responseTimeout = null;
    let isStreaming = false;
    let observers = [];
    
    // Connection status tracking
    let connectionStatus = 'disconnected';
    let pendingMessages = [];
    let isInputBlocked = false;
    
    // Observer pattern for UI state changes
    function addObserver(callback) {
        observers.push(callback);
    }
    
    function notifyObservers(type, data) {
        observers.forEach(callback => callback(type, data));
    }
    
    function setTyping(typingId) {
        currentTypingId = typingId;
        notifyObservers('typing-started', { typingId });
    }
    
    function clearTyping() {
        const oldTypingId = currentTypingId;
        currentTypingId = null;
        if (oldTypingId) {
            notifyObservers('typing-cleared', { typingId: oldTypingId });
        }
    }
    
    function getTypingId() {
        return currentTypingId;
    }
    
    function isTyping() {
        return currentTypingId !== null;
    }
    
    function setStreaming(active, responseElement = null) {
        isStreaming = active;
        if (active && responseElement) {
            currentResponseElement = responseElement;
        } else if (!active) {
            currentResponseElement = null;
        }
        notifyObservers('streaming-changed', { isStreaming, responseElement });
    }
    
    function getStreamingElement() {
        return currentResponseElement;
    }
    
    function isCurrentlyStreaming() {
        return isStreaming;
    }
    
    function setResponseTimeout(timeoutId) {
        if (responseTimeout) {
            clearTimeout(responseTimeout);
        }
        responseTimeout = timeoutId;
    }
    
    function clearResponseTimeout() {
        if (responseTimeout) {
            clearTimeout(responseTimeout);
            responseTimeout = null;
        }
    }
    
    function reset() {
        clearTyping();
        setStreaming(false);
        clearResponseTimeout();
        notifyObservers('state-reset');
    }
    
    function clearObservers() {
        observers = [];
    }
    
    // Convenience methods for cleaner code
    function hasActiveTyping() {
        return isTyping();
    }
    
    function hasActiveStream() {
        return isCurrentlyStreaming();
    }
    
    // Connection status management
    function setConnectionStatus(status) {
        const oldStatus = connectionStatus;
        connectionStatus = status;
        
        // Update input blocking based on connection status
        setInputBlocked(status !== 'connected');
        
        if (oldStatus !== status) {
            notifyObservers('connection-status-changed', { status, oldStatus });
        }
    }
    
    function getConnectionStatus() {
        return connectionStatus;
    }
    
    function isConnected() {
        return connectionStatus === 'connected';
    }
    
    // Input blocking management
    function setInputBlocked(blocked) {
        const oldBlocked = isInputBlocked;
        isInputBlocked = blocked;
        
        if (oldBlocked !== blocked) {
            notifyObservers('input-blocked-changed', { blocked });
        }
    }
    
    function getInputBlocked() {
        return isInputBlocked;
    }
    
    // Pending messages management
    function addPendingMessage(message, retryCount = 0) {
        // Check if we already have this message (to avoid duplicates during retry)
        const existingMessage = pendingMessages.find(msg => msg.text === message);
        if (existingMessage) {
            existingMessage.retryCount = (existingMessage.retryCount || 0) + 1;
            existingMessage.timestamp = Date.now();
            notifyObservers('pending-message-updated', { message: existingMessage });
            return existingMessage.id;
        }
        
        const pendingMessage = {
            id: `pending_${Date.now()}_${Math.random()}`,
            text: message,
            timestamp: Date.now(),
            retryCount: retryCount
        };
        
        // Limit queue size to prevent memory issues
        const MAX_PENDING_MESSAGES = 10;
        if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
            const removedMessage = pendingMessages.shift();
            notifyObservers('pending-message-removed', { message: removedMessage, reason: 'queue_full' });
        }
        
        pendingMessages.push(pendingMessage);
        notifyObservers('pending-message-added', { message: pendingMessage });
        return pendingMessage.id;
    }
    
    function getPendingMessages() {
        return [...pendingMessages];
    }
    
    function clearPendingMessages() {
        const clearedMessages = [...pendingMessages];
        pendingMessages = [];
        notifyObservers('pending-messages-cleared', { clearedMessages });
        return clearedMessages;
    }
    
    function removePendingMessage(messageId) {
        const index = pendingMessages.findIndex(msg => msg.id === messageId);
        if (index !== -1) {
            const removedMessage = pendingMessages.splice(index, 1)[0];
            notifyObservers('pending-message-removed', { message: removedMessage });
            return removedMessage;
        }
        return null;
    }
    
    // Public API
    return {
        setTyping,
        clearTyping,
        getTypingId,
        isTyping,
        hasActiveTyping,
        setStreaming,
        getStreamingElement,
        isCurrentlyStreaming,
        hasActiveStream,
        setResponseTimeout,
        clearResponseTimeout,
        reset,
        addObserver,
        clearObservers,
        // Connection status
        setConnectionStatus,
        getConnectionStatus,
        isConnected,
        // Input blocking
        setInputBlocked,
        getInputBlocked,
        // Pending messages
        addPendingMessage,
        getPendingMessages,
        clearPendingMessages,
        removePendingMessage
    };
    
})();