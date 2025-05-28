// Load window-based modules for testing
const fs = require('fs');
const path = require('path');

function loadChatState() {
  // Load ChatState model
  const chatStatePath = path.join(__dirname, '../../../content/models/chat-state.js');
  const chatStateCode = fs.readFileSync(chatStatePath, 'utf8');

  // Execute the code in the test environment
  // Remove any browser-specific code and make it work in Node.js
  const processedCode = chatStateCode
    .replace(/window\.ChatState/g, 'global.ChatState');

  eval(processedCode);

  // Make it available on window for tests that expect it there
  global.window = global.window || {};
  global.window.ChatState = global.ChatState;
  
  return global.ChatState;
}

function loadServices() {
  // Load ErrorHandler first (GeminiClient depends on it)
  const errorHandlerPath = path.join(__dirname, '../../../services/error-handler.js');
  const errorHandlerCode = fs.readFileSync(errorHandlerPath, 'utf8');
  eval(errorHandlerCode);

  // Load GeminiClient
  const geminiClientPath = path.join(__dirname, '../../../services/gemini-client.js');
  const geminiClientCode = fs.readFileSync(geminiClientPath, 'utf8');
  eval(geminiClientCode);

  return { 
    ErrorHandler: global.ErrorHandler, 
    GeminiClient: global.GeminiClient 
  };
}

// Load initially
loadChatState();
loadServices();

// Expose reload functions for tests that need fresh state
global.reloadChatState = loadChatState;
global.reloadServices = loadServices; 