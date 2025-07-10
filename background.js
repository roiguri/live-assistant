// Background Script - Gemini Live API Connection Handler
importScripts('services/error-handler.js');
importScripts('services/api-service.js');
importScripts('services/gemini-client.js');
importScripts('services/connection-manager.js');
importScripts('services/message-router.js');
importScripts('services/conversation-manager.js');

const errorHandler = new globalThis.ErrorHandler();
const apiService = new globalThis.ApiService();
const connectionManager = new globalThis.ConnectionManager();
const messageRouter = new globalThis.MessageRouter();
const conversationManager = new globalThis.ConversationManager();

// Set production log level (change to 'debug' for development)
errorHandler.setLogLevel('info');

// Connect the message router to the connection manager
messageRouter.setupDefaultHandlers(connectionManager);

// Connect the conversation manager to the message router
messageRouter.setConversationManager(conversationManager);

// Connect the conversation manager to the connection manager
connectionManager.setConversationManager(conversationManager);

// Connect the connection manager to the conversation manager (for context reset)
conversationManager.setConnectionManager(connectionManager);

// Initialize connection when extension starts
chrome.runtime.onStartup.addListener(() => {
  errorHandler.info('Background', 'Extension startup - initializing connection');
  connectionManager.connect();
});

chrome.runtime.onInstalled.addListener(() => {
  errorHandler.info('Background', 'Extension installed - initializing connection');
  connectionManager.connect();
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  errorHandler.debug('Background', `Message received: ${message.type}`);
  
  // Route all messages through the message router
  return messageRouter.handleMessage(message, sender, sendResponse);
});

// Handle command shortcuts
chrome.commands.onCommand.addListener((command) => {
  errorHandler.info('Shortcuts', `Command triggered: ${command}`);
  
  if (command === 'toggle-chat') {
    smartToggleChatAcrossAllTabs();
  } else if (command === 'take-screenshot') {
    takeScreenshotAcrossAllTabs();
  } else if (command === 'new-chat') {
    newChatAcrossAllTabs();
  } else if (command === 'refresh-connection') {
    refreshConnectionAcrossAllTabs();
  }
});

// Smart toggle: closed → open, focused → close, open+unfocused → focus
async function smartToggleChatAcrossAllTabs() {
  try {
    const result = await chrome.storage.local.get(['chatVisible']);
    const currentlyVisible = result.chatVisible !== false;
    
    if (!currentlyVisible) {
      // Chat is closed - open and focus
      await chrome.storage.local.set({ chatVisible: true });
      errorHandler.info('Shortcuts', 'Smart toggle: opening chat and focusing input');
      
      messageRouter.broadcastToAllTabs({
        type: 'TOGGLE_CHAT_VISIBILITY',
        visible: true
      });
    } else {
      // Chat is open - check focus state and act accordingly
      errorHandler.info('Shortcuts', 'Smart toggle: checking focus state');
      
      messageRouter.broadcastToAllTabs({
        type: 'SMART_TOGGLE_FOCUS_CHECK'
      });
    }
  } catch (error) {
    errorHandler.handleStorageError(error.message, 'smart toggle chat');
  }
}

async function takeScreenshotAcrossAllTabs() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      errorHandler.logWarning('Shortcuts', 'No active tab for screenshot');
      return;
    }
    
    const result = await chrome.storage.local.get(['chatVisible']);
    const isVisible = result.chatVisible !== false;
    
    if (!isVisible) {
      await chrome.storage.local.set({ chatVisible: true });
      messageRouter.sendToTab(activeTab.id, {
        type: 'TOGGLE_CHAT_VISIBILITY',
        visible: true
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    errorHandler.debug('Shortcuts', 'Taking screenshot via keyboard');
    
    messageRouter.sendToTab(activeTab.id, {
      type: 'KEYBOARD_SCREENSHOT'
    });
    
  } catch (error) {
    errorHandler.handleScreenshotError(error.message);
  }
}

async function newChatAcrossAllTabs() {
  try {
    errorHandler.info('Shortcuts', 'Starting new chat conversation');
    
    messageRouter.broadcastToAllTabs({
      type: 'NEW_CHAT'
    });
  } catch (error) {
    errorHandler.handleMessageError(error.message, 'new chat');
  }
}


async function refreshConnectionAcrossAllTabs() {
  try {
    errorHandler.info('Shortcuts', 'Refreshing connection');
    
    messageRouter.broadcastToAllTabs({
      type: 'REFRESH_CONNECTION'
    });
  } catch (error) {
    errorHandler.handleConnectionError(error.message, 'refresh connection');
  }
}