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
      container.id = 'assistant-chat';
      container.setAttribute('data-state', currentState);
      container.innerHTML = getChatHTML();
      return container;
    }
    
    function getChatHTML() {
      return `
        <div class="chat-main">
          <button class="minimize-btn" title="Minimize chat" style="display: none;">
            <span>-</span>
          </button>
          <div class="chat-menu">
            <button class="menu-item" data-action="toggle-full" title="Toggle chat history">
              <span class="menu-icon">💬</span>
            </button>
            <button class="menu-item live-inactive" data-action="toggle-live" title="Start live share">
              <span class="menu-icon">▶️</span>
            </button>
            <button class="menu-item" data-action="clear-chat" title="Clear chat">
              <span class="menu-icon">🗑️</span>
            </button>
          </div>

          <div class="title-panel" style="display: none;">
            <span class="title-text">Live Assistant</span>
            <button class="minimize-btn" title="Minimize chat">
              <span>×</span>
            </button>
          </div>
          
          <div class="chat-messages" style="display: none;">
            <div class="welcome-message">Hello! I'm your AI assistant.</div>
          </div>
          
          <div class="chat-recent" style="display: none;">
            <!-- Last message will appear here -->
          </div>
          
          <div class="chat-input-area">
            <input type="text" class="chat-input" placeholder="Ask me anything...">
            <button class="chat-send" title="Send message">
              <span>⮜</span>
            </button>
            <div class="drag-handle" title="Drag to move">
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
      
      const messagesArea = container.querySelector('.chat-messages');
      const recentArea = container.querySelector('.chat-recent');
      const titlePanel = container.querySelector('.title-panel');
      
      // Hide all areas first
      messagesArea.style.display = 'none';
      recentArea.style.display = 'none';
      titlePanel.style.display = 'none';
      
      // Show appropriate area based on state
      switch (currentState) {
        case STATES.MINIMAL:
          // Nothing extra to show
          break;
        case STATES.RECENT:
          recentArea.style.display = 'block';
          titlePanel.style.display = 'flex';
          updateRecentArea(container);
          break;
        case STATES.FULL:
          messagesArea.style.display = 'block';
          titlePanel.style.display = 'flex';
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
      const recentArea = container.querySelector('.chat-recent');
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage && lastMessage.sender === 'ai') {
        recentArea.innerHTML = `
          <div class="message message-ai recent-message">
            ${lastMessage.text}
          </div>
        `;
      } else {
        recentArea.innerHTML = '';
      }
    }
    
    function updateMenuText(container) {
      const menuItem = container.querySelector('[data-action="toggle-full"] .menu-text');
      if (menuItem) {
        menuItem.textContent = currentState === STATES.FULL ? 'Minimize chat' : 'View all messages';
      }
    }
    
    function addMessage(container, text, sender = 'user') {
      // Store message
      messages.push({ text, sender, timestamp: Date.now() });
      
      // Add to full messages area
      const messagesArea = container.querySelector('.chat-messages');
      const messageEl = document.createElement('div');
      messageEl.className = `message message-${sender}`;
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
      const input = container.querySelector('.chat-input');
      input.value = '';
    }
    
    function getInputValue(container) {
      const input = container.querySelector('.chat-input');
      return input.value.trim();
    }
    
    function toggleFullChat(container) {
      const newState = currentState === STATES.FULL ? STATES.RECENT : STATES.FULL;
      setState(container, newState);
    }
    
    function clearChat(container) {
      messages = [];
      const messagesArea = container.querySelector('.chat-messages');
      messagesArea.innerHTML = '<div class="welcome-message">Hello! I\'m your AI assistant.</div>';
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