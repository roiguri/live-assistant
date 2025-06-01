// Chat View Layer - Pure UI rendering and DOM manipulation
window.ChatView = (function() {
    'use strict';
    
    function renderContainer() {
        const container = document.createElement('div');
        container.id = 'assistant-chat';
        container.setAttribute('data-state', ChatState.getState());
        container.innerHTML = getChatHTML();

        setupTitleBarControls(container);

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
                    <button class="menu-item" data-action="take-screenshot" title="Take screenshot">
                        <span class="menu-icon">📸</span>
                    </button>
                    <button class="menu-item" data-action="clear-chat" title="New chat">
                        <span class="menu-icon">➕</span>
                    </button>
                </div>

                <div class="title-panel" style="display: none;">
                    <div class="title-left">
                        <span class="connection-dot"></span>
                        <span class="title-text">Live Assistant</span>
                        <button class="refresh-btn" title="Refresh connection">↻</button>
                    </div>
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
    
    function updateState(container) {
        container.setAttribute('data-state', ChatState.getState());
        
        const messagesArea = container.querySelector('.chat-messages');
        const recentArea = container.querySelector('.chat-recent');
        const titlePanel = container.querySelector('.title-panel');
        
        // Hide all areas first
        messagesArea.style.display = 'none';
        recentArea.style.display = 'none';
        titlePanel.style.display = 'none';
        
        // Show appropriate area based on state
        if (ChatState.isRecentState()) {
            recentArea.style.display = 'block';
            titlePanel.style.display = 'flex';
            updateRecentArea(container);
        } else if (ChatState.isFullState()) {
            messagesArea.style.display = 'block';
            titlePanel.style.display = 'flex';
        }
        // MINIMAL state shows nothing extra (default)
        
        // Ensure chat stays within viewport bounds after state change
        ensureWithinViewport(container);

        MenuView.positionMenu(container);
        
        // Update menu button text
        updateMenuText(container);
    }
    
    function addMessageToDOM(container, text, sender = 'user') {
        // Add to full messages area
        const messagesArea = container.querySelector('.chat-messages');
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${sender}`;
        if (sender === 'ai') {
            messageEl.innerHTML = marked.parse(text);
        } else {
            messageEl.textContent = text;
        }
        messagesArea.appendChild(messageEl);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
    
    function clearInputDOM(container) {
        const input = container.querySelector('.chat-input');
        input.value = '';
    }
    
    function getInputValue(container) {
        const input = container.querySelector('.chat-input');
        return input.value.trim();
    }
    
    function clearMessagesDOM(container) {
        const messagesArea = container.querySelector('.chat-messages');
        messagesArea.innerHTML = '<div class="welcome-message">Hello! I\'m your AI assistant.</div>';
    }
    
    function updateRecentArea(container) {
        const recentArea = container.querySelector('.chat-recent');
        const lastMessage = ChatState.getLastMessage();
        
        if (lastMessage && lastMessage.sender === 'ai') {
            recentArea.innerHTML = `
                <div class="message message-ai recent-message">
                    ${marked.parse(lastMessage.text)}
                </div>
            `;
        } else {
            recentArea.innerHTML = '';
        }
    }
    
    function updateMenuText(container) {
        const menuItem = container.querySelector('[data-action="toggle-full"] .menu-text');
        if (menuItem) {
            menuItem.textContent = ChatState.isFullState() ? 'Minimize chat' : 'View all messages';
        }
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

    function updateConnectionStatus(container, status, canReconnect = false) {
        const connectionDot = container.querySelector('.connection-dot');
        const refreshBtn = container.querySelector('.refresh-btn');
        
        if (!connectionDot) return; // Guard if dot not found

        // Update connection dot class based on status
        switch (status) {
            case 'connecting':
            case 'reconnecting':
                connectionDot.className = 'connection-dot connecting';
                if (refreshBtn) {
                    refreshBtn.style.display = 'flex';
                    refreshBtn.disabled = true; // Disable during connecting
                }
                break;
            case 'connected':
                connectionDot.className = 'connection-dot connected';
                if (refreshBtn) {
                    refreshBtn.style.display = 'none'; // Hide when connected
                    refreshBtn.disabled = false;
                }
                break;
            case 'failed':
            case 'disconnected':
                connectionDot.className = 'connection-dot failed';
                if (refreshBtn) {
                    refreshBtn.style.display = 'flex'; // Show when failed
                    refreshBtn.disabled = false; // Enable for retry
                }
                break;
            default:
                connectionDot.className = 'connection-dot'; // Default connecting state (yellow with pulse)
                if (refreshBtn) {
                    refreshBtn.style.display = 'flex';
                    refreshBtn.disabled = true;
                }
                break;
        }
    }
    
    function setupTitleBarControls(container) {
        const refreshBtn = container.querySelector('.refresh-btn');

        if (!refreshBtn) return; // Guard if button not found

        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Immediately show connecting state for instant visual feedback
            refreshBtn.disabled = true;
            updateConnectionStatus(container, 'reconnecting');
            
            chrome.runtime.sendMessage({ type: 'MANUAL_RECONNECT' }, (response) => {});
        });
    }
    
    // Public API - Pure view functions only
    return {
        renderContainer,
        updateState,
        addMessageToDOM,
        clearInputDOM,
        getInputValue,
        clearMessagesDOM,
        updateRecentArea,
        ensureWithinViewport,
        updateConnectionStatus
    };
    
})(); 