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
    
    function setMessages(newMessages) {
        messages = [...newMessages];
        notifyObservers('messages-updated', { messages: newMessages });
    }
    
    function setState(newState) {
        if (!STATES[newState.toUpperCase()]) return false;
        
        const oldState = currentState;
        currentState = newState;
        
        // Sync state to background for cross-tab persistence
        chrome.runtime.sendMessage({
            type: 'SET_UI_STATE',
            uiState: newState
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to sync UI state to background:', chrome.runtime.lastError.message);
            }
        });
        
        notifyObservers('state-changed', { oldState, newState });
        return true;
    }
    
    // Set state from background sync (without triggering another background update)
    function setStateFromSync(newState) {
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
    
    // Load initial state from background
    function loadInitialState() {
        chrome.runtime.sendMessage({
            type: 'GET_UI_STATE'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to load initial UI state:', chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.uiState) {
                setStateFromSync(response.uiState);
            }
        });
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
        setMessages,
        setState,
        setStateFromSync, // For background sync updates
        getState,
        getMessages,
        getLastMessage,
        addObserver,
        isMinimalState,
        isRecentState,
        isFullState,
        loadInitialState // Export for manual initialization
    };
    
})(); 