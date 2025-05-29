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
        closest: jest.fn(),
        remove: jest.fn(),
        scrollHeight: 100,
        scrollTop: 0
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
        body: {
            appendChild: jest.fn(),
            style: {}
        }
    }
});

// Mock window at module level
global.window = {
    innerHeight: 800
};

// Mock chrome at module level
global.chrome = {
    runtime: {
        sendMessage: jest.fn()
    }
};

// Mock dependencies at module level
global.ConnectionState = {
    setTyping: jest.fn(),
    setStreaming: jest.fn(),
    clearTyping: jest.fn()
};

global.ChatUI = {
    addMessage: jest.fn()
};

// Mock setTimeout/clearTimeout for typing indicator timeout
global.setTimeout = jest.fn();
global.clearTimeout = jest.fn();

// Load the module after mocks are set up
require('../../../../content/views/message-view.js');

describe('MessageView', () => {
    let mockContainer;
    let mockElements;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Clear createElement mock history
        mockCreateElement.mockClear();
        
        // Explicitly reset global window state that might affect calculations
        global.window = {
            innerHeight: 800
        };
        
        // Reset mock defaults
        global.ConnectionState.setTyping.mockReturnValue(undefined);
        global.ConnectionState.setStreaming.mockReturnValue(undefined);
        global.ConnectionState.clearTyping.mockReturnValue(undefined);
        global.ChatUI.addMessage.mockReturnValue(undefined);
        
        // Create mock elements
        mockElements = {
            messagesArea: {
                style: {},
                innerHTML: '',
                appendChild: jest.fn(),
                scrollHeight: 100,
                scrollTop: 0,
                querySelector: jest.fn()
            },
            recentArea: {
                style: {},
                innerHTML: '',
                textContent: ''
            },
            typingMessage: {
                className: '',
                textContent: '',
                setAttribute: jest.fn(),
                remove: jest.fn()
            },
            streamingMessage: {
                className: '',
                textContent: '',
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    contains: jest.fn()
                },
                closest: jest.fn()
            },
            lastMessage: {
                className: 'message message-ai',
                textContent: 'Last AI message',
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    contains: jest.fn()
                }
            }
        };

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
                height: 150
            }))
        };

        // Set up querySelector mock implementation
        mockContainer.querySelector.mockImplementation((selector) => {
            switch (selector) {
                case '.chat-messages': return mockElements.messagesArea;
                case '.chat-recent .recent-message': return mockElements.recentArea;
                case '.message-ai:last-child': return mockElements.lastMessage;
                default: 
                    if (selector.includes('[data-message-id=')) {
                        return mockElements.typingMessage;
                    }
                    return null;
            }
        });

        // Set up getAttribute mock
        mockContainer.getAttribute.mockImplementation((attr) => {
            if (attr === 'data-state') return 'recent';
            return null;
        });

        // Set up closest mock for streaming messages
        mockElements.streamingMessage.closest.mockReturnValue(mockElements.messagesArea);

        // Simple createElement mock: returns a fresh mock element by default
        mockCreateElement.mockImplementation((tag) => {
            const element = createMockElement();
            
            // If creating a container (div), set up the querySelector properly
            if (tag === 'div') {
                element.querySelector = mockContainer.querySelector;
            }
            
            return element;
        });
    });

    describe('showTypingIndicator', () => {
        it('creates and positions typing indicator', () => {
            // Mock Date.now for consistent typing ID
            const mockNow = 1640995200000;
            jest.spyOn(Date, 'now').mockReturnValue(mockNow);
            
            const result = window.MessageView.showTypingIndicator(mockContainer);

            // Verify typing ID is generated correctly
            expect(result).toBe(`typing-${mockNow}`);
            
            // Verify ConnectionState is updated
            expect(global.ConnectionState.setTyping).toHaveBeenCalledWith(`typing-${mockNow}`);
            
            // Verify createElement was called
            expect(mockCreateElement).toHaveBeenCalledWith('div');
            
            // Verify element was appended and scrolled
            expect(mockElements.messagesArea.appendChild).toHaveBeenCalled();
            expect(mockElements.messagesArea.scrollTop).toBe(100);
            
            // Verify timeout is set
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000);
            
            Date.now.mockRestore();
        });

        it('sets up typing message with correct properties', () => {
            const typingElement = createMockElement();
            mockCreateElement.mockReturnValueOnce(typingElement);
            
            window.MessageView.showTypingIndicator(mockContainer);

            expect(typingElement.className).toBe('message message-ai typing');
            expect(typingElement.textContent).toBe('AI is thinking...');
            expect(typingElement.setAttribute).toHaveBeenCalledWith('data-message-id', expect.stringContaining('typing-'));
        });
    });

    describe('removeTypingIndicator', () => {
        it('removes typing indicator element', () => {
            const typingId = 'typing-123456789';

            window.MessageView.removeTypingIndicator(mockContainer, typingId);

            expect(mockContainer.querySelector).toHaveBeenCalledWith(`[data-message-id="${typingId}"]`);
            expect(mockElements.typingMessage.remove).toHaveBeenCalled();
        });

        it('handles missing typing indicator gracefully', () => {
            mockContainer.querySelector.mockReturnValue(null);
            
            expect(() => {
                window.MessageView.removeTypingIndicator(mockContainer, 'non-existent');
            }).not.toThrow();
        });
    });

    describe('startStreamingMessage', () => {
        it('creates streaming element and sets up state', () => {
            const text = 'Starting response...';
            
            const result = window.MessageView.startStreamingMessage(mockContainer, text);

            // Verify ChatUI.addMessage was called
            expect(global.ChatUI.addMessage).toHaveBeenCalledWith(mockContainer, text, 'ai');
            
            // Verify streaming state is set
            expect(global.ConnectionState.setStreaming).toHaveBeenCalledWith(true, mockElements.lastMessage);
            
            // Verify streaming class is added
            expect(mockElements.lastMessage.classList.add).toHaveBeenCalledWith('streaming');
            
            // Verify correct element is returned
            expect(result).toBe(mockElements.lastMessage);
        });
    });

    describe('updateStreamingMessage', () => {
        it('updates text content and auto-scrolls', () => {
            const responseElement = mockElements.streamingMessage;
            const newText = 'Updated streaming text';
            
            window.MessageView.updateStreamingMessage(responseElement, newText);

            expect(responseElement.textContent).toBe(newText);
            expect(responseElement.closest).toHaveBeenCalledWith('.chat-messages');
            expect(mockElements.messagesArea.scrollTop).toBe(100);
        });

        it('handles null response element gracefully', () => {
            expect(() => {
                window.MessageView.updateStreamingMessage(null, 'text');
            }).not.toThrow();
        });

        it('handles missing messages area gracefully', () => {
            const responseElement = mockElements.streamingMessage;
            responseElement.closest.mockReturnValue(null);
            
            expect(() => {
                window.MessageView.updateStreamingMessage(responseElement, 'text');
            }).not.toThrow();
        });
    });

    describe('finalizeStreamingMessage', () => {
        it('removes streaming class and updates state', () => {
            const responseElement = mockElements.streamingMessage;
            
            window.MessageView.finalizeStreamingMessage(responseElement);

            expect(responseElement.classList.remove).toHaveBeenCalledWith('streaming');
            expect(global.ConnectionState.setStreaming).toHaveBeenCalledWith(false);
        });

        it('handles null response element gracefully', () => {
            expect(() => {
                window.MessageView.finalizeStreamingMessage(null);
            }).not.toThrow();
            
            expect(global.ConnectionState.setStreaming).toHaveBeenCalledWith(false);
        });
    });

    describe('updateRecentMessage', () => {
        it('updates recent area when in recent state', () => {
            const text = 'Updated recent message';
            mockContainer.getAttribute.mockReturnValue('recent');
            
            window.MessageView.updateRecentMessage(mockContainer, text);

            expect(mockContainer.getAttribute).toHaveBeenCalledWith('data-state');
            expect(mockContainer.querySelector).toHaveBeenCalledWith('.chat-recent .recent-message');
            expect(mockElements.recentArea.textContent).toBe(text);
        });

        it('does nothing when not in recent state', () => {
            mockContainer.getAttribute.mockReturnValue('full');
            
            window.MessageView.updateRecentMessage(mockContainer, 'text');

            expect(mockContainer.querySelector).not.toHaveBeenCalledWith('.chat-recent .recent-message');
        });

        it('handles missing recent area gracefully', () => {
            mockContainer.getAttribute.mockReturnValue('recent');
            mockContainer.querySelector.mockReturnValue(null);
            
            expect(() => {
                window.MessageView.updateRecentMessage(mockContainer, 'text');
            }).not.toThrow();
        });
    });

    describe('scrollToBottom', () => {
        it('scrolls messages area to bottom', () => {
            window.MessageView.scrollToBottom(mockContainer);

            expect(mockContainer.querySelector).toHaveBeenCalledWith('.chat-messages');
            expect(mockElements.messagesArea.scrollTop).toBe(100);
        });

        it('handles missing messages area gracefully', () => {
            mockContainer.querySelector.mockReturnValue(null);
            
            expect(() => {
                window.MessageView.scrollToBottom(mockContainer);
            }).not.toThrow();
        });
    });

    describe('getLastMessageElement', () => {
        it('returns last AI message element', () => {
            const result = window.MessageView.getLastMessageElement(mockContainer);

            expect(mockContainer.querySelector).toHaveBeenCalledWith('.message-ai:last-child');
            expect(result).toBe(mockElements.lastMessage);
        });
    });

    describe('message class manipulation', () => {
        it('addMessageClass adds class when element exists', () => {
            const element = mockElements.lastMessage;
            
            window.MessageView.addMessageClass(element, 'test-class');

            expect(element.classList.add).toHaveBeenCalledWith('test-class');
        });

        it('addMessageClass handles null element gracefully', () => {
            expect(() => {
                window.MessageView.addMessageClass(null, 'test-class');
            }).not.toThrow();
        });

        it('removeMessageClass removes class when element exists', () => {
            const element = mockElements.lastMessage;
            
            window.MessageView.removeMessageClass(element, 'test-class');

            expect(element.classList.remove).toHaveBeenCalledWith('test-class');
        });

        it('removeMessageClass handles null element gracefully', () => {
            expect(() => {
                window.MessageView.removeMessageClass(null, 'test-class');
            }).not.toThrow();
        });

        it('hasMessageClass returns correct boolean', () => {
            const element = mockElements.lastMessage;
            element.classList.contains.mockReturnValue(true);
            
            const result = window.MessageView.hasMessageClass(element, 'test-class');

            expect(element.classList.contains).toHaveBeenCalledWith('test-class');
            expect(result).toBe(true);
        });

        it('hasMessageClass returns false for null element', () => {
            const result = window.MessageView.hasMessageClass(null, 'test-class');
            expect(result).toBe(false);
        });
    });

    describe('auto-scroll behavior', () => {
        it('auto-scrolls during typing indicator', () => {
            window.MessageView.showTypingIndicator(mockContainer);

            expect(mockElements.messagesArea.scrollTop).toBe(100);
        });

        it('auto-scrolls during streaming updates', () => {
            const responseElement = mockElements.streamingMessage;
            
            window.MessageView.updateStreamingMessage(responseElement, 'New text');

            expect(mockElements.messagesArea.scrollTop).toBe(100);
        });
    });
}); 