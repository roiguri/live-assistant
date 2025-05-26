// Chat Events Module - Handles all user interactions for progressive interface
window.ChatEvents = (function() {
  'use strict';
  
  function setupEventListeners(container) {
    MenuView.setupHoverBehavior(container);
    setupMenuActions(container);
    setupMessageEvents(container);
    setupMinimizeButton(container);
    setupDragEvents(container);
    MenuView.setupClickOutside(container);
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
      handleSendMessage(container);
    });
    
    // Enter key to send
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(container);
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
  

  
  function handleMenuAction(container, action) {
    switch (action) {
      case 'toggle-full':
        window.ChatUI.toggleFullChat(container);
        break;
      case 'toggle-live':
        handleLiveShare(container);
        break;
      case 'clear-chat':
        if (confirm('Clear all messages?')) {
          window.ChatUI.clearChat(container);
        }
        break;
    }
  }
  
  async function handleLiveShare(container) {
    const isActive = MenuView.getLiveShareState(container);
    
    if (isActive) {
      // Stop live share
      window.ScreenCapture.stopScreenShare();
      chrome.runtime.sendMessage({ type: 'STOP_VIDEO_STREAM' });
      
      MenuView.updateLiveShareState(container, false);
      window.ChatUI.addMessage(container, 'Screen sharing stopped.', 'ai');
    } else {
      // Start live share
      window.ChatUI.addMessage(container, 'Requesting screen share permission...', 'ai');
      
      const result = await window.ScreenCapture.startScreenShare();
      
      if (result.success) {
        // Start video streaming to Gemini
        chrome.runtime.sendMessage({ type: 'START_VIDEO_STREAM' });
        
        MenuView.updateLiveShareState(container, true);
        
        const stats = window.ScreenCapture.getStats();
        const message = `Screen sharing started! Capturing ${stats.width}x${stats.height} at ${stats.frameRate}fps`;
        window.ChatUI.addMessage(container, message, 'ai');
      } else {
        window.ChatUI.addMessage(container, `Failed to start screen sharing: ${result.error}`, 'ai');
      }
    }
  }

  function onScreenShareEnded() {
    const container = document.getElementById('assistant-chat');
    if (container) {
      if (MenuView.getLiveShareState(container)) {
        // Reset UI when user stops sharing via browser (not our button)
        MenuView.updateLiveShareState(container, false);
        window.ChatUI.addMessage(container, 'Screen sharing ended.', 'ai');
        
        // Stop video streaming to Gemini
        chrome.runtime.sendMessage({ type: 'STOP_VIDEO_STREAM' });
      }
    }
  }
  
  function handleSendMessage(container) {
    const message = window.ChatUI.getInputValue(container);
    
    if (!message) return;
    
    // Finalize any existing response and reset state
    finalizeCurrentResponse();
    
    // Add user message to UI
    window.ChatUI.addMessage(container, message, 'user');
    window.ChatUI.clearInput(container);
    updateSendButtonState(container);
    
    // Send to background script → Gemini Live API
    console.log('Content Script: Sending message to background:', message);
    
    chrome.runtime.sendMessage({
      type: 'SEND_TEXT_MESSAGE',
      text: message
    }, (response) => {
      console.log('Content Script: Background response:', response);
      if (chrome.runtime.lastError) {
        console.error('Content Script: Runtime error:', chrome.runtime.lastError);
      }
    });
    
    // Show typing indicator
    MessageView.showTypingIndicator(container);
  }
  

  
  function updateSendButtonState(container) {
    const input = container.querySelector('.chat-input');
    const sendBtn = container.querySelector('.chat-send');
    const hasText = input.value.trim().length > 0;
    
    sendBtn.disabled = !hasText;
    sendBtn.style.opacity = hasText ? '1' : '0.6';
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
  
  // Initialize message listener for responses from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content Script: Received message from background:', message.type);
    
    switch (message.type) {
      case 'AI_RESPONSE':
        handleAIResponse(message.text, message.isComplete);
        sendResponse({ success: true });
        break;
      case 'AI_ERROR':
        handleAIError(message.error);
        sendResponse({ success: true });
        break;
    }
  });
  
  function handleAIResponse(text, isComplete) {
    console.log('Content Script: AI Response:', text, 'Complete:', isComplete);
    
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
        console.warn('Content Script: Response timeout - auto-finalizing current response');
        finalizeCurrentResponse();
      }, 15000); // 15 second timeout
      ConnectionState.setResponseTimeout(timeoutId);
    }
  }
  
  function finalizeCurrentResponse() {
    const currentResponseElement = ConnectionState.getStreamingElement();
    if (currentResponseElement) {
      MessageView.finalizeStreamingMessage(currentResponseElement);
      console.log('Content Script: AI response finalized');
    }
    
    // Clear timeout
    ConnectionState.clearResponseTimeout();
  }
  
  function handleAIError(error) {
    console.error('Content Script: AI Error:', error);
    
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

  // Public API
  return {
    setupEventListeners,
    onScreenShareEnded
  };
  
})();