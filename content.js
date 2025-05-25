// Create floating box that appears on all websites
(function() {
    'use strict';
    
    // Prevent multiple injections if script runs twice
    if (window.aiAssistantInjected) return;
    window.aiAssistantInjected = true;
    
    // Create the floating box
    const floatingBox = document.createElement('div');
    floatingBox.id = 'ai-assistant-box';
    floatingBox.innerHTML = 'AI Assistant';
    
    // Style the box
    floatingBox.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 200px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 2147483647;
      cursor: pointer;
    `;
    
    // Add to page
    document.body.appendChild(floatingBox);
    
  })();