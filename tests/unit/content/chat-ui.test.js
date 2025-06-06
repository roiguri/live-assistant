const path = require('path');

require('../../config/test-helpers.js');

global.document = {
    createElement: jest.fn(() => ({
        innerHTML: '',
        setAttribute: jest.fn(),
        querySelector: jest.fn(),
        appendChild: jest.fn(),
        style: {}
    }))
};

global.window = {};

describe('ChatUI', () => {
    let mockContainer;

    beforeEach(() => {
        global.window.ChatState = {
            STATES: {
                MINIMAL: 'minimal',
                RECENT: 'recent',
                FULL: 'full'
            },
            addObserver: jest.fn(),
            setState: jest.fn(),
            setMessages: jest.fn(),
            getState: jest.fn(),
            getMessages: jest.fn(() => []),
            getLastMessage: jest.fn(),
            isMinimalState: jest.fn(),
            isRecentState: jest.fn(),
            isFullState: jest.fn()
        };

        global.window.ChatView = {
            renderContainer: jest.fn(),
            updateState: jest.fn(),
            addMessageToDOM: jest.fn(),
            clearInputDOM: jest.fn(),
            getInputValue: jest.fn(),
            clearMessagesDOM: jest.fn(),
            updateRecentArea: jest.fn()
        };

        require('../../../content/chat-ui.js');

        mockContainer = {
            innerHTML: '',
            setAttribute: jest.fn(),
            querySelector: jest.fn(),
            appendChild: jest.fn(),
            style: {}
        };
    });

    afterEach(() => {
        delete require.cache[require.resolve('../../../content/chat-ui.js')];
    });

    describe('createChatContainer', () => {
        it('returns proper DOM structure', () => {
            const mockElement = { id: 'assistant-chat' };
            window.ChatView.renderContainer.mockReturnValue(mockElement);

            const result = window.ChatUI.createChatContainer();

            expect(window.ChatView.renderContainer).toHaveBeenCalled();
            expect(result).toBe(mockElement);
        });
    });

    describe('addMessage', () => {
        it('updates DOM and handles state transitions', () => {
            const text = 'Hello world';
            const sender = 'user';

            window.ChatState.isMinimalState.mockReturnValue(false);
            window.ChatState.isRecentState.mockReturnValue(false);

            window.ChatUI.addMessage(mockContainer, text, sender);

            expect(window.ChatView.addMessageToDOM).toHaveBeenCalledWith(mockContainer, text, sender);
        });

        it('triggers state transitions correctly', () => {
            const text = 'AI response';
            const sender = 'ai';

            window.ChatState.isMinimalState.mockReturnValue(true);
            window.ChatState.isRecentState.mockReturnValue(false);
            window.ChatState.setState.mockReturnValue(true);

            window.ChatUI.addMessage(mockContainer, text, sender);

            expect(window.ChatState.setState).toHaveBeenCalledWith('recent');
            expect(window.ChatView.updateState).toHaveBeenCalledWith(mockContainer);
        });

        it('updates recent area when in recent state', () => {
            const text = 'Test message';
            const sender = 'user';

            window.ChatState.isMinimalState.mockReturnValue(false);
            window.ChatState.isRecentState.mockReturnValue(true);

            window.ChatUI.addMessage(mockContainer, text, sender);

            expect(window.ChatView.updateRecentArea).toHaveBeenCalledWith(mockContainer);
        });
    });

    describe('setState', () => {
        it('updates container and view', () => {
            const newState = 'full';
            window.ChatState.setState.mockReturnValue(true);

            window.ChatUI.setState(mockContainer, newState);

            expect(window.ChatState.setState).toHaveBeenCalledWith(newState);
            expect(window.ChatView.updateState).toHaveBeenCalledWith(mockContainer);
        });

        it('does nothing when setState returns false', () => {
            const newState = 'invalid';
            window.ChatState.setState.mockReturnValue(false);

            window.ChatUI.setState(mockContainer, newState);

            expect(window.ChatState.setState).toHaveBeenCalledWith(newState);
            expect(window.ChatView.updateState).not.toHaveBeenCalled();
        });
    });

    describe('toggleFullChat', () => {
        it('transitions between states correctly', () => {
            window.ChatState.setState.mockReturnValue(true);
            window.ChatState.isFullState.mockReturnValue(true);
            window.ChatState.getMessages.mockReturnValue([{ sender: 'ai', text: 'Hello' }]);
            window.ChatState.getLastMessage.mockReturnValue({ sender: 'ai', text: 'Hello' });

            window.ChatUI.toggleFullChat(mockContainer);

            expect(window.ChatState.setState).toHaveBeenCalledWith('recent');
            expect(window.ChatView.updateState).toHaveBeenCalledWith(mockContainer);
        });

        it('expands to full when not in full state', () => {
            window.ChatState.setState.mockReturnValue(true);
            window.ChatState.isFullState.mockReturnValue(false);

            window.ChatUI.toggleFullChat(mockContainer);

            expect(window.ChatState.setState).toHaveBeenCalledWith('full');
            expect(window.ChatView.updateState).toHaveBeenCalledWith(mockContainer);
        });

        it('collapses to minimal when no recent AI messages', () => {
            window.ChatState.setState.mockReturnValue(true);
            window.ChatState.isFullState.mockReturnValue(true);
            window.ChatState.getMessages.mockReturnValue([]);
            window.ChatState.getLastMessage.mockReturnValue({ sender: 'user', text: 'Hello' });

            window.ChatUI.toggleFullChat(mockContainer);

            expect(window.ChatState.setState).toHaveBeenCalledWith('minimal');
        });

        it('collapses to minimal when no messages', () => {
            window.ChatState.setState.mockReturnValue(true);
            window.ChatState.isFullState.mockReturnValue(true);
            window.ChatState.getMessages.mockReturnValue([]);
            window.ChatState.getLastMessage.mockReturnValue(null);

            window.ChatUI.toggleFullChat(mockContainer);

            expect(window.ChatState.setState).toHaveBeenCalledWith('minimal');
        });
    });

    describe('clearChat', () => {
        it('resets to minimal state', () => {
            window.ChatState.setState.mockReturnValue(true);

            window.ChatUI.clearChat(mockContainer);

            expect(window.ChatView.clearMessagesDOM).toHaveBeenCalledWith(mockContainer);
            expect(window.ChatState.setState).toHaveBeenCalledWith('minimal');
            expect(window.ChatView.updateState).toHaveBeenCalledWith(mockContainer);
        });
    });

    describe('getInputValue and clearInput', () => {
        it('work with DOM', () => {
            const testValue = 'test input';
            window.ChatView.getInputValue.mockReturnValue(testValue);

            const result = window.ChatUI.getInputValue(mockContainer);

            expect(window.ChatView.getInputValue).toHaveBeenCalledWith(mockContainer);
            expect(result).toBe(testValue);
        });

        it('clearInput works with DOM', () => {
            window.ChatUI.clearInput(mockContainer);

            expect(window.ChatView.clearInputDOM).toHaveBeenCalledWith(mockContainer);
        });
    });

    describe('state query methods', () => {
        it('delegate to ChatState', () => {
            const mockState = 'full';
            window.ChatState.getState.mockReturnValue(mockState);

            const result = window.ChatUI.getCurrentState();

            expect(window.ChatState.getState).toHaveBeenCalled();
            expect(result).toBe(mockState);
        });
    });

    describe('STATES constant', () => {
        it('exposes ChatState STATES', () => {
            expect(window.ChatUI.STATES).toStrictEqual(window.ChatState.STATES);
        });
    });
}); 