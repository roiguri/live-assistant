// Chat UI Module - Progressive disclosure interface with 3 states
window.ChatUI = (function() {
    'use strict';
    
    // Use shared state from ChatState model
    const { STATES } = ChatState;
    
    function createChatContainer() {
      return ChatView.renderContainer();
    }
    

    
    function setState(container, newState) {
      if (!ChatState.setState(newState)) return;
      ChatView.updateState(container);
    }
    

    
    function addMessage(container, text, sender = 'user') {      
      // Add to DOM via view layer
      ChatView.addMessageToDOM(container, text, sender);
      
      // Update state based on message
      if (sender === 'ai' && ChatState.isMinimalState()) {
        setState(container, STATES.RECENT);
      }
      
      // Update recent area if visible
      if (ChatState.isRecentState()) {
        ChatView.updateRecentArea(container);
      }
    }
    
    function clearInput(container) {
      ChatView.clearInputDOM(container);
    }
    
    function getInputValue(container) {
      return ChatView.getInputValue(container);
    }
    
    function toggleFullChat(container) {
      if (ChatState.isFullState()) {
        // Collapsing from full - check if we have recent AI messages
        const messages = ChatState.getMessages();
        const hasMessages = messages.length > 0;
        
        const newState = hasMessages ? STATES.RECENT : STATES.MINIMAL;
        setState(container, newState);
      } else {
        // Expanding to full
        setState(container, STATES.FULL);
      }
    }
    
    function clearChat(container) {
      // Note: Conversation clearing now handled by background ConversationManager
      // This function is only used for local UI clearing during conversation updates
      ChatView.clearMessagesDOM(container);
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
      getCurrentState: () => ChatState.getState()
    };
    
  })();