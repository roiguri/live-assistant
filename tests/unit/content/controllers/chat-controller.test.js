const path = require('path');

require('../../../config/test-helpers.js');

// Mock createElement with a factory to ensure unique elements and correct container
const createMockElement = () => {
    const element = {
        className: '',
        textContent: '',
        innerHTML: '',
        id: '',
        style: {},
        appendChild: jest.fn(),
        setAttribute: jest.fn(),
        querySelector: jest.fn(),
        getAttribute: jest.fn(),
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        contains: jest.fn(),
        matches: jest.fn(),
        getBoundingClientRect: jest.fn()
    };
    return element;
};

const mockCreateElement = jest.fn();

Object.defineProperty(global, 'document', {
    writable: true,
    value: {
        createElement: mockCreateElement,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getElementById: jest.fn(),
        body: {
            appendChild: jest.fn(),
            style: {}
        }
    }
});

// Mock window at module level
global.window = {
    innerHeight: 800,
    innerWidth: 1200
};

// Mock chrome at module level
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        lastError: null
    }
};

// Mock setTimeout/clearTimeout for response timeouts
global.setTimeout = jest.fn();
global.clearTimeout = jest.fn();

// Mock confirm for clear chat action
global.confirm = jest.fn();

// Mock dependencies at module level
global.ChatUI = {
    getInputValue: jest.fn(),
    addMessage: jest.fn(),
    clearInput: jest.fn(),
    toggleFullChat: jest.fn(),
    clearChat: jest.fn()
};

global.MessageView = {
    showTypingIndicator: jest.fn(),
    removeTypingIndicator: jest.fn(),
    startStreamingMessage: jest.fn(),
    updateStreamingMessage: jest.fn(),
    finalizeStreamingMessage: jest.fn(),
    updateRecentMessage: jest.fn()
};

global.ConnectionState = {
    isTyping: jest.fn(),
    getTypingId: jest.fn(),
    clearTyping: jest.fn(),
    clearResponseTimeout: jest.fn(),
    getStreamingElement: jest.fn(),
    setResponseTimeout: jest.fn()
};

// Load the module after mocks are set up
require('../../../../content/controllers/chat-controller.js');

describe('ChatController', () => {
    let mockContainer;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Clear createElement mock history
        mockCreateElement.mockClear();
        
        // Explicitly reset global state
        global.window = {
            innerHeight: 800,
            innerWidth: 1200
        };
        
        // Reset chrome mock
        global.chrome = {
            runtime: {
                sendMessage: jest.fn(),
                lastError: null
            }
        };
        
        // Reset confirm
        global.confirm = jest.fn();
        
        // Create mock container
        mockContainer = {
            id: 'assistant-chat',
            innerHTML: '',
            setAttribute: jest.fn(),
            querySelector: jest.fn(),
            getAttribute: jest.fn(),
            appendChild: jest.fn(),
            style: { top: '', bottom: '' },
            getBoundingClientRect: jest.fn(() => ({
                top: 50,
                bottom: 200,
                height: 150,
                left: 100,
                right: 380,
                width: 280
            }))
        };

        // Set up document.getElementById mock
        global.document.getElementById.mockReturnValue(mockContainer);
        
        // Reset mock defaults
        global.ChatUI.getInputValue.mockReturnValue('');
        global.ConnectionState.isTyping.mockReturnValue(false);
        global.ConnectionState.getTypingId.mockReturnValue(null);
        global.ConnectionState.getStreamingElement.mockReturnValue(null);
        
        // Simple createElement mock: returns a fresh mock element by default
        mockCreateElement.mockImplementation(() => createMockElement());
    });

    describe('sendMessage', () => {
        it('validates input and sends to background', () => {
            const message = 'Hello AI!';
            global.ChatUI.getInputValue.mockReturnValue(message);

            window.ChatController.sendMessage(mockContainer);

            // Verify input validation
            expect(global.ChatUI.getInputValue).toHaveBeenCalledWith(mockContainer);
            
            // Verify message sent to UI
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, message, 'user');
            expect(global.ChatUI.clearInput).toHaveBeenCalledWith(mockContainer);
            
            // Verify user message stored in background
            expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'ADD_MESSAGE',
                text: message,
                sender: 'user'
            });
            
            // Verify message sent to AI for processing
            expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'SEND_TEXT_MESSAGE',
                text: message
            });
        });

        it('shows typing indicator', () => {
            const message = 'Test message';
            global.ChatUI.getInputValue.mockReturnValue(message);

            window.ChatController.sendMessage(mockContainer);

            // Verify typing indicator is shown
            expect(global.MessageView.showTypingIndicator).toHaveBeenCalledWith(mockContainer);
        });

        it('does nothing when input is empty', () => {
            global.ChatUI.getInputValue.mockReturnValue('');

            window.ChatController.sendMessage(mockContainer);

            // Verify no actions taken
            expect(global.ChatUI.addMessage).not.toHaveBeenCalled();
            expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
            expect(global.MessageView.showTypingIndicator).not.toHaveBeenCalled();
        });

        it('does nothing when input is whitespace only', () => {
            // Mock ChatUI.getInputValue to return trimmed result (empty string)
            // This simulates the actual behavior where ChatView.getInputValue trims input
            global.ChatUI.getInputValue.mockReturnValue('');

            window.ChatController.sendMessage(mockContainer);

            // Verify no actions taken
            expect(global.ChatUI.addMessage).not.toHaveBeenCalled();
            expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
            expect(global.MessageView.showTypingIndicator).not.toHaveBeenCalled();
        });
    });

    describe('receiveResponse', () => {
        it('handles streaming responses', () => {
            const text = 'Streaming response part';
            const isComplete = false;
            
            // Mock typing state
            global.ConnectionState.isTyping.mockReturnValue(true);
            global.ConnectionState.getTypingId.mockReturnValue('typing-123');
            global.ConnectionState.getStreamingElement.mockReturnValue(null);

            window.ChatController.receiveResponse(text, isComplete);

            // Verify typing indicator is removed
            expect(global.MessageView.removeTypingIndicator).toHaveBeenCalledWith(mockContainer, 'typing-123');
            expect(global.ConnectionState.clearTyping).toHaveBeenCalled();
            
            // Verify response timeout is cleared
            expect(global.ConnectionState.clearResponseTimeout).toHaveBeenCalled();
            
            // Verify streaming message is started
            expect(global.MessageView.startStreamingMessage).toHaveBeenCalledWith(mockContainer, text);
            
            // Verify timeout is set for auto-finalization
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 15000);
            expect(global.ConnectionState.setResponseTimeout).toHaveBeenCalled();
        });

        it('finalizes complete responses', () => {
            const text = 'Complete response';
            const isComplete = true;
            
            // Mock typing state
            global.ConnectionState.isTyping.mockReturnValue(true);
            global.ConnectionState.getTypingId.mockReturnValue('typing-123');
            global.ConnectionState.getStreamingElement.mockReturnValue(null);

            window.ChatController.receiveResponse(text, isComplete);

            // Verify complete message is added directly
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, text, 'ai');
            
            // Verify no timeout is set for complete responses
            expect(global.setTimeout).not.toHaveBeenCalled();
        });

        it('stores AI message when streaming is finalized', () => {
            const text = 'Streaming response';
            
            // Mock existing streaming element with final text
            const mockStreamingElement = {
                textContent: 'Complete streaming response'
            };
            global.ConnectionState.getStreamingElement.mockReturnValue(mockStreamingElement);

            // Call receiveResponse with isComplete=true to trigger finalization
            window.ChatController.receiveResponse(text, true);

            // Verify streaming message is finalized
            expect(global.MessageView.finalizeStreamingMessage).toHaveBeenCalledWith(mockStreamingElement);
        });

        it('updates UI states correctly during streaming', () => {
            const text = ' continuation';
            const isComplete = false;
            
            // Mock existing streaming element
            const mockStreamingElement = {
                textContent: 'Previous text'
            };
            global.ConnectionState.getStreamingElement.mockReturnValue(mockStreamingElement);

            window.ChatController.receiveResponse(text, isComplete);

            // Verify streaming message is updated with combined text
            const expectedText = 'Previous text continuation';
            expect(global.MessageView.updateStreamingMessage).toHaveBeenCalledWith(mockStreamingElement, expectedText);
            
            // Verify recent area is updated
            expect(global.MessageView.updateRecentMessage).toHaveBeenCalledWith(mockContainer, expectedText);
        });

        it('handles missing container gracefully', () => {
            global.document.getElementById.mockReturnValue(null);

            expect(() => {
                window.ChatController.receiveResponse('test', false);
            }).not.toThrow();

            // Verify no UI updates attempted when container missing
            expect(global.MessageView.removeTypingIndicator).not.toHaveBeenCalled();
        });
    });

    describe('handleError', () => {
        it('clears indicators and shows error', () => {
            const error = 'Network connection failed';
            
            // Mock typing state
            global.ConnectionState.isTyping.mockReturnValue(true);
            global.ConnectionState.getTypingId.mockReturnValue('typing-456');
            
            // Mock streaming element
            const mockStreamingElement = { textContent: 'Partial response' };
            global.ConnectionState.getStreamingElement.mockReturnValue(mockStreamingElement);

            window.ChatController.handleError(error);

            // Verify typing indicator is removed
            expect(global.MessageView.removeTypingIndicator).toHaveBeenCalledWith(mockContainer, 'typing-456');
            expect(global.ConnectionState.clearTyping).toHaveBeenCalled();
            
            // Verify streaming is finalized
            expect(global.MessageView.finalizeStreamingMessage).toHaveBeenCalledWith(mockStreamingElement);
            expect(global.ConnectionState.clearResponseTimeout).toHaveBeenCalled();
            
            // Verify error message is shown
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, `Error: ${error}`, 'ai');
        });

        it('handles error message with Error: prefix', () => {
            const error = 'Error: API quota exceeded';

            window.ChatController.handleError(error);

            // Verify error message is not double-prefixed
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, error, 'ai');
        });

        it('handles missing container gracefully', () => {
            global.document.getElementById.mockReturnValue(null);

            expect(() => {
                window.ChatController.handleError('test error');
            }).not.toThrow();
        });
    });

    describe('changeState', () => {
        it('handles toggle-full action', () => {
            window.ChatController.changeState(mockContainer, 'toggle-full');

            expect(global.ChatUI.toggleFullChat).toHaveBeenCalledWith(mockContainer);
        });

        it('handles clear-chat action with confirmation', () => {
            global.confirm.mockReturnValue(true);

            window.ChatController.changeState(mockContainer, 'clear-chat');

            expect(global.confirm).toHaveBeenCalledWith('Clear all messages?');
            expect(global.ChatUI.clearChat).toHaveBeenCalledWith(mockContainer);
        });

        it('does not clear chat when user cancels', () => {
            global.confirm.mockReturnValue(false);

            window.ChatController.changeState(mockContainer, 'clear-chat');

            expect(global.confirm).toHaveBeenCalledWith('Clear all messages?');
            expect(global.ChatUI.clearChat).not.toHaveBeenCalled();
        });

        it('ignores unknown actions', () => {
            window.ChatController.changeState(mockContainer, 'unknown-action');

            // Verify no actions are taken for unknown action
            expect(global.ChatUI.toggleFullChat).not.toHaveBeenCalled();
            expect(global.ChatUI.clearChat).not.toHaveBeenCalled();
            expect(global.confirm).not.toHaveBeenCalled();
        });
    });

    describe('takeScreenshot', () => {
        it('sends system message', () => {
            window.ChatController.takeScreenshot(mockContainer);

            // Verify system message is added immediately
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, 'Screenshot sent', 'system');
            
            // Verify screenshot request is sent to background
            expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { type: 'TAKE_SCREENSHOT' },
                expect.any(Function)
            );
        });

        it('shows typing indicator on successful screenshot', () => {
            // Mock successful response
            const mockCallback = jest.fn();
            global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback({ success: true });
            });

            window.ChatController.takeScreenshot(mockContainer);

            // Verify typing indicator is shown for AI response
            expect(global.MessageView.showTypingIndicator).toHaveBeenCalledWith(mockContainer);
        });

        it('shows error message on screenshot failure', () => {
            // Mock failed response
            global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback({ success: false });
            });

            window.ChatController.takeScreenshot(mockContainer);

            // Verify error message is shown
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, 'Screenshot failed', 'system');
            expect(global.MessageView.showTypingIndicator).not.toHaveBeenCalled();
        });

        it('handles chrome runtime error', () => {
            // Mock chrome runtime error
            global.chrome.runtime.lastError = { message: 'Extension context invalidated' };
            global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback();
            });

            window.ChatController.takeScreenshot(mockContainer);

            // Verify error message is shown
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, 'Screenshot failed', 'system');
            expect(global.MessageView.showTypingIndicator).not.toHaveBeenCalled();
        });
    });

    describe('finalizeCurrentResponse', () => {
        it('cleans up state', () => {
            // Mock streaming element
            const mockStreamingElement = { textContent: 'Response text' };
            global.ConnectionState.getStreamingElement.mockReturnValue(mockStreamingElement);

            // Call the internal function (testing coordination behavior)
            window.ChatController.receiveResponse('final text', true);

            // Verify streaming message is finalized
            expect(global.MessageView.finalizeStreamingMessage).toHaveBeenCalledWith(mockStreamingElement);
            expect(global.ConnectionState.clearResponseTimeout).toHaveBeenCalled();
        });

        it('handles missing streaming element gracefully', () => {
            global.ConnectionState.getStreamingElement.mockReturnValue(null);

            // Call receiveResponse with complete=true to trigger finalize
            window.ChatController.receiveResponse('complete text', true);

            // Should not throw error when no streaming element
            expect(global.ConnectionState.clearResponseTimeout).toHaveBeenCalled();
        });
    });

    describe('response timeout handling', () => {
        it('sets timeout for incomplete responses', () => {
            global.ConnectionState.getStreamingElement.mockReturnValue(null);

            window.ChatController.receiveResponse('partial', false);

            // Verify timeout is set
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 15000);
            expect(global.ConnectionState.setResponseTimeout).toHaveBeenCalled();
        });

        it('executes timeout callback to finalize response', () => {
            // Mock streaming element for timeout scenario
            const mockStreamingElement = { textContent: 'Timed out response' };
            global.ConnectionState.getStreamingElement.mockReturnValue(mockStreamingElement);
            
            // Mock setTimeout to execute callback immediately
            global.setTimeout.mockImplementation((callback) => callback());

            window.ChatController.receiveResponse('partial', false);

            // Verify finalization is called due to timeout
            expect(global.MessageView.finalizeStreamingMessage).toHaveBeenCalledWith(mockStreamingElement);
        });
    });

    describe('edge cases', () => {
        it('handles rapid sendMessage calls', () => {
            const message1 = 'First message';
            const message2 = 'Second message';
            
            global.ChatUI.getInputValue
                .mockReturnValueOnce(message1)
                .mockReturnValueOnce(message2);

            // Send two messages rapidly
            window.ChatController.sendMessage(mockContainer);
            window.ChatController.sendMessage(mockContainer);

            // Verify both messages are processed
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, message1, 'user');
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, message2, 'user');
            // Each messagesends both ADD_MESSAGE and SEND_TEXT_MESSAGE (2 messages × 2 calls = 4 total)
            expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(4);
        });

        it('handles receiveResponse without typing indicator', () => {
            global.ConnectionState.isTyping.mockReturnValue(false);

            expect(() => {
                window.ChatController.receiveResponse('test', false);
            }).not.toThrow();

            // Should still process response normally
            expect(global.MessageView.startStreamingMessage).toHaveBeenCalled();
        });
    });
}); 