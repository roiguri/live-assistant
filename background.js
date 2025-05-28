// Background Script - Gemini Live API Connection Handler
importScripts('services/error-handler.js');
importScripts('services/api-service.js');
importScripts('services/gemini-client.js');
importScripts('services/connection-manager.js');
importScripts('services/message-router.js');

const errorHandler = new globalThis.ErrorHandler();
const apiService = new globalThis.ApiService();
const connectionManager = new globalThis.ConnectionManager();
const messageRouter = new globalThis.MessageRouter();

// Set production log level (change to 'debug' for development)
errorHandler.setLogLevel('info');

// Connect the message router to the connection manager
messageRouter.setupDefaultHandlers(connectionManager);

// Initialize connection when extension starts
chrome.runtime.onStartup.addListener(() => {
  errorHandler.info('Background', 'Extension startup - initializing connection');
  connectionManager.initializeConnection();
});

chrome.runtime.onInstalled.addListener(() => {
  errorHandler.info('Background', 'Extension installed - initializing connection');
  connectionManager.initializeConnection();
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
    toggleChatVisibilityAcrossAllTabs();
  } else if (command === 'focus-chat') {
    focusChatInputAcrossAllTabs();
  } else if (command === 'take-screenshot') {
    takeScreenshotAcrossAllTabs();
  }
});

async function toggleChatVisibilityAcrossAllTabs() {
  try {
    const result = await chrome.storage.local.get(['chatVisible']);
    const currentlyVisible = result.chatVisible !== false;
    const newVisibility = !currentlyVisible;
    
    await chrome.storage.local.set({ chatVisible: newVisibility });
    
    errorHandler.info('Shortcuts', `Chat visibility toggled: ${newVisibility}`);
    
    messageRouter.broadcastToAllTabs({
      type: 'TOGGLE_CHAT_VISIBILITY',
      visible: newVisibility
    });
  } catch (error) {
    errorHandler.handleStorageError(error.message, 'toggle chat visibility');
  }
}

async function focusChatInputAcrossAllTabs() {
  try {
    const result = await chrome.storage.local.get(['chatVisible']);
    const isVisible = result.chatVisible !== false;
    
    if (!isVisible) {
      await chrome.storage.local.set({ chatVisible: true });
    }
    
    errorHandler.debug('Shortcuts', 'Focusing chat input');
    
    messageRouter.broadcastToAllTabs({
      type: isVisible ? 'FOCUS_CHAT_INPUT' : 'TOGGLE_CHAT_VISIBILITY',
      visible: true
    });
  } catch (error) {
    errorHandler.handleStorageError(error.message, 'focus chat');
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