// Chat Events Module - Pure event binding and coordination
window.ChatEvents = (function() {
  'use strict';
  
  function setupEventListeners(container) {
    MenuView.setupHoverBehavior(container);
    setupMenuActions(container);
    setupMessageEvents(container);
    setupMinimizeButton(container);
    MenuView.setupClickOutside(container);
    setupConnectionMonitoring(container);
    setupConnectionStateObservers(container);
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

    // Prevent event bubbling and capture for input events
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Block input if connection is lost
      if (ConnectionState.getInputBlocked()) {
        e.preventDefault();
        return false;
      }
    }, true); // Use capture phase
    
    input.addEventListener('keypress', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Block input if connection is lost
      if (ConnectionState.getInputBlocked()) {
        e.preventDefault();
        return false;
      }
      
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!ConnectionState.getInputBlocked()) {
          ChatController.sendMessage(container);
          updateSendButtonState(container);
        }
      }
    }, true); // Use capture phase
    
    input.addEventListener('keyup', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true); // Use capture phase
    
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      updateSendButtonState(container);
    }, true); // Use capture phase
    
    // Send button click
    sendBtn.addEventListener('click', () => {
      if (!ConnectionState.getInputBlocked()) {
        ChatController.sendMessage(container);
        updateSendButtonState(container);
      }
    });
    
    // Input focus effects
    input.addEventListener('focus', (e) => {
      e.stopPropagation();
      input.style.borderColor = '#007AFF';
      input.style.background = 'white';
    });
    
    input.addEventListener('blur', (e) => {
      e.stopPropagation();
      input.style.borderColor = '#e0e0e0';
      input.style.background = '#fafafa';
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
  
  
  function updateSendButtonState(container) {
    const input = container.querySelector('.chat-input');
    const sendBtn = container.querySelector('.chat-send');
    const hasText = input.value.trim().length > 0;
    const isBlocked = ConnectionState.getInputBlocked();
    
    // Disable button if no text OR if input is blocked due to connection issues
    sendBtn.disabled = !hasText || isBlocked;
    sendBtn.style.opacity = (hasText && !isBlocked) ? '1' : '0.6';
    
    // Update input field appearance based on connection status
    if (isBlocked) {
      input.disabled = true;
      const pendingMessages = ConnectionState.getPendingMessages();
      if (pendingMessages.length > 0) {
        input.placeholder = `${pendingMessages.length} message(s) queued - will send when connected`;
      } else {
        input.placeholder = 'Connection lost - reconnecting...';
      }
      input.style.backgroundColor = '#f5f5f5';
      input.style.color = '#999';
    } else {
      input.disabled = false;
      input.placeholder = 'Ask me anything...';
      input.style.backgroundColor = '';
      input.style.color = '';
    }
  }
  
  function updateInputWithQueuedMessage(container) {
    const input = container.querySelector('.chat-input');
    const isBlocked = ConnectionState.getInputBlocked();
    const pendingMessages = ConnectionState.getPendingMessages();
    
    if (isBlocked && pendingMessages.length > 0) {
      // Show queued message with visual indication
      showQueuedMessageInInput(input, pendingMessages[0]);
    } else if (!isBlocked) {
      // Clear queued message styling and potentially clear input
      clearQueuedMessageFromInput(input, pendingMessages.length === 0);
    }
  }
  
  function showQueuedMessageInInput(input, queuedMessage) {
    input.value = queuedMessage.text;
    input.style.fontStyle = 'italic';
    input.style.color = '#666';
  }
  
  function clearQueuedMessageFromInput(input, shouldClearInput) {
    input.style.fontStyle = '';
    input.style.color = '';
    
    // Only clear input if no pending messages and input has content
    if (shouldClearInput && input.value.trim()) {
      input.value = '';
    }
  }
  
  // Initialize message listener for responses from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {    
    const container = getContainerFromShadowDOM();
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
      case 'POSITION_UPDATE':
        handlePositionUpdate(container, message.position);
        sendResponse({ success: true });
        break;
    }
  });

  // Helper function to get container from shadow DOM
  function getContainerFromShadowDOM() {
    if (window.assistantShadowRoot) {
      return window.assistantShadowRoot.getElementById('assistant-chat');
    }
    return null;
  }

  function handleConnectionLost(container, canReconnect) {    
    // Update connection status UI
    if (window.ChatView && window.ChatView.updateConnectionStatus) {
      window.ChatView.updateConnectionStatus(container, 'failed', canReconnect);
    }
    
    // Add system message to chat
    window.ChatUI.addMessage(container, 'Connection lost. Please check your internet connection.', 'system');
    
    // Store system message in background for conversation history and cross-tab sync
    chrome.runtime.sendMessage({
      type: 'ADD_MESSAGE',
      text: 'Connection lost. Please check your internet connection.',
      sender: 'system'
    });
    
    if (canReconnect) {
      window.ChatUI.addMessage(container, 'Click "Reconnect" to try again.', 'system');
      
      // Store system message in background for conversation history and cross-tab sync
      chrome.runtime.sendMessage({
        type: 'ADD_MESSAGE',
        text: 'Click "Reconnect" to try again.',
        sender: 'system'
      });
    }
  }

  function updateConnectionUI(container, status) {
    // Update the connection state model
    ConnectionState.setConnectionStatus(status);
    
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

  function setupConnectionStateObservers(container) {
    // Observer for connection status changes
    ConnectionState.addObserver((type, data) => {
      if (type === 'connection-status-changed' || type === 'input-blocked-changed') {
        updateSendButtonState(container);
        updateInputWithQueuedMessage(container);
        
        // If connection is restored and we have pending messages, trigger retry
        if (type === 'connection-status-changed' && data.status === 'connected') {
          const pendingMessages = ConnectionState.getPendingMessages();
          if (pendingMessages.length > 0) {
            // Show notification
            window.ChatUI.addMessage(container, `Connection restored! Retrying ${pendingMessages.length} queued message(s)...`, 'system');
            
            // Clear the input before retrying (it will be repopulated after sending)
            const input = container.querySelector('.chat-input');
            if (input) {
              input.value = '';
            }
            
            // Trigger retry after a short delay
            setTimeout(() => {
              ChatController.retryPendingMessages();
            }, 1000);
          }
        }
      }
      
      if (type === 'pending-message-added') {
        // Show the queued message in input box when connection is lost
        updateInputWithQueuedMessage(container);
      }
      
      if (type === 'pending-messages-cleared') {
        // Clear input when messages are sent successfully
        const input = container.querySelector('.chat-input');
        if (input) {
          input.value = '';
          updateSendButtonState(container);
        }
      }
      
      if (type === 'pending-message-removed') {
        // Update input to show next queued message if any
        updateInputWithQueuedMessage(container);
      }
    });
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
  
  function handlePositionUpdate(container, position) {
    // Apply the new position class to the chat container
    applyPositionClass(container, position);
  }
  
  // Helper function to manage position classes
  function applyPositionClass(container, position) {
    if (!container) return;
    
    // Remove all existing position classes
    const positionClasses = [
      'position-bottom-right',
      'position-bottom-left', 
      'position-top-right',
      'position-top-left',
      'position-bottom-center',
      'position-top-center'
    ];
    
    positionClasses.forEach(cls => {
      container.classList.remove(cls);
    });
    
    // Apply the new position class
    const newClass = `position-${position}`;
    container.classList.add(newClass);
  }

  function updateChatDisplay(container, messages) {
    const messagesArea = container.querySelector('.chat-messages');
    
    // Clear existing messages except welcome
    messagesArea.innerHTML = '<div class="welcome-message">Hello! I\'m your AI assistant.</div>';
    
    // Add all messages
    messages.forEach(msg => {
      const messageEl = document.createElement('div');
      messageEl.className = `message message-${msg.sender}`;
      if (msg.sender === 'ai') {
        messageEl.innerHTML = marked.parse(msg.text);
      } else {
          messageEl.textContent = msg.text;
      }
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
    updateChatDisplay,
    applyPositionClass
  };
  
})();