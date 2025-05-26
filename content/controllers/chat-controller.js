// Chat Controller - Coordinates message flow and AI responses
window.ChatController = (function() {
    'use strict';
    
    function sendMessage(container) {
      const message = window.ChatUI.getInputValue(container);
      
      if (!message) return;
      
      // Finalize any existing response and reset state
      finalizeCurrentResponse();
      
      // Add user message to UI
      window.ChatUI.addMessage(container, message, 'user');
      window.ChatUI.clearInput(container);
      
      // Send to background script → Gemini Live API
      console.log('ChatController: Sending message to background:', message);
      
      chrome.runtime.sendMessage({
        type: 'SEND_TEXT_MESSAGE',
        text: message
      }, (response) => {
        console.log('ChatController: Background response:', response);
        if (chrome.runtime.lastError) {
          console.error('ChatController: Runtime error:', chrome.runtime.lastError);
        }
      });
      
      // Show typing indicator
      MessageView.showTypingIndicator(container);
    }
    
    function receiveResponse(text, isComplete) {
      console.log('ChatController: AI Response:', text, 'Complete:', isComplete);
      
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
          console.warn('ChatController: Response timeout - auto-finalizing current response');
          finalizeCurrentResponse();
        }, 15000); // 15 second timeout
        ConnectionState.setResponseTimeout(timeoutId);
      }
    }
    
    function handleError(error) {
      console.error('ChatController: AI Error:', error);
      
      // Finalize any current response on error
      finalizeCurrentResponse();
      
      // Remove typing indicator if present
      const container = document.getElementById('assistant-chat');
      if (container) {
        if (ConnectionState.isTyping()) {
          MessageView.removeTypingIndicator(container, ConnectionState.getTypingId());
          ConnectionState.clearTyping();
        }
        
        window.ChatUI.addMessage(container, `Error: ${error}`, 'ai');
      }
    }
    
    function changeState(container, action) {
      switch (action) {
        case 'toggle-full':
          window.ChatUI.toggleFullChat(container);
          break;
        case 'clear-chat':
          if (confirm('Clear all messages?')) {
            window.ChatUI.clearChat(container);
          }
          break;
      }
    }
    
    function finalizeCurrentResponse() {
      const currentResponseElement = ConnectionState.getStreamingElement();
      if (currentResponseElement) {
        MessageView.finalizeStreamingMessage(currentResponseElement);
        console.log('ChatController: AI response finalized');
      }
      
      // Clear timeout
      ConnectionState.clearResponseTimeout();
    }
    
    // Public API
    return {
      sendMessage,
      receiveResponse,
      handleError,
      changeState
    };
    
  })();