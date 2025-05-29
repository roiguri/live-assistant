// Chat Controller - Coordinates message flow and AI responses
window.ChatController = (function() {
    'use strict';
    
    function sendMessage(container) {
      const message = window.ChatUI.getInputValue(container);
      
      if (!message) return;
      
      // Finalize any existing response and reset state
      finalizeCurrentResponse();
      
      // Add user message to UI immediately
      window.ChatUI.addMessage(container, message, 'user');
      window.ChatUI.clearInput(container);
      
      // Store user message in background for conversation history and cross-tab sync
      // This saves the message to persistent storage and enables shared mode
      chrome.runtime.sendMessage({
        type: 'ADD_MESSAGE',
        text: message,
        sender: 'user'
      });
      
      // Send to AI for processing and response generation
      // This triggers the actual AI communication through Gemini Live API
      chrome.runtime.sendMessage({
        type: 'SEND_TEXT_MESSAGE',
        text: message
      })
      
      // Show typing indicator
      MessageView.showTypingIndicator(container);
    }
    
    function receiveResponse(text, isComplete) {
      const container = document.getElementById('assistant-chat');
      if (!container) return;
      
      // Remove typing indicator on first chunk
      if (ConnectionState.isTyping()) {
        MessageView.removeTypingIndicator(container, ConnectionState.getTypingId());
        ConnectionState.clearTyping();
      }
      
      // Clear any existing response timeout
      ConnectionState.clearResponseTimeout();
      
      // If no current response element, create a new AI message
      if (!ConnectionState.getStreamingElement()) {
        if (isComplete) {
          // Complete message, add directly
          window.ChatUI.addMessage(container, text, 'ai');
        } else {
          // Start streaming message
          MessageView.startStreamingMessage(container, text);
        }
      } else {
        // Update existing response element (for streaming)
        const currentResponseElement = ConnectionState.getStreamingElement();
        const currentText = currentResponseElement.textContent + text;
        MessageView.updateStreamingMessage(currentResponseElement, currentText);
        
        // Update recent area if in recent state
        MessageView.updateRecentMessage(container, currentText);
      }
      
      // If turn is complete, finalize and reset
      if (isComplete) {
        finalizeCurrentResponse();
      } else {
        // Set a timeout to auto-finalize if no completion signal arrives
        const timeoutId = setTimeout(() => {
          finalizeCurrentResponse();
        }, 15000); // 15 second timeout
        ConnectionState.setResponseTimeout(timeoutId);
      }
    }
    
    function handleError(error) {
      // Finalize any current response on error
      finalizeCurrentResponse();
      
      // Remove typing indicator if present
      const container = document.getElementById('assistant-chat');
      if (container) {
        if (ConnectionState.isTyping()) {
          MessageView.removeTypingIndicator(container, ConnectionState.getTypingId());
          ConnectionState.clearTyping();
        }
        
        // Show user-friendly error message
        const displayError = error.startsWith('Error:') ? error : `Error: ${error}`;
        window.ChatUI.addMessage(container, displayError, 'ai');
      }
    }
    
    function changeState(container, action) {
      switch (action) {
        case 'toggle-full':
          window.ChatUI.toggleFullChat(container);
          break;
        case 'clear-chat':
          if (confirm('Clear all messages?')) {
            // Clear conversation via background to sync across all tabs
            chrome.runtime.sendMessage({
              type: 'CLEAR_CONVERSATION'
            });
          }
          break;
      }
    }
    
    function finalizeCurrentResponse() {
      const currentResponseElement = ConnectionState.getStreamingElement();
      if (currentResponseElement) {
        // Finalize the streaming message in the UI
        MessageView.finalizeStreamingMessage(currentResponseElement);
      }
      
      // Clear timeout
      ConnectionState.clearResponseTimeout();
    }

    function takeScreenshot(container) {
      // Add system message immediately
      window.ChatUI.addMessage(container, 'Screenshot sent', 'system');
      
      // Store system message in background for conversation history and cross-tab sync
      chrome.runtime.sendMessage({
        type: 'ADD_MESSAGE',
        text: 'Screenshot sent',
        sender: 'system'
      });
      
      // Send screenshot request to background script
      chrome.runtime.sendMessage({
        type: 'TAKE_SCREENSHOT'
      }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          window.ChatUI.addMessage(container, 'Screenshot failed', 'system');
          
          // Store error message in background for conversation history and cross-tab sync
          chrome.runtime.sendMessage({
            type: 'ADD_MESSAGE',
            text: 'Screenshot failed',
            sender: 'system'
          });
        } else {
          // Show typing indicator for AI response
          MessageView.showTypingIndicator(container);
        }
      });
    }
    
    // Public API
    return {
      sendMessage,
      receiveResponse,
      handleError,
      changeState,
      takeScreenshot
    };
    
  })();