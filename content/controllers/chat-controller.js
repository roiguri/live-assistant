// Chat Controller - Coordinates message flow and AI responses
window.ChatController = (function() {
    'use strict';
    
    function sendMessage(container) {
      const message = window.ChatUI.getInputValue(container);
      
      if (!message) return;
      
      // Check if connection is available
      if (ConnectionState.getInputBlocked()) {
        // Queue the message for later retry
        ConnectionState.addPendingMessage(message);
        window.ChatUI.clearInput(container);
        
        // Show user feedback
        window.ChatUI.addMessage(container, 'Message queued - will send when connection is restored', 'system');
        return;
      }
      
      // Finalize any existing response and reset state
      finalizeCurrentResponse();
      
      // Add user message to UI immediately
      window.ChatUI.addMessage(container, message, 'user');
      window.ChatUI.clearInput(container);
      
      // Send to AI for processing and response generation
      // This triggers the actual AI communication through Gemini Live API
      chrome.runtime.sendMessage({
        type: 'SEND_TEXT_MESSAGE',
        text: message
      }, (response) => {
        // Handle send failure/success
        if (chrome.runtime.lastError || (response && !response.success)) {
          // Remove the message from UI if send failed
          removeLastUserMessage(container);
          
          // Queue the message for retry
          ConnectionState.addPendingMessage(message);
          
          // Show system message based on error type
          let systemMessage = 'Message queued - will send when connection is restored';
          if (response && response.error) {
            if (response.error.includes('internet') || response.error.includes('network')) {
              systemMessage = 'No internet connection - message queued for when connection returns';
            } else if (response.error.includes('timeout')) {
              systemMessage = 'Connection timeout - message queued for retry';
            }
          }
          window.ChatUI.addMessage(container, systemMessage, 'system');
        } else if (response && response.success) {
          // Only store the message in conversation history if it was sent successfully
          chrome.runtime.sendMessage({
            type: 'ADD_MESSAGE',
            text: message,
            sender: 'user'
          });
          
          // Show typing indicator only if message was sent successfully
          MessageView.showTypingIndicator(container);
        }
      });
    }
    
    function receiveResponse(text, isComplete) {
      const container = getContainerFromShadowDOM();
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
      const container = getContainerFromShadowDOM();
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
          if (confirm('Start a new chat? (Previous chat won\'t be saved)')) {
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
    
    // Helper function to get container from shadow DOM
    function getContainerFromShadowDOM() {
      if (window.assistantShadowRoot) {
        return window.assistantShadowRoot.getElementById('assistant-chat');
      }
      return null;
    }
    
    // Helper function to remove the last user message from UI
    function removeLastUserMessage(container) {
      // Remove from UI
      const messagesArea = container.querySelector('.chat-messages');
      if (messagesArea) {
        const messages = messagesArea.querySelectorAll('.message-user');
        if (messages.length > 0) {
          const lastUserMessage = messages[messages.length - 1];
          lastUserMessage.remove();
        }
      }
      
      // Also remove from recent area if visible
      if (ChatState.isRecentState()) {
        ChatView.updateRecentArea(container);
      }
    }
    
    // Function to retry pending messages when connection is restored
    function retryPendingMessages() {
      const container = getContainerFromShadowDOM();
      if (!container) return;
      
      const pendingMessages = ConnectionState.getPendingMessages();
      if (pendingMessages.length === 0) return;
      
      // Clear all pending messages and try to send them
      ConnectionState.clearPendingMessages();
      
      // Send each pending message directly (without using input field)
      pendingMessages.forEach((pendingMessage, index) => {
        setTimeout(() => {
          sendMessageDirectly(container, pendingMessage.text);
        }, index * 100); // Small delay between messages to avoid overwhelming
      });
    }
    
    // Helper function to send a message directly without using the input field
    function sendMessageDirectly(container, messageText) {
      // Finalize any existing response and reset state
      finalizeCurrentResponse();
      
      // Add user message to UI immediately
      window.ChatUI.addMessage(container, messageText, 'user');
      
      // Send to AI for processing and response generation
      chrome.runtime.sendMessage({
        type: 'SEND_TEXT_MESSAGE',
        text: messageText
      }, (response) => {
        // Handle send failure/success
        if (chrome.runtime.lastError || (response && !response.success)) {
          // Remove the message from UI if send failed
          removeLastUserMessage(container);
          
          // Queue the message for retry again
          ConnectionState.addPendingMessage(messageText);
          
          // Show system message
          window.ChatUI.addMessage(container, 'Connection unstable - message re-queued for retry', 'system');
        } else if (response && response.success) {
          // Only store the message in conversation history if it was sent successfully
          chrome.runtime.sendMessage({
            type: 'ADD_MESSAGE',
            text: messageText,
            sender: 'user'
          });
          
          // Show typing indicator only if message was sent successfully
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
      takeScreenshot,
      retryPendingMessages
    };
    
})();