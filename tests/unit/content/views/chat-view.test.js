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
        querySelector: jest.fn()
    };
    return element;
};

const mockCreateElement = jest.fn();

// IMPORTANT: Set up document mock BEFORE loading the module
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
global.ChatState = {
    getState: jest.fn(),
    getLastMessage: jest.fn(),
    isRecentState: jest.fn(),
    isFullState: jest.fn()
};

global.MenuView = {
    positionMenu: jest.fn()
};

// Load the module after mocks are set up
require('../../../../content/views/chat-view.js');

describe('ChatView', () => {
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
        global.ChatState.getState.mockReturnValue('minimal');
        global.ChatState.getLastMessage.mockReturnValue(null);
        global.ChatState.isRecentState.mockReturnValue(false);
        global.ChatState.isFullState.mockReturnValue(false);
        
        // Create mock elements
        mockElements = {
            messagesArea: { 
                style: {}, 
                innerHTML: '', 
                appendChild: jest.fn(), 
                scrollHeight: 100, 
                scrollTop: 0 
            },
            recentArea: { 
                style: {}, 
                innerHTML: '' 
            },
            titlePanel: { 
                style: {} 
            },
            statusElement: { 
                style: {}, 
                querySelector: jest.fn() 
            },
            indicator: { 
                className: '' 
            },
            text: { 
                textContent: '' 
            },
            reconnectBtn: { 
                style: {}, 
                addEventListener: jest.fn(), 
                disabled: false, 
                textContent: '' 
            },
            input: { 
                value: '  test input  ' 
            },
            menuItem: { 
                textContent: '' 
            }
        };

        // Create mock container with fresh style object
        mockContainer = {
            id: 'assistant-chat',
            innerHTML: '',
            setAttribute: jest.fn(),
            querySelector: jest.fn(),
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
                case '.chat-recent': return mockElements.recentArea;
                case '.title-panel': return mockElements.titlePanel;
                case '.connection-status': return mockElements.statusElement;
                case '.status-indicator': return mockElements.indicator;
                case '.status-text': return mockElements.text;
                case '.reconnect-btn': return mockElements.reconnectBtn;
                case '.chat-input': return mockElements.input;
                case '[data-action="toggle-full"] .menu-text': return mockElements.menuItem;
                default: return null;
            }
        });

        // Set up nested querySelector for status element
        mockElements.statusElement.querySelector.mockImplementation((selector) => {
            switch (selector) {
                case '.status-indicator': return mockElements.indicator;
                case '.status-text': return mockElements.text;
                case '.reconnect-btn': return mockElements.reconnectBtn;
                default: return null;
            }
        });

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

    describe('renderContainer', () => {
        it('creates container with correct properties', () => {
            const result = window.ChatView.renderContainer();

            // Check that a container was returned with expected properties
            expect(result).toBeDefined();
            expect(result.id).toBe('assistant-chat');
            expect(mockCreateElement).toHaveBeenCalledWith('div');
            // The container should have innerHTML set (containing chat-main structure)
            expect(result.innerHTML).toContain('chat-main');
            // Check that setupReconnectButton was called (which sets up event listener)
            expect(mockElements.reconnectBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });
    });

    describe('updateState', () => {
        it('shows/hides correct areas in recent state', () => {
            global.ChatState.getState.mockReturnValue('recent');
            global.ChatState.isRecentState.mockReturnValue(true);
            global.ChatState.isFullState.mockReturnValue(false);

            window.ChatView.updateState(mockContainer);

            expect(mockContainer.setAttribute).toHaveBeenCalledWith('data-state', 'recent');
            expect(mockElements.messagesArea.style.display).toBe('none');
            expect(mockElements.recentArea.style.display).toBe('block');
            expect(mockElements.titlePanel.style.display).toBe('flex');
            expect(global.MenuView.positionMenu).toHaveBeenCalledWith(mockContainer);
        });

        it('shows full messages area in full state', () => {
            global.ChatState.getState.mockReturnValue('full');
            global.ChatState.isRecentState.mockReturnValue(false);
            global.ChatState.isFullState.mockReturnValue(true);

            window.ChatView.updateState(mockContainer);

            expect(mockContainer.setAttribute).toHaveBeenCalledWith('data-state', 'full');
            expect(mockElements.messagesArea.style.display).toBe('block');
            expect(mockElements.recentArea.style.display).toBe('none');
            expect(mockElements.titlePanel.style.display).toBe('flex');
        });

        it('hides everything in minimal state', () => {
            global.ChatState.getState.mockReturnValue('minimal');
            global.ChatState.isRecentState.mockReturnValue(false);
            global.ChatState.isFullState.mockReturnValue(false);

            window.ChatView.updateState(mockContainer);

            expect(mockContainer.setAttribute).toHaveBeenCalledWith('data-state', 'minimal');
            expect(mockElements.messagesArea.style.display).toBe('none');
            expect(mockElements.recentArea.style.display).toBe('none');
            expect(mockElements.titlePanel.style.display).toBe('none');
        });
    });

    describe('addMessageToDOM', () => {
        it('creates message element and adds to container', () => {
            // Create a fresh spy for this test to track what element is created
            const messageElementSpy = createMockElement();
            mockCreateElement.mockReturnValueOnce(messageElementSpy);
            
            window.ChatView.addMessageToDOM(mockContainer, 'Hello world', 'user');

            // Verify createElement was called to create a div for the message
            expect(mockCreateElement).toHaveBeenCalledWith('div');
            
            // Verify the message element was configured correctly
            expect(messageElementSpy.className).toBe('message message-user');
            expect(messageElementSpy.textContent).toBe('Hello world');
            
            // Verify it was appended to the messages area
            expect(mockElements.messagesArea.appendChild).toHaveBeenCalledWith(messageElementSpy);
            // Verify scrolling behavior
            expect(mockElements.messagesArea.scrollTop).toBe(100);
        });

        it('defaults sender to user when not specified', () => {
            // Create a fresh spy for this test to track what element is created
            const messageElementSpy = createMockElement();
            mockCreateElement.mockReturnValueOnce(messageElementSpy);
            
            window.ChatView.addMessageToDOM(mockContainer, 'Hello');

            // Verify createElement was called to create a div for the message
            expect(mockCreateElement).toHaveBeenCalledWith('div');
            
            // Verify the message element was configured correctly
            expect(messageElementSpy.className).toBe('message message-user');
            expect(messageElementSpy.textContent).toBe('Hello');
            
            // Verify it was appended to the messages area
            expect(mockElements.messagesArea.appendChild).toHaveBeenCalledWith(messageElementSpy);
        });
    });

    describe('clearMessagesDOM', () => {
        it('resets to welcome message', () => {
            window.ChatView.clearMessagesDOM(mockContainer);

            expect(mockElements.messagesArea.innerHTML).toBe('<div class="welcome-message">Hello! I\'m your AI assistant.</div>');
        });
    });

    describe('updateRecentArea', () => {
        it('shows last AI message', () => {
            global.ChatState.getLastMessage.mockReturnValue({
                sender: 'ai',
                text: 'Hello from AI'
            });

            window.ChatView.updateRecentArea(mockContainer);

            expect(mockElements.recentArea.innerHTML).toContain('message-ai recent-message');
            expect(mockElements.recentArea.innerHTML).toContain('Hello from AI');
        });

        it('clears area when no AI message', () => {
            global.ChatState.getLastMessage.mockReturnValue({
                sender: 'user',
                text: 'Hello from user'
            });

            window.ChatView.updateRecentArea(mockContainer);

            expect(mockElements.recentArea.innerHTML).toBe('');
        });

        it('clears area when no messages', () => {
            global.ChatState.getLastMessage.mockReturnValue(null);

            window.ChatView.updateRecentArea(mockContainer);

            expect(mockElements.recentArea.innerHTML).toBe('');
        });
    });

    describe('ensureWithinViewport', () => {
        it('constrains position when too high', () => {
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: -20,
                bottom: 130,
                height: 150
            });

            window.ChatView.ensureWithinViewport(mockContainer);

            expect(mockContainer.style.top).toBe('10px');
            expect(mockContainer.style.bottom).toBe('auto');
        });

        it('constrains position when too low', () => {
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: 700,
                bottom: 850,
                height: 150
            });

            window.ChatView.ensureWithinViewport(mockContainer);

            expect(mockContainer.style.top).toBe('608px');
            expect(mockContainer.style.bottom).toBe('auto');
        });

        it('leaves position unchanged when in viewport', () => {
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: 100,
                bottom: 250,
                height: 150
            });
            mockContainer.style.top = '';

            window.ChatView.ensureWithinViewport(mockContainer);

            expect(mockContainer.style.top).toBe('');
        });
    });

    describe('updateConnectionStatus', () => {
        it('shows correct indicators for connecting state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'connecting');

            expect(mockElements.statusElement.style.display).toBe('flex');
            expect(mockElements.indicator.className).toBe('status-indicator connecting');
            expect(mockElements.text.textContent).toBe('Connecting...');
            expect(mockElements.reconnectBtn.style.display).toBe('none');
        });

        it('handles connected state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'connected');

            expect(mockElements.statusElement.style.display).toBe('none');
            expect(mockElements.indicator.className).toBe('status-indicator connected');
            expect(mockElements.text.textContent).toBe('Connected');
        });

        it('handles disconnected state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'disconnected');

            expect(mockElements.statusElement.style.display).toBe('flex');
            expect(mockElements.indicator.className).toBe('status-indicator disconnected');
            expect(mockElements.text.textContent).toBe('Disconnected');
            expect(mockElements.reconnectBtn.style.display).toBe('none');
        });

        it('shows reconnect button when canReconnect is true', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'disconnected', true);

            expect(mockElements.reconnectBtn.style.display).toBe('inline-block');
        });

        it('handles failed state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'failed', true);

            expect(mockElements.statusElement.style.display).toBe('flex');
            expect(mockElements.indicator.className).toBe('status-indicator failed');
            expect(mockElements.text.textContent).toBe('Connection failed');
            expect(mockElements.reconnectBtn.style.display).toBe('inline-block');
        });
    });

    describe('input handling', () => {
        it('getInputValue trims whitespace', () => {
            const result = window.ChatView.getInputValue(mockContainer);

            expect(result).toBe('test input');
        });

        it('clearInputDOM clears input value', () => {
            window.ChatView.clearInputDOM(mockContainer);

            expect(mockElements.input.value).toBe('');
        });
    });

    describe('menu text updates', () => {
        it('updates menu text based on state', () => {
            global.ChatState.isFullState.mockReturnValue(true);

            window.ChatView.updateState(mockContainer);

            expect(mockElements.menuItem.textContent).toBe('Minimize chat');
        });

        it('handles missing menu item gracefully', () => {
            const mockContainerWithoutMenuText = {
                ...mockContainer,
                querySelector: jest.fn((selector) => {
                    if (selector === '[data-action="toggle-full"] .menu-text') {
                        return null;
                    }
                    return mockContainer.querySelector(selector);
                })
            };

            expect(() => {
                window.ChatView.updateState(mockContainerWithoutMenuText);
            }).not.toThrow();
        });
    });
}); 