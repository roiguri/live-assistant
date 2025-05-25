// Chat UI Module - Progressive disclosure interface with 3 states
window.ChatUI = (function() {
    'use strict';
    
    // Chat states
    const STATES = {
      MINIMAL: 'minimal',     // Just input
      RECENT: 'recent',       // Input + last message
      FULL: 'full'           // Full chat history
    };
    
    let currentState = STATES.MINIMAL;
    let messages = [];
    
    function createChatContainer() {
      const container = document.createElement('div');
      container.id = 'ai-assistant-chat';
      container.setAttribute('data-state', currentState);
      container.innerHTML = getChatHTML();
      return container;
    }
    
    function getChatHTML() {
      return `
        <div class="ai-chat-main">
          <button class="ai-minimize-btn" title="Minimize chat" style="display: none;">
            <span>-</span>
          </button>
          <div class="ai-chat-menu">
            <button class="ai-menu-item" data-action="toggle-full" title="Toggle chat history">
              <span class="ai-menu-icon">💬</span>
            </button>
            <button class="ai-menu-item live-inactive" data-action="toggle-live" title="Start live share">
              <span class="ai-menu-icon">▶️</span>
            </button>
            <button class="ai-menu-item" data-action="clear-chat" title="Clear chat">
              <span class="ai-menu-icon">🗑️</span>
            </button>
          </div>

          <button class="ai-minimize-btn" title="Minimize chat" style="display: none;">
            <span>−</span>
          </button>
          
          <div class="ai-chat-messages" style="display: none;">
            <div class="ai-welcome-message">Hello! I'm your AI assistant.</div>
          </div>
          
          <div class="ai-chat-recent" style="display: none;">
            <!-- Last message will appear here -->
          </div>
          
          <div class="ai-chat-input-area">
            <input type="text" class="ai-chat-input" placeholder="Ask me anything...">
            <button class="ai-chat-send" title="Send message">
              <span>⮜</span>
            </button>
            <div class="ai-drag-handle" title="Drag to move">
              <span>⋮⋮</span>
            </div>
          </div>
        </div>
      `;
    }
    
    function setState(container, newState) {
      if (!STATES[newState.toUpperCase()]) return;
      
      currentState = newState;
      container.setAttribute('data-state', currentState);
      
      const messagesArea = container.querySelector('.ai-chat-messages');
      const recentArea = container.querySelector('.ai-chat-recent');
      const minimizeBtn = container.querySelector('.ai-minimize-btn');
      
      // Hide all areas first
      messagesArea.style.display = 'none';
      recentArea.style.display = 'none';
      minimizeBtn.style.display = 'none';
      
      // Show appropriate area based on state
      switch (currentState) {
        case STATES.MINIMAL:
          // Nothing extra to show
          break;
        case STATES.RECENT:
          recentArea.style.display = 'block';
          minimizeBtn.style.display = 'block';
          updateRecentArea(container);
          break;
        case STATES.FULL:
          messagesArea.style.display = 'block';
          minimizeBtn.style.display = 'block';
          break;
      }
      
      // Ensure chat stays within viewport bounds after state change
      ensureWithinViewport(container);
      
      // Update menu button text
      updateMenuText(container);
    }
    
    function ensureWithinViewport(container) {
      const rect = container.getBoundingClientRect();
      const maxY = window.innerHeight - rect.height;
      
      if (rect.top < 10) {
        container.style.top = '10px';
        container.style.bottom = 'auto';
      } else if (rect.bottom > window.innerHeight - 10) {
        container.style.top = Math.max(10, maxY - 10) + 'px';
        container.style.bottom = 'auto';
      }
    }
    
    function updateRecentArea(container) {
      const recentArea = container.querySelector('.ai-chat-recent');
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage && lastMessage.sender === 'ai') {
        recentArea.innerHTML = `
          <div class="ai-message ai-message-ai ai-recent-message">
            ${lastMessage.text}
          </div>
        `;
      } else {
        recentArea.innerHTML = '';
      }
    }
    
    function updateMenuText(container) {
      const menuItem = container.querySelector('[data-action="toggle-full"] .ai-menu-text');
      if (menuItem) {
        menuItem.textContent = currentState === STATES.FULL ? 'Minimize chat' : 'View all messages';
      }
    }
    
    function addMessage(container, text, sender = 'user') {
      // Store message
      messages.push({ text, sender, timestamp: Date.now() });
      
      // Add to full messages area
      const messagesArea = container.querySelector('.ai-chat-messages');
      const messageEl = document.createElement('div');
      messageEl.className = `ai-message ai-message-${sender}`;
      messageEl.textContent = text;
      messagesArea.appendChild(messageEl);
      messagesArea.scrollTop = messagesArea.scrollHeight;
      
      // Update state based on message
      if (sender === 'ai' && currentState === STATES.MINIMAL) {
        setState(container, STATES.RECENT);
      }
      
      // Update recent area if visible
      if (currentState === STATES.RECENT) {
        updateRecentArea(container);
      }
    }
    
    function clearInput(container) {
      const input = container.querySelector('.ai-chat-input');
      input.value = '';
    }
    
    function getInputValue(container) {
      const input = container.querySelector('.ai-chat-input');
      return input.value.trim();
    }
    
    function toggleFullChat(container) {
      const newState = currentState === STATES.FULL ? STATES.RECENT : STATES.FULL;
      setState(container, newState);
    }
    
    function clearChat(container) {
      messages = [];
      const messagesArea = container.querySelector('.ai-chat-messages');
      messagesArea.innerHTML = '<div class="ai-welcome-message">Hello! I\'m your AI assistant.</div>';
      setState(container, STATES.MINIMAL);
    }
    
    // Public API
    return {
      createChatContainer,
      addMessage,
      clearInput,
      getInputValue,
      toggleFullChat,
      clearChat,
      setState,
      STATES,
      getCurrentState: () => currentState
    };
    
  })();