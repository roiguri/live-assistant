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
        console.error('AI Assistant: Required modules not loaded');
        return;
      }
      
      try {
        // Create and inject the chat interface
        const chatContainer = window.ChatUI.createChatContainer();
        document.body.appendChild(chatContainer);
        
        // Set up all event listeners
        window.ChatEvents.setupEventListeners(chatContainer);
        
        console.log('AI Assistant: Chat interface initialized successfully');
        
      } catch (error) {
        console.error('AI Assistant: Failed to initialize chat interface', error);
      }
    }
    
  })();