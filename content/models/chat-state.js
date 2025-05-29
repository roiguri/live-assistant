// Chat State Model - Centralized message storage and state management
window.ChatState = (function() {
    'use strict';
    
    // Chat states
    const STATES = {
        MINIMAL: 'minimal',     // Just input
        RECENT: 'recent',       // Input + last message
        FULL: 'full'           // Full chat history
    };
    
    let currentState = STATES.MINIMAL;
    let messages = [];
    let observers = [];
    
    // Observer pattern for state changes
    function addObserver(callback) {
        observers.push(callback);
    }
    
    function notifyObservers(type, data) {
        observers.forEach(callback => callback(type, data));
    }
    
    function addMessage(text, sender = 'user') {
        const message = { text, sender, timestamp: Date.now() };
        messages.push(message);
        notifyObservers('message-added', message);
        return message;
    }
    
    function clearMessages() {
        messages = [];
        notifyObservers('messages-cleared');
    }
    
    function setMessages(newMessages) {
        messages = [...newMessages];
        notifyObservers('messages-updated', { messages: newMessages });
    }
    
    function setState(newState) {
        if (!STATES[newState.toUpperCase()]) return false;
        
        const oldState = currentState;
        currentState = newState;
        notifyObservers('state-changed', { oldState, newState });
        return true;
    }
    
    function getState() {
        return currentState;
    }
    
    function getMessages() {
        return [...messages]; // Return copy to prevent external modification
    }
    
    function getLastMessage() {
        return messages[messages.length - 1] || null;
    }
    
    // State query convenience methods
    function isMinimalState() {
        return currentState === STATES.MINIMAL;
    }
    
    function isRecentState() {
        return currentState === STATES.RECENT;
    }
    
    function isFullState() {
        return currentState === STATES.FULL;
    }
    
    // Public API
    return {
        STATES,
        addMessage,
        clearMessages,
        setMessages,
        setState,
        getState,
        getMessages,
        getLastMessage,
        addObserver,
        isMinimalState,
        isRecentState,
        isFullState
    };
    
})(); 