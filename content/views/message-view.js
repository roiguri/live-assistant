// Message View Layer - Message display, typing indicators, and streaming animations
window.MessageView = (function() {
    'use strict';
    
    function showTypingIndicator(container) {
        const typingId = 'typing-' + Date.now();
        ConnectionState.setTyping(typingId);
        
        const messagesArea = container.querySelector('.chat-messages');
        const typingMessage = document.createElement('div');
        typingMessage.className = 'message message-ai typing';
        typingMessage.setAttribute('data-message-id', typingId);
        typingMessage.textContent = 'AI is thinking...';
        messagesArea.appendChild(typingMessage);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        
        // Remove typing indicator after timeout (fallback)
        setTimeout(() => {
            removeTypingIndicator(container, typingId);
        }, 10000); // 10 second timeout
        
        return typingId;
    }
    
    function removeTypingIndicator(container, typingId) {
        const typingMessage = container.querySelector(`[data-message-id="${typingId}"]`);
        if (typingMessage) {
            typingMessage.remove();
        }
    }
    
    function startStreamingMessage(container, text) {
        // Create new AI message for streaming
        window.ChatUI.addMessage(container, text, 'ai');
        const responseElement = container.querySelector('.message-ai:last-child');
        
        // Set up streaming state
        ConnectionState.setStreaming(true, responseElement);
        responseElement.classList.add('streaming');
        
        return responseElement;
    }
    
    function updateStreamingMessage(responseElement, newText) {
        if (!responseElement) return;
        
        // Store complete accumulated text as raw markdown
        responseElement.setAttribute('data-raw-text', newText);
        
        // During streaming: show raw text to avoid broken parsing
        responseElement.textContent = newText;  
      
        // Auto-scroll to bottom
        const messagesArea = responseElement.closest('.chat-messages');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
    
    function finalizeStreamingMessage(responseElement) {
        if (responseElement) {
            const completeText = responseElement.getAttribute('data-raw-text') || responseElement.textContent;
            responseElement.innerHTML = marked.parse(completeText);

            responseElement.classList.remove('streaming');
            responseElement.removeAttribute('data-raw-text');
        }
        ConnectionState.setStreaming(false);
    }
    
    function updateRecentMessage(container, text) {
        // Update recent area if in recent state
        if (container.getAttribute('data-state') === 'recent') {
            const recentArea = container.querySelector('.chat-recent .recent-message');
            if (recentArea) {
                recentArea.innerHTML = marked.parse(text);
            }
        }
    }
    
    function scrollToBottom(container) {
        const messagesArea = container.querySelector('.chat-messages');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
    
    function getLastMessageElement(container) {
        return container.querySelector('.message-ai:last-child');
    }
    
    function addMessageClass(element, className) {
        if (element) {
            element.classList.add(className);
        }
    }
    
    function removeMessageClass(element, className) {
        if (element) {
            element.classList.remove(className);
        }
    }
    
    function hasMessageClass(element, className) {
        return element ? element.classList.contains(className) : false;
    }
    
    // Public API - Pure message display functions
    return {
        showTypingIndicator,
        removeTypingIndicator,
        startStreamingMessage,
        updateStreamingMessage,
        finalizeStreamingMessage,
        updateRecentMessage,
        scrollToBottom,
        getLastMessageElement,
        addMessageClass,
        removeMessageClass,
        hasMessageClass
    };
    
})(); 