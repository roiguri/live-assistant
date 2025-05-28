// Background Script - Gemini Live API Connection Handler
importScripts('services/connection-manager.js');

console.log('AI Assistant: Background script loaded');

const connectionManager = new globalThis.ConnectionManager();

// Initialize connection when extension starts
chrome.runtime.onStartup.addListener(() => connectionManager.initializeConnection());
chrome.runtime.onInstalled.addListener(() => connectionManager.initializeConnection());

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  switch (message.type) {
    case 'SEND_TEXT_MESSAGE':
      connectionManager.handleTextMessage(message.text, sender.tab.id);
      return true;
    case 'SEND_VIDEO_CHUNK':
      connectionManager.handleVideoChunk(message.data, message.mimeType, sender.tab.id);
      return true;
    case 'START_VIDEO_STREAM':
      connectionManager.startVideoStreaming(sender.tab.id);
      return true;
    case 'STOP_VIDEO_STREAM':
      connectionManager.stopVideoStreaming(sender.tab.id);
      return true;
    case 'TAKE_SCREENSHOT':
      connectionManager.handleTabScreenshot(sender.tab.id, sendResponse);
      return true;
    case 'GET_CONNECTION_STATUS':
      const status = connectionManager.getConnectionStatus();
      console.log('Sending connection status:', status);
      sendResponse(status || { websocket: 'unknown', error: 'Status unavailable' });
      return true;
    case 'MANUAL_RECONNECT':
      connectionManager.manualReconnect();
      sendResponse({ success: true });
      return true;
    case 'PROMPT_UPDATED':
      connectionManager.handlePromptUpdate();
      sendResponse({ success: true });
      return true;
    default:
      console.log('No case matched');
      return true;
  }
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
    
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_CHAT_VISIBILITY',
        visible: newVisibility
      }).catch(() => {});
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
    
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: isVisible ? 'FOCUS_CHAT_INPUT' : 'TOGGLE_CHAT_VISIBILITY',
        visible: true
      }).catch(() => {});
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
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'TOGGLE_CHAT_VISIBILITY',
        visible: true
      }).catch(() => {});
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    chrome.tabs.sendMessage(activeTab.id, {
      type: 'KEYBOARD_SCREENSHOT'
    }).catch(() => {});
    
  } catch (error) {
    console.error('Failed to take screenshot via keyboard:', error);
  }
}