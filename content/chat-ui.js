// Chat UI Module - Handles HTML structure creation
window.ChatUI = (function() {
    'use strict';
    
    function createChatContainer() {
      const container = document.createElement('div');
      container.id = 'ai-assistant-chat';
      container.innerHTML = getChatHTML();
      return container;
    }
    
    function getChatHTML() {
      return `
        <div class="ai-chat-header">
          <span class="ai-chat-title">Live Assistant</span>
          <button class="ai-chat-toggle">+</button>
        </div>
        <div class="ai-chat-body" style="display: none;">
          <div class="ai-chat-messages">
            <div class="ai-welcome-message">Hello! I'm your Live Assistant. Chat interface ready!</div>
          </div>
          <div class="ai-chat-input-area">
            <input type="text" class="ai-chat-input" placeholder="Type your message...">
            <button class="ai-chat-send">Send</button>
          </div>
        </div>
      `;
    }
    
    function addMessage(container, text, sender = 'user') {
      const messagesArea = container.querySelector('.ai-chat-messages');
      const messageEl = document.createElement('div');
      messageEl.className = `ai-message ai-message-${sender}`;
      messageEl.textContent = text;
      messagesArea.appendChild(messageEl);
      
      // Scroll to bottom
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
    
    function clearInput(container) {
      const input = container.querySelector('.ai-chat-input');
      input.value = '';
    }
    
    function getInputValue(container) {
      const input = container.querySelector('.ai-chat-input');
      return input.value.trim();
    }
    
    function toggleChatVisibility(container) {
      const body = container.querySelector('.ai-chat-body');
      const toggle = container.querySelector('.ai-chat-toggle');
      
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'flex' : 'none';
      toggle.textContent = isHidden ? '−' : '+';
      
      return !isHidden; // Return true if now expanded
    }
    
    // Public API
    return {
      createChatContainer,
      addMessage,
      clearInput,
      getInputValue,
      toggleChatVisibility
    };
    
  })();