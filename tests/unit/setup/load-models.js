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
  // Load ErrorHandler first (others depend on it)
  const errorHandlerPath = path.join(__dirname, '../../../services/error-handler.js');
  const errorHandlerCode = fs.readFileSync(errorHandlerPath, 'utf8');
  eval(errorHandlerCode);

  // Load ApiService (ConnectionManager depends on it)
  const apiServicePath = path.join(__dirname, '../../../services/api-service.js');
  const apiServiceCode = fs.readFileSync(apiServicePath, 'utf8');
  eval(apiServiceCode);

  // Load GeminiClient
  const geminiClientPath = path.join(__dirname, '../../../services/gemini-client.js');
  const geminiClientCode = fs.readFileSync(geminiClientPath, 'utf8');
  eval(geminiClientCode);

  // Load Connection Services (ConnectionManager depends on these)
  const websocketServicePath = path.join(__dirname, '../../../services/connection/websocket-service.js');
  const websocketServiceCode = fs.readFileSync(websocketServicePath, 'utf8');
  eval(websocketServiceCode);

  const retryServicePath = path.join(__dirname, '../../../services/connection/retry-service.js');
  const retryServiceCode = fs.readFileSync(retryServicePath, 'utf8');
  eval(retryServiceCode);

  const messageQueueServicePath = path.join(__dirname, '../../../services/connection/message-queue-service.js');
  const messageQueueServiceCode = fs.readFileSync(messageQueueServicePath, 'utf8');
  eval(messageQueueServiceCode);

  const setupServicePath = path.join(__dirname, '../../../services/connection/setup-service.js');
  const setupServiceCode = fs.readFileSync(setupServicePath, 'utf8');
  eval(setupServiceCode);

  const responseRouterPath = path.join(__dirname, '../../../services/connection/response-router.js');
  const responseRouterCode = fs.readFileSync(responseRouterPath, 'utf8');
  eval(responseRouterCode);

  // Load ConnectionManager
  const connectionManagerPath = path.join(__dirname, '../../../services/connection-manager.js');
  const connectionManagerCode = fs.readFileSync(connectionManagerPath, 'utf8');
  eval(connectionManagerCode);

  return {
    ErrorHandler: global.ErrorHandler,
    GeminiClient: global.GeminiClient,
    ApiService: global.ApiService,
    WebSocketService: global.WebSocketService,
    RetryService: global.RetryService,
    MessageQueueService: global.MessageQueueService,
    SetupService: global.SetupService,
    ResponseRouter: global.ResponseRouter,
    ConnectionManager: global.ConnectionManager
  };
}

// Load initially
loadChatState();
loadServices();

// Expose reload functions for tests that need fresh state
global.reloadChatState = loadChatState;
global.reloadServices = loadServices; 