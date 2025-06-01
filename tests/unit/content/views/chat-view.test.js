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
        
        // Assign the mock to the JSDOM document's createElement
        // This needs to be done in beforeEach after mocks are cleared and document is available
        document.createElement = mockCreateElement;
        
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
            connectionDot: {
                className: ''
            },
            refreshBtn: { // New
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
                case '.connection-dot': return mockElements.connectionDot;
                case '.refresh-btn': return mockElements.refreshBtn;
                case '.chat-input': return mockElements.input;
                case '[data-action="toggle-full"] .menu-text': return mockElements.menuItem;
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
            // Check that setupTitleBarControls was called (which sets up event listener on refreshBtn)
            expect(mockElements.refreshBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
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
            expect(mockElements.recentArea.innerHTML).toContain('<p>Hello from AI</p>');
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
        it('sets correct class for connection dot in connecting state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'connecting');
            expect(mockElements.connectionDot.className).toBe('connection-dot connecting');
        });
        
        it('sets correct class for connection dot in reconnecting state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'reconnecting');
            expect(mockElements.connectionDot.className).toBe('connection-dot connecting');
        });

        it('sets correct class for connection dot in connected state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'connected');
            expect(mockElements.connectionDot.className).toBe('connection-dot connected');
        });

        it('sets correct class for connection dot in disconnected state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'disconnected');
            expect(mockElements.connectionDot.className).toBe('connection-dot failed');
        });

        it('sets correct class for connection dot in failed state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'failed');
            expect(mockElements.connectionDot.className).toBe('connection-dot failed');
        });

        it('sets default class for connection dot for unknown state (shows connecting appearance)', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'unknown');
            expect(mockElements.connectionDot.className).toBe('connection-dot');
        });
        
        it('does not throw if connectionDot is not found', () => {
            mockContainer.querySelector.mockImplementation((selector) => {
                 if (selector === '.connection-dot') return null;
                 return mockElements.refreshBtn;
            });
            expect(() => window.ChatView.updateConnectionStatus(mockContainer, 'connected')).not.toThrow();
        });

        it('shows refresh button when connection failed', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'failed');
            expect(mockElements.refreshBtn.style.display).toBe('flex');
        });

        it('shows refresh button when connection disconnected', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'disconnected');
            expect(mockElements.refreshBtn.style.display).toBe('flex');
        });

        it('hides refresh button when connection connected', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'connected');
            expect(mockElements.refreshBtn.style.display).toBe('none');
        });

        it('hides refresh button when connection connecting', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'connecting');
            expect(mockElements.refreshBtn.style.display).toBe('none');
        });

        it('hides refresh button when connection reconnecting', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'reconnecting');
            expect(mockElements.refreshBtn.style.display).toBe('none');
        });

        it('hides refresh button for unknown connection state', () => {
            window.ChatView.updateConnectionStatus(mockContainer, 'unknown');
            expect(mockElements.refreshBtn.style.display).toBe('none');
        });

        it('does not throw if refresh button is not found', () => {
            mockContainer.querySelector.mockImplementation((selector) => {
                if (selector === '.refresh-btn') return null;
                if (selector === '.connection-dot') return mockElements.connectionDot;
                return null;
            });
            expect(() => window.ChatView.updateConnectionStatus(mockContainer, 'failed')).not.toThrow();
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