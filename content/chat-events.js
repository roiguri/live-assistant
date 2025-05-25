// Chat Events Module - Handles all user interactions
window.ChatEvents = (function() {
    'use strict';
    
    function setupEventListeners(container) {
      setupToggleEvents(container);
      setupMessageEvents(container);
      setupDragEvents(container);
    }
    
    function setupToggleEvents(container) {
      const header = container.querySelector('.ai-chat-header');
      
      header.addEventListener('click', () => {
        const isExpanded = window.ChatUI.toggleChatVisibility(container);
        
        // Focus input when expanded
        if (isExpanded) {
          setTimeout(() => {
            const input = container.querySelector('.ai-chat-input');
            input.focus();
          }, 100);
        }
      });
    }
    
    function setupMessageEvents(container) {
      const input = container.querySelector('.ai-chat-input');
      const sendBtn = container.querySelector('.ai-chat-send');
      
      // Send button click
      sendBtn.addEventListener('click', () => {
        handleSendMessage(container);
      });
      
      // Enter key to send
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSendMessage(container);
        }
      });
      
      // Input focus styling
      input.addEventListener('focus', () => {
        input.style.borderColor = '#667eea';
      });
      
      input.addEventListener('blur', () => {
        input.style.borderColor = '#ddd';
      });
    }
    
    function setupDragEvents(container) {
      const header = container.querySelector('.ai-chat-header');
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };
      
      header.addEventListener('mousedown', (e) => {
        // Only start dragging if not clicking the toggle button
        if (e.target.classList.contains('ai-chat-toggle')) return;
        
        isDragging = true;
        const rect = container.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        
        // Change cursor
        document.body.style.cursor = 'grabbing';
        header.style.cursor = 'grabbing';
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        container.style.left = newX + 'px';
        container.style.top = newY + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
      });
      
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = '';
          header.style.cursor = 'pointer';
        }
      });
    }
    
    function handleSendMessage(container) {
      const message = window.ChatUI.getInputValue(container);
      
      if (!message) return;
      
      // Add user message
      window.ChatUI.addMessage(container, message, 'user');
      window.ChatUI.clearInput(container);
      
      // Simulate AI response (placeholder for now)
      setTimeout(() => {
        window.ChatUI.addMessage(container, 'AI response will appear here once connected to Gemini.', 'ai');
      }, 500);
    }
    
    // Public API
    return {
      setupEventListeners
    };
    
  })();