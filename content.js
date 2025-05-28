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
        
        // Set up all event listeners
        window.ChatEvents.setupEventListeners(chatContainer);
        
      } catch (error) {
      }
    }
    
  })();