// Main Content Script - Entry point for AI Assistant
(function() {
    'use strict';
    
    // Prevent multiple injections
    if (window.assistantInjected) return;
    window.assistantInjected = true;
    
    // Wait for modules to be loaded, then initialize
    initializeChat();
    
    function initializeChat() {
      // Ensure modules are available
      if (!window.ChatUI || !window.ChatEvents) {
        return;
      }
      
      try {
        // Create and inject the chat interface
        const chatContainer = window.ChatUI.createChatContainer();
        document.body.appendChild(chatContainer);

        // Check visibility preference and apply it
        chrome.storage.local.get(['chatVisible'], (result) => {
          const isVisible = result.chatVisible !== false; // Default to true
          chatContainer.style.display = isVisible ? 'block' : 'none';
        });
        
        // Load existing conversation history for new tabs
        chrome.runtime.sendMessage({
          type: 'GET_CONVERSATION',
          limit: 50
        }, (response) => {
          if (response && response.messages && response.messages.length > 0) {
            // Update ChatState with loaded messages
            window.ChatState.setMessages(response.messages);
            
            // Update the chat display
            window.ChatEvents.updateChatDisplay(chatContainer, response.messages);
          }
        });
        
        // Load UI state for new tabs (after container and listeners are ready)
        chrome.runtime.sendMessage({
          type: 'GET_UI_STATE'
        }, (response) => {
          if (response && response.uiState) {
            // Update ChatState with loaded UI state
            window.ChatState.setStateFromSync(response.uiState);
            
            // Update the visual state of the container
            if (window.ChatView && window.ChatView.updateState) {
              window.ChatView.updateState(chatContainer);
            }
          }
        });
        
        // Set up all event listeners
        window.ChatEvents.setupEventListeners(chatContainer);
        
      } catch (error) {
      }
    }
    
  })();