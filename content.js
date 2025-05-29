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
        
        // Set up all event listeners
        window.ChatEvents.setupEventListeners(chatContainer);
        
      } catch (error) {
      }
    }
    
  })();