// Shadow DOM Styles Module - Encapsulated CSS for Live Assistant
window.ShadowStyles = (function() {
    'use strict';
    
    function getCSSContent() {
        return `
/* AI Assistant - Compact Progressive Interface - Shadow DOM Encapsulated */

#assistant-chat {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 280px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
  font-size: 14px;
  overflow: hidden;
  transition: all 0.3s ease;
}

p {
  margin: 0;
}

/* State-based sizing */
#assistant-chat[data-state="minimal"] {
  height: auto;
}

#assistant-chat[data-state="recent"] {
  height: auto;
}

#assistant-chat[data-state="full"] {
  height: 350px;
  display: flex;
  flex-direction: column;
}

#assistant-chat[data-state="full"] .chat-messages {
  padding: 12px;
  padding-top: 12px;
  direction: ltr;
  text-align: left;
}

#assistant-chat[data-state="recent"] .chat-recent {
  padding: 8px 12px 6px;
  padding-top: 8px;
  overflow-y: auto;
  max-height: 350px;
  direction: ltr;
  text-align: left;
}

/* Main container */
.chat-main {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100%;
  direction: rtl;
}

/* Context Menu - Horizontal */
.chat-menu {
  position: fixed;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  padding: 6px;
  display: flex;
  flex-direction: row;
  gap: 2px;
  z-index: 2147483648;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.2s ease;
  pointer-events: none;
}

.chat-menu.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: all;
}

.menu-item {
  border: none;
  background: none;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
  border-radius: 12px;
  padding: 6px;
  font-size: 14px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-item:hover {
  background: #f0f0f0;
  color: #333;
  transform: scale(1.1);
}

.menu-icon {
  font-size: 12px;
}

/* Title Panel */
.title-panel {
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 12px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  direction: ltr;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  user-select: none;
}

.connection-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: #ffc107;
  animation: pulse 1.5s ease-in-out infinite alternate;
}

.connection-dot.connected {
  background-color: #28a745; /* Green */
}
.connection-dot.connecting {
  background-color: #ffc107; /* Yellow */
  animation: pulse 1.5s ease-in-out infinite alternate;
}
.connection-dot.failed {
  background-color: #dc3545; /* Red */
  animation: flash 1s ease-in-out infinite alternate;
}

.refresh-btn {
  background: none;
  color: #666;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: normal;
  transition: all 0.2s;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
}

.refresh-btn:disabled {
    color: #ccc;
    cursor: not-allowed;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.refresh-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

.minimize-btn {
  background: none;
  color: #666;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 300;
  transition: all 0.2s;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  padding-right: 2px;
  border-radius: 50%;
}

.minimize-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

.minimize-btn span {
  line-height: 1;
  font-size: 18px;
}

/* Messages Area (Full State) */
.chat-messages {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  background: #fafafa;
  max-height: 350px;
  min-height: 0;
}

.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

/* Recent Message Area (Recent State) */
.chat-recent {
  padding: 8px 12px 6px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.recent-message {
  margin: 0 !important;
}

/* Messages */
.message {
  margin: 6px 0;
  padding: 8px 12px;
  border-radius: 14px;
  max-width: 85%;
  min-width: 40px;
  width: fit-content;
  word-wrap: break-word;
  line-height: 1.3;
  font-size: 13px;
}

.message-user {
  background: #007AFF;
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.message-ai {
  background: #f0f0f0;
  color: #333;
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.message-system {
  text-align: center;
  color: #888;
  font-size: 0.9em;
  font-style: italic;
  margin: 8px 0;
  padding: 4px 8px;
  background: transparent;
  width: auto;
}

.welcome-message {
  background: #e3f2fd;
  color: #1976d2;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  text-align: center;
  margin: 6px 0;
}

/* Input Area - Always at bottom */
.chat-input-area {
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  border-top: 1px solid #f0f0f0;
  position: relative;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  outline: none;
  font-size: 13px;
  background: #fafafa;
  transition: all 0.2s;
  direction: ltr;
  text-align: left;
}

.chat-input:focus {
  border-color: #007AFF;
  background: white;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.chat-send {
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.chat-send:hover {
  background: #0056b3;
  transform: scale(1.05);
}

.chat-send:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

/* Drag Handle */
.drag-handle {
  background: #f5f5f5;
  color: #999;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  cursor: grab;
  font-size: 12px;
  transition: all 0.2s ease;
  width: 24px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  opacity: 0.7;
}

.drag-handle:hover {
  background: #eeeeee;
  color: #666;
  border-color: #d0d0d0;
  opacity: 1;
  transform: scale(1.05);
}

.drag-handle:active {
  cursor: grabbing;
  background: #e0e0e0;
  transform: scale(1.1);
}

.drag-handle span {
  line-height: 0.8;
  font-weight: bold;
  letter-spacing: -1px;
}

@keyframes pulse {
  from { opacity: 1; }
  to { opacity: 0.5; }
}

@keyframes flash {
  from { opacity: 1; }
  to { opacity: 0.3; }
}

/* Markdown formatting styles */
.message-ai code {
  background: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

.message-ai pre {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-ai pre code {
  background: none;
  padding: 0;
}

.message-ai ul, .message-ai ol {
  margin: 8px 0;
  padding-left: 20px;
}

.message-ai li {
  margin: 2px 0;
}

.message-ai strong {
  font-weight: 600;
}

.message-ai em {
  font-style: italic;
}

.message-ai h1, .message-ai h2, .message-ai h3 {
  margin: 12px 0 8px 0;
  font-weight: 600;
}

.message-ai blockquote {
  border-left: 3px solid #007AFF;
  margin: 8px 0;
  padding: 4px 0 4px 12px;
  color: #666;
}
        `;
    }
    
    function injectStyles(shadowRoot) {
        const styleSheet = document.createElement('style');
        styleSheet.textContent = getCSSContent();
        shadowRoot.appendChild(styleSheet);
    }
    
    // Public API
    return {
        getCSSContent,
        injectStyles
    };
    
})();