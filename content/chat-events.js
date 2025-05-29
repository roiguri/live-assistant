// Chat Events Module - Pure event binding and coordination
window.ChatEvents = (function() {
  'use strict';
  
  function setupEventListeners(container) {
    MenuView.setupHoverBehavior(container);
    setupMenuActions(container);
    setupMessageEvents(container);
    setupMinimizeButton(container);
    setupDragEvents(container);
    MenuView.setupClickOutside(container);
    setupConnectionMonitoring(container);
  }
  
  function setupMenuActions(container) {
    const menuItems = container.querySelectorAll('.menu-item');
    
    // Menu item clicks
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        handleMenuAction(container, action);
        MenuView.forceHideMenu(container);
      });
    });
  }
  
  function setupMessageEvents(container) {
    const input = container.querySelector('.chat-input');
    const sendBtn = container.querySelector('.chat-send');
    
    // Send button click
    sendBtn.addEventListener('click', () => {
      ChatController.sendMessage(container);
      updateSendButtonState(container);
    });
    
    // Enter key to send
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ChatController.sendMessage(container);
        updateSendButtonState(container);
      }
    });
    
    // Input focus effects
    input.addEventListener('focus', () => {
      input.style.borderColor = '#007AFF';
      input.style.background = 'white';
    });
    
    input.addEventListener('blur', () => {
      input.style.borderColor = '#e0e0e0';
      input.style.background = '#fafafa';
    });
    
    // Auto-resize input area based on content
    input.addEventListener('input', () => {
      updateSendButtonState(container);
    });
    
    // Initial button state
    updateSendButtonState(container);
  }
  
  function handleMenuAction(container, action) {
    if (action === 'take-screenshot') {
      ChatController.takeScreenshot(container);
    } else {
      ChatController.changeState(container, action);
    }
  }
  
  function setupMinimizeButton(container) {
    const minimizeBtn = container.querySelector('.title-panel .minimize-btn');
    
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.ChatUI.setState(container, window.ChatUI.STATES.MINIMAL);
        });
    }
  }
  
  function setupDragEvents(container) {
    const dragHandle = container.querySelector('.drag-handle');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    // Start drag on drag handle mousedown
    dragHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      
      const rect = container.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      
      // Visual feedback
      document.body.style.cursor = 'grabbing';
      dragHandle.style.opacity = '0.8';
      dragHandle.style.transform = 'scale(1.1)';
      
      // Hide menu during drag
      MenuView.updateMenuForDrag(container, true);
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    });
    
    // Handle drag movement
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const containerRect = container.getBoundingClientRect();
      const maxX = window.innerWidth - containerRect.width;
      const maxY = window.innerHeight - containerRect.height;
      
      newX = Math.max(10, Math.min(newX, maxX - 10));
      newY = Math.max(10, Math.min(newY, maxY - 10));
      
      container.style.left = newX + 'px';
      container.style.top = newY + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    });
    
    // End drag on mouseup OR mouseleave
    function endDrag() {
      if (isDragging) {
        isDragging = false;
        
        // Reset visual feedback
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const dragHandle = container.querySelector('.drag-handle');
        if (dragHandle) {
          dragHandle.style.opacity = '';
          dragHandle.style.transform = '';
        }
      }
    }
    
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);
    
    // Hover effects for drag handle
    dragHandle.addEventListener('mouseenter', () => {
      if (!isDragging) {
        dragHandle.style.opacity = '1';
        dragHandle.style.transform = 'scale(1.05)';
      }
    });
    
    dragHandle.addEventListener('mouseleave', () => {
      if (!isDragging) {
        dragHandle.style.opacity = '';
        dragHandle.style.transform = '';
      }
    });
  }
  
  function updateSendButtonState(container) {
    const input = container.querySelector('.chat-input');
    const sendBtn = container.querySelector('.chat-send');
    const hasText = input.value.trim().length > 0;
    
    sendBtn.disabled = !hasText;
    sendBtn.style.opacity = hasText ? '1' : '0.6';
  }
  
  // Initialize message listener for responses from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {    
    const container = document.getElementById('assistant-chat');
    if (!container) {
      sendResponse({ success: false, error: 'Chat container not found' });
      return;
    }

    switch (message.type) {
      case 'AI_RESPONSE':
        ChatController.receiveResponse(message.text, message.isComplete);
        sendResponse({ success: true });
        break;
      case 'AI_ERROR':
        ChatController.handleError(message.error);
        sendResponse({ success: true });
        break;
      case 'CONNECTION_LOST':
        handleConnectionLost(container, message.canReconnect);
        sendResponse({ success: true });
        break;
        
      case 'CONNECTION_STATUS':
        updateConnectionUI(container, message.status);
        sendResponse({ success: true });
        break;
      case 'TOGGLE_CHAT_VISIBILITY':
        handleChatVisibilityToggle(container, message.visible);
        sendResponse({ success: true });
        break;
      case 'FOCUS_CHAT_INPUT':
        focusChatInput(container);
        sendResponse({ success: true });
        break;
      case 'KEYBOARD_SCREENSHOT':
        handleKeyboardScreenshot(container);
        sendResponse({ success: true });
        break;
      case 'CONVERSATION_UPDATE':
        handleConversationUpdate(container, message.messages);
        sendResponse({ success: true });
        break;
      case 'UI_STATE_UPDATE':
        handleUIStateUpdate(container, message.uiState);
        sendResponse({ success: true });
        break;
    }
  });

  function handleConnectionLost(container, canReconnect) {    
    // Update connection status UI
    if (window.ChatView && window.ChatView.updateConnectionStatus) {
      window.ChatView.updateConnectionStatus(container, 'failed', canReconnect);
    }
    
    // Add system message to chat
    window.ChatUI.addMessage(container, 'Connection lost. Please check your internet connection.', 'system');
    
    if (canReconnect) {
      window.ChatUI.addMessage(container, 'Click "Reconnect" to try again.', 'system');
    }
  }

  function updateConnectionUI(container, status) {
    if (window.ChatView && window.ChatView.updateConnectionStatus) {
      window.ChatView.updateConnectionStatus(container, status, status === 'failed' || status === 'disconnected');
    }
  }

  function setupConnectionMonitoring(container) {
    // Check connection status every 10 seconds
    setInterval(() => {
      chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        
        if (response && response.websocket) {
          updateConnectionUI(container, response.websocket);
        }
      });
    }, 10000);
    
    // Initial connection status check
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
        if (response && response.websocket) {
          updateConnectionUI(container, response.websocket);
        }
      });
    }, 1000);
  }
  
  function handleChatVisibilityToggle(container, visible) {   
    if (visible) {
      container.style.display = 'block';
      chrome.storage.local.set({ chatVisible: true });

      setTimeout(() => {
        const input = container.querySelector('.chat-input');
        if (input) {
          input.focus();
        }
      }, 100);
    } else {
      container.style.display = 'none';
      chrome.storage.local.set({ chatVisible: false });
    }
  }

  function focusChatInput(container) {  
    const input = container.querySelector('.chat-input');
    if (input) {
      input.focus();
      input.select(); // Optionally select any existing text
    }
  }

  function handleKeyboardScreenshot(container) {   
    // Ensure chat is visible
    if (container.style.display === 'none') {
      container.style.display = 'block';
    }
    
    // Take screenshot using existing function
    ChatController.takeScreenshot(container);
    
    // Focus input after screenshot for immediate interaction
    setTimeout(() => {
      const input = container.querySelector('.chat-input');
      if (input) {
        input.focus();
      }
    }, 300);
  }
  
  function handleConversationUpdate(container, messages) {
    // Update ChatState
    window.ChatState.setMessages(messages);
    
    // Update display
    updateChatDisplay(container, messages);
  }

  function handleUIStateUpdate(container, uiState) {
    // Update ChatState without triggering background sync (avoid infinite loop)
    window.ChatState.setStateFromSync(uiState);
    
    // Update the visual state of the container
    if (window.ChatView && window.ChatView.updateState) {
      window.ChatView.updateState(container);
    }
  }

  function updateChatDisplay(container, messages) {
    const messagesArea = container.querySelector('.chat-messages');
    
    // Clear existing messages except welcome
    messagesArea.innerHTML = '<div class="welcome-message">Hello! I\'m your AI assistant.</div>';
    
    // Add all messages
    messages.forEach(msg => {
      const messageEl = document.createElement('div');
      messageEl.className = `message message-${msg.sender}`;
      messageEl.textContent = msg.text;
      messagesArea.appendChild(messageEl);
    });
    
    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    // Update recent area if needed
    if (window.ChatState.isRecentState()) {
      if (window.ChatView && window.ChatView.updateRecentArea) {
        window.ChatView.updateRecentArea(container);
      }
    }
  }
  
  // Public API
  return {
    setupEventListeners,
    updateChatDisplay
  };
  
})();