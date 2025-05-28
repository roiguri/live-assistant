// Background Script - Gemini Live API Connection Handler
importScripts('services/connection-manager.js');
importScripts('services/message-router.js');

console.log('AI Assistant: Background script loaded');

const connectionManager = new globalThis.ConnectionManager();
const messageRouter = new globalThis.MessageRouter();

// Connect the message router to the connection manager
messageRouter.setupDefaultHandlers(connectionManager);

// Initialize connection when extension starts
chrome.runtime.onStartup.addListener(() => connectionManager.initializeConnection());
chrome.runtime.onInstalled.addListener(() => connectionManager.initializeConnection());

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  // Route all messages through the message router
  return messageRouter.handleMessage(message, sender, sendResponse);
});

// Handle command shortcuts
chrome.commands.onCommand.addListener((command) => {
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
    
    messageRouter.broadcastToAllTabs({
      type: 'TOGGLE_CHAT_VISIBILITY',
      visible: newVisibility
    });
  } catch (error) {
    console.error('Failed to toggle chat via keyboard:', error);
  }
}

async function focusChatInputAcrossAllTabs() {
  try {
    const result = await chrome.storage.local.get(['chatVisible']);
    const isVisible = result.chatVisible !== false;
    
    if (!isVisible) {
      await chrome.storage.local.set({ chatVisible: true });
    }
    
    messageRouter.broadcastToAllTabs({
      type: isVisible ? 'FOCUS_CHAT_INPUT' : 'TOGGLE_CHAT_VISIBILITY',
      visible: true
    });
  } catch (error) {
    console.error('Failed to focus chat via keyboard:', error);
  }
}

async function takeScreenshotAcrossAllTabs() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;
    
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
    
    messageRouter.sendToTab(activeTab.id, {
      type: 'KEYBOARD_SCREENSHOT'
    });
    
  } catch (error) {
    console.error('Failed to take screenshot via keyboard:', error);
  }
}