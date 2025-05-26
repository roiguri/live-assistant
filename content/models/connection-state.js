// Connection State Model - Manages connection status and streaming state
window.ConnectionState = (function() {
    'use strict';
    
    let currentTypingId = null;
    let currentResponseElement = null;
    let responseTimeout = null;
    let isStreaming = false;
    let isConnected = true;
    let observers = [];
    
    // Observer pattern for connection state changes
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
    
    function setConnected(connected) {
        if (isConnected !== connected) {
            isConnected = connected;
            notifyObservers('connection-changed', { isConnected });
        }
    }
    
    function getConnectionStatus() {
        return isConnected;
    }
    
    function reset() {
        clearTyping();
        setStreaming(false);
        clearResponseTimeout();
        notifyObservers('state-reset');
    }
    
    // Convenience methods for cleaner code
    function hasActiveTyping() {
        return isTyping();
    }
    
    function hasActiveStream() {
        return isCurrentlyStreaming();
    }
    
    function isOnline() {
        return getConnectionStatus();
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
        setConnected,
        getConnectionStatus,
        isOnline,
        reset,
        addObserver
    };
    
})(); 