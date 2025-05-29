// MessageRouter Unit Tests
const path = require('path');

// Load test helpers
require('../../config/test-helpers.js');

// Load the service
require('../../../services/message-router.js');

describe('MessageRouter', () => {
    let messageRouter;
    let mockConnectionManager;

    beforeEach(() => {
        // Create fresh instance
        messageRouter = new globalThis.MessageRouter();
        
        // Create mock ConnectionManager
        mockConnectionManager = {
            handleTextMessage: jest.fn(),
            handleTabScreenshot: jest.fn(),
            getConnectionStatus: jest.fn(),
            manualReconnect: jest.fn(),
            handlePromptUpdate: jest.fn()
        };
        
        // Reset Chrome API mocks
        chrome.tabs.query.mockClear();
        chrome.tabs.sendMessage.mockClear();
    });

    describe('registerHandler', () => {
        it('should add handler to map', () => {
            const testHandler = jest.fn();
            const messageType = 'TEST_MESSAGE';
            
            messageRouter.registerHandler(messageType, testHandler);
            
            // Verify handler was added to the map
            expect(messageRouter.handlers.has(messageType)).toBe(true);
            expect(messageRouter.handlers.get(messageType)).toBe(testHandler);
        });

        it('should allow overriding existing handlers', () => {
            const firstHandler = jest.fn();
            const secondHandler = jest.fn();
            const messageType = 'TEST_MESSAGE';
            
            messageRouter.registerHandler(messageType, firstHandler);
            messageRouter.registerHandler(messageType, secondHandler);
            
            expect(messageRouter.handlers.get(messageType)).toBe(secondHandler);
        });
    });

    describe('handleMessage', () => {
        it('should route to correct handler', () => {
            const testHandler = jest.fn().mockReturnValue(false);
            const message = { type: 'TEST_MESSAGE', data: 'test' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            messageRouter.registerHandler('TEST_MESSAGE', testHandler);
            
            const result = messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(testHandler).toHaveBeenCalledWith(message, sender, sendResponse);
            expect(result).toBe(false);
        });

        it('should return true for async handlers', () => {
            const asyncHandler = jest.fn().mockReturnValue(true);
            const message = { type: 'ASYNC_MESSAGE' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            messageRouter.registerHandler('ASYNC_MESSAGE', asyncHandler);
            
            const result = messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(asyncHandler).toHaveBeenCalledWith(message, sender, sendResponse);
            expect(result).toBe(true);
        });

        it('should handle unknown message types', () => {
            const message = { type: 'UNKNOWN_MESSAGE' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            const result = messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(result).toBe(false);
            expect(sendResponse).not.toHaveBeenCalled();
        });

        it('should catch and report handler errors', () => {
            const errorHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler error');
            });
            const message = { type: 'ERROR_MESSAGE' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            messageRouter.registerHandler('ERROR_MESSAGE', errorHandler);
            
            const result = messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(result).toBe(false);
            expect(sendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Handler error'
            });
        });

        it('should handle errors when sendResponse is not provided', () => {
            const errorHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler error');
            });
            const message = { type: 'ERROR_MESSAGE' };
            const sender = { tab: { id: 123 } };
            
            messageRouter.registerHandler('ERROR_MESSAGE', errorHandler);
            
            // Should not throw when sendResponse is null/undefined
            expect(() => {
                messageRouter.handleMessage(message, sender, null);
            }).not.toThrow();
        });
    });

    describe('broadcastToAllTabs', () => {
        it('should send to all tabs (mocked)', async () => {
            const mockTabs = [
                { id: 1, url: 'https://example.com' },
                { id: 2, url: 'https://google.com' },
                { id: 3, url: 'https://github.com' }
            ];
            const testMessage = { type: 'BROADCAST_TEST', data: 'hello' };
            
            // Mock chrome.tabs.query to call callback with mock tabs
            chrome.tabs.query.mockImplementation((query, callback) => {
                callback(mockTabs);
            });
            
            // Mock chrome.tabs.sendMessage to return a promise
            chrome.tabs.sendMessage.mockResolvedValue();
            
            messageRouter.broadcastToAllTabs(testMessage);
            
            // Verify query was called correctly
            expect(chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
            
            // Wait for async operations to complete
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Verify sendMessage was called for each tab
            expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, testMessage);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, testMessage);
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, testMessage);
        });

        it('should handle sendMessage errors gracefully', async () => {
            const mockTabs = [{ id: 1 }, { id: 2 }];
            const testMessage = { type: 'BROADCAST_TEST' };
            
            chrome.tabs.query.mockImplementation((query, callback) => {
                callback(mockTabs);
            });
            
            // Mock one successful and one failing sendMessage
            chrome.tabs.sendMessage
                .mockResolvedValueOnce() // First call succeeds
                .mockRejectedValueOnce(new Error('Tab not found')); // Second call fails
            
            // Should not throw
            expect(() => {
                messageRouter.broadcastToAllTabs(testMessage);
            }).not.toThrow();
        });
    });

    describe('sendToTab', () => {
        it('should send to specific tab (mocked)', () => {
            const tabId = 123;
            const testMessage = { type: 'TAB_TEST', data: 'specific' };
            const callback = jest.fn();
            
            messageRouter.sendToTab(tabId, testMessage, callback);
            
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, testMessage, callback);
        });

        it('should send without callback', () => {
            const tabId = 456;
            const testMessage = { type: 'TAB_TEST' };
            
            chrome.tabs.sendMessage.mockResolvedValue();
            
            messageRouter.sendToTab(tabId, testMessage);
            
            expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, testMessage);
        });

        it('should handle sendMessage errors gracefully', () => {
            const tabId = 789;
            const testMessage = { type: 'TAB_TEST' };
            
            chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));
            
            // Should not throw
            expect(() => {
                messageRouter.sendToTab(tabId, testMessage);
            }).not.toThrow();
        });
    });

    describe('setupDefaultHandlers', () => {
        it('should register all required handlers', () => {
            // Create new router to test from clean state
            const router = new globalThis.MessageRouter();
            
            // Verify all default handlers are registered
            const expectedHandlers = [
                'SEND_TEXT_MESSAGE',
                'TAKE_SCREENSHOT',
                'GET_CONNECTION_STATUS',
                'MANUAL_RECONNECT',
                'PROMPT_UPDATED',
                'ADD_MESSAGE',
                'GET_CONVERSATION',
                'CLEAR_CONVERSATION',
                'SET_UI_STATE',
                'GET_UI_STATE'
            ];
            
            expectedHandlers.forEach(handlerType => {
                expect(router.handlers.has(handlerType)).toBe(true);
                expect(typeof router.handlers.get(handlerType)).toBe('function');
            });
        });

        it('should set connectionManager when provided', () => {
            const router = new globalThis.MessageRouter();
            
            router.setupDefaultHandlers(mockConnectionManager);
            
            expect(router.connectionManager).toBe(mockConnectionManager);
        });

        it('should handle SEND_TEXT_MESSAGE correctly', () => {
            messageRouter.setupDefaultHandlers(mockConnectionManager);
            
            const message = { type: 'SEND_TEXT_MESSAGE', text: 'Hello world' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(mockConnectionManager.handleTextMessage).toHaveBeenCalledWith('Hello world', 123);
        });

        it('should handle TAKE_SCREENSHOT correctly', () => {
            messageRouter.setupDefaultHandlers(mockConnectionManager);
            
            const message = { type: 'TAKE_SCREENSHOT' };
            const sender = { tab: { id: 456 } };
            const sendResponse = jest.fn();
            
            const result = messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(mockConnectionManager.handleTabScreenshot).toHaveBeenCalledWith(456, sendResponse);
            expect(result).toBe(true); // Should return true for async handler
        });

        it('should handle GET_CONNECTION_STATUS correctly', () => {
            const mockStatus = { connected: true, websocket: 'open' };
            mockConnectionManager.getConnectionStatus.mockReturnValue(mockStatus);
            
            messageRouter.setupDefaultHandlers(mockConnectionManager);
            
            const message = { type: 'GET_CONNECTION_STATUS' };
            const sender = { tab: { id: 789 } };
            const sendResponse = jest.fn();
            
            messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(mockConnectionManager.getConnectionStatus).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith(mockStatus);
        });

        it('should handle MANUAL_RECONNECT correctly', () => {
            messageRouter.setupDefaultHandlers(mockConnectionManager);
            
            const message = { type: 'MANUAL_RECONNECT' };
            const sender = { tab: { id: 101 } };
            const sendResponse = jest.fn();
            
            messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(mockConnectionManager.manualReconnect).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle PROMPT_UPDATED correctly', () => {
            messageRouter.setupDefaultHandlers(mockConnectionManager);
            
            const message = { type: 'PROMPT_UPDATED' };
            const sender = { tab: { id: 202 } };
            const sendResponse = jest.fn();
            
            messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(mockConnectionManager.handlePromptUpdate).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle messages when connectionManager is not set', () => {
            const router = new globalThis.MessageRouter();
            router.connectionManager = null;
            
            const message = { type: 'SEND_TEXT_MESSAGE', text: 'test' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            // Should not throw when connectionManager is null
            expect(() => {
                router.handleMessage(message, sender, sendResponse);
            }).not.toThrow();
        });

        it('should handle ADD_MESSAGE correctly', async () => {
            const message = { type: 'ADD_MESSAGE', text: 'Hello', sender: 'user' };
            const sender = { tab: { id: 123 } };
            const sendResponse = jest.fn();
            
            await messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle GET_CONVERSATION correctly', () => {
            const message = { type: 'GET_CONVERSATION' };
            const sender = { tab: { id: 456 } };
            const sendResponse = jest.fn();
            
            messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(sendResponse).toHaveBeenCalledWith({ messages: [] });
        });

        it('should handle CLEAR_CONVERSATION correctly', () => {
            const message = { type: 'CLEAR_CONVERSATION' };
            const sender = { tab: { id: 789 } };
            const sendResponse = jest.fn();
            
            messageRouter.handleMessage(message, sender, sendResponse);
            
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });
    });

    describe('ConversationManager integration', () => {
        let mockConversationManager;

        beforeEach(() => {
            jest.clearAllMocks();
            
            mockConversationManager = {
                addMessage: jest.fn().mockResolvedValue({ id: 'msg_123', text: 'test', sender: 'user' }),
                getConversation: jest.fn().mockReturnValue([]),
                clearConversation: jest.fn(),
                setUIState: jest.fn().mockResolvedValue(true),
                getUIState: jest.fn().mockReturnValue('minimal')
            };
        });

        test('setConversationManager stores the conversation manager', () => {
            messageRouter.setConversationManager(mockConversationManager);
            
            expect(messageRouter.conversationManager).toBe(mockConversationManager);
        });

        test('ADD_MESSAGE handler calls conversationManager.addMessage', async () => {
            messageRouter.setConversationManager(mockConversationManager);
            const sendResponse = jest.fn();
            const message = { type: 'ADD_MESSAGE', text: 'Hello world', sender: 'user' };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
                'Hello world', 
                'user', 
                123
            );
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('ADD_MESSAGE handler works without conversationManager', async () => {
            // Don't set conversation manager
            const sendResponse = jest.fn();
            const message = { type: 'ADD_MESSAGE', text: 'Hello world', sender: 'user' };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('ADD_MESSAGE handler handles async errors gracefully', async () => {
            mockConversationManager.addMessage.mockRejectedValue(new Error('Storage failed'));
            messageRouter.setConversationManager(mockConversationManager);
            
            const sendResponse = jest.fn();
            const message = { type: 'ADD_MESSAGE', text: 'Hello world', sender: 'user' };
            const sender = { tab: { id: 123 } };

            // Should not throw
            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(mockConversationManager.addMessage).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('handles missing conversation manager gracefully for GET_CONVERSATION', async () => {
            messageRouter.setConversationManager(null);
            const sendResponse = jest.fn();
            const message = { type: 'GET_CONVERSATION', limit: 25 };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(sendResponse).toHaveBeenCalledWith({ messages: [] });
        });
    });

    describe('Conversation loading for new tabs', () => {
        let mockConversationManager;

        beforeEach(() => {
            jest.clearAllMocks();
            
            mockConversationManager = {
                addMessage: jest.fn().mockResolvedValue({ id: 'msg_123' }),
                getConversation: jest.fn().mockReturnValue([
                    { id: 'msg_1', text: 'Hello', sender: 'user' },
                    { id: 'msg_2', text: 'Hi there!', sender: 'ai' }
                ]),
                clearConversation: jest.fn(),
                setUIState: jest.fn().mockResolvedValue(true),
                getUIState: jest.fn().mockReturnValue('minimal')
            };
            
            messageRouter.setConversationManager(mockConversationManager);
        });

        test('GET_CONVERSATION returns conversation messages with default limit', async () => {
            const sendResponse = jest.fn();
            const message = { type: 'GET_CONVERSATION' };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(mockConversationManager.getConversation).toHaveBeenCalledWith(50);
            expect(sendResponse).toHaveBeenCalledWith({
                messages: [
                    { id: 'msg_1', text: 'Hello', sender: 'user' },
                    { id: 'msg_2', text: 'Hi there!', sender: 'ai' }
                ]
            });
        });

        test('GET_CONVERSATION respects custom limit', async () => {
            const sendResponse = jest.fn();
            const message = { type: 'GET_CONVERSATION', limit: 25 };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(mockConversationManager.getConversation).toHaveBeenCalledWith(25);
            expect(sendResponse).toHaveBeenCalledWith({
                messages: [
                    { id: 'msg_1', text: 'Hello', sender: 'user' },
                    { id: 'msg_2', text: 'Hi there!', sender: 'ai' }
                ]
            });
        });

        test('GET_CONVERSATION returns empty array when no conversation manager', async () => {
            messageRouter.setConversationManager(null);
            const sendResponse = jest.fn();
            const message = { type: 'GET_CONVERSATION' };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(sendResponse).toHaveBeenCalledWith({ messages: [] });
        });
    });

    describe('Step 8: Clear conversation functionality', () => {
        let mockConversationManager;

        beforeEach(() => {
            jest.clearAllMocks();
            
            mockConversationManager = {
                addMessage: jest.fn().mockResolvedValue({ id: 'msg_123' }),
                getConversation: jest.fn().mockReturnValue([]),
                clearConversation: jest.fn(),
                setUIState: jest.fn().mockResolvedValue(true),
                getUIState: jest.fn().mockReturnValue('minimal')
            };
            
            messageRouter.setConversationManager(mockConversationManager);
        });

        test('CLEAR_CONVERSATION calls conversationManager.clearConversation', async () => {
            const sendResponse = jest.fn();
            const message = { type: 'CLEAR_CONVERSATION' };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(mockConversationManager.clearConversation).toHaveBeenCalledWith();
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('CLEAR_CONVERSATION works without conversation manager', async () => {
            messageRouter.setConversationManager(null);
            const sendResponse = jest.fn();
            const message = { type: 'CLEAR_CONVERSATION' };
            const sender = { tab: { id: 123 } };

            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('CLEAR_CONVERSATION handles errors gracefully', async () => {
            mockConversationManager.clearConversation.mockImplementation(() => {
                throw new Error('Clear failed');
            });
            
            const sendResponse = jest.fn();
            const message = { type: 'CLEAR_CONVERSATION' };
            const sender = { tab: { id: 123 } };

            // Should not throw
            await messageRouter.handleMessage(message, sender, sendResponse);

            expect(mockConversationManager.clearConversation).toHaveBeenCalled();
            expect(sendResponse).toHaveBeenCalledWith({ success: true });
        });
    });

    describe('UI State Management', () => {
        let mockConversationManager;
        let mockSendResponse;

        beforeEach(() => {
            jest.clearAllMocks();
            
            mockConversationManager = {
                addMessage: jest.fn().mockResolvedValue({ id: 'msg_123' }),
                getConversation: jest.fn().mockReturnValue([]),
                clearConversation: jest.fn(),
                setUIState: jest.fn().mockResolvedValue(true),
                getUIState: jest.fn().mockReturnValue('minimal')
            };
            
            mockSendResponse = jest.fn();
            messageRouter.setConversationManager(mockConversationManager);
        });

        test('SET_UI_STATE handler calls conversationManager.setUIState', async () => {
            mockConversationManager.setUIState.mockResolvedValue(true);
            
            const result = messageRouter.handleMessage(
                { type: 'SET_UI_STATE', uiState: 'full' },
                { tab: { id: 1 } },
                mockSendResponse
            );
            
            // Wait for async handler
            expect(result).toBe(true); // Should return true for async handler
            await new Promise(resolve => setTimeout(resolve, 0));
            
            expect(mockConversationManager.setUIState).toHaveBeenCalledWith('full');
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('SET_UI_STATE handler handles missing conversation manager', async () => {
            messageRouter.conversationManager = null;
            
            const result = messageRouter.handleMessage(
                { type: 'SET_UI_STATE', uiState: 'full' },
                { tab: { id: 1 } },
                mockSendResponse
            );
            
            // Wait for async handler
            await new Promise(resolve => setTimeout(resolve, 0));
            
            expect(mockSendResponse).toHaveBeenCalledWith({ success: false });
        });

        test('SET_UI_STATE handler handles errors gracefully', async () => {
            mockConversationManager.setUIState.mockRejectedValue(new Error('State failed'));
            
            const result = messageRouter.handleMessage(
                { type: 'SET_UI_STATE', uiState: 'invalid' },
                { tab: { id: 1 } },
                mockSendResponse
            );
            
            // Wait for async handler
            await new Promise(resolve => setTimeout(resolve, 0));
            
            expect(mockSendResponse).toHaveBeenCalledWith({ 
                success: false, 
                error: 'State failed' 
            });
        });

        test('GET_UI_STATE handler calls conversationManager.getUIState', () => {
            mockConversationManager.getUIState.mockReturnValue('recent');
            
            messageRouter.handleMessage(
                { type: 'GET_UI_STATE' },
                { tab: { id: 1 } },
                mockSendResponse
            );
            
            expect(mockConversationManager.getUIState).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ uiState: 'recent' });
        });

        test('GET_UI_STATE handler handles missing conversation manager', () => {
            messageRouter.conversationManager = null;
            
            messageRouter.handleMessage(
                { type: 'GET_UI_STATE' },
                { tab: { id: 1 } },
                mockSendResponse
            );
            
            expect(mockSendResponse).toHaveBeenCalledWith({ uiState: 'minimal' });
        });
    });
}); 