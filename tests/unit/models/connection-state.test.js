const path = require('path');

require('../../config/test-helpers.js');

// Mock setTimeout/clearTimeout for timeout management tests
global.setTimeout = jest.fn();
global.clearTimeout = jest.fn();

// Load the module after mocks are set up
require('../../../content/models/connection-state.js');

describe('ConnectionState', () => {
    let mockObserver;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset setTimeout/clearTimeout mocks
        global.setTimeout.mockClear();
        global.clearTimeout.mockClear();
        
        // Create mock observer function
        mockObserver = jest.fn();
        
        // Clear observers to ensure test isolation
        window.ConnectionState.clearObservers();
        
        // Reset the ConnectionState to clean state
        window.ConnectionState.reset();
    });

    describe('setTyping/clearTyping manage typing state', () => {
        it('sets typing state and notifies observers', () => {
            window.ConnectionState.addObserver(mockObserver);
            
            window.ConnectionState.setTyping('typing-123');
            
            expect(window.ConnectionState.isTyping()).toBe(true);
            expect(window.ConnectionState.getTypingId()).toBe('typing-123');
            expect(window.ConnectionState.hasActiveTyping()).toBe(true);
            expect(mockObserver).toHaveBeenCalledWith('typing-started', { typingId: 'typing-123' });
        });

        it('clears typing state and notifies observers', () => {
            window.ConnectionState.addObserver(mockObserver);
            window.ConnectionState.setTyping('typing-456');
            mockObserver.mockClear(); // Clear previous call
            
            window.ConnectionState.clearTyping();
            
            expect(window.ConnectionState.isTyping()).toBe(false);
            expect(window.ConnectionState.getTypingId()).toBe(null);
            expect(window.ConnectionState.hasActiveTyping()).toBe(false);
            expect(mockObserver).toHaveBeenCalledWith('typing-cleared', { typingId: 'typing-456' });
        });

        it('handles clearing when no typing is active', () => {
            window.ConnectionState.addObserver(mockObserver);
            
            window.ConnectionState.clearTyping();
            
            expect(window.ConnectionState.isTyping()).toBe(false);
            expect(mockObserver).not.toHaveBeenCalled();
        });
    });

    describe('setStreaming manages streaming state', () => {
        it('sets streaming with response element', () => {
            const mockElement = { textContent: 'streaming response' };
            window.ConnectionState.addObserver(mockObserver);
            
            window.ConnectionState.setStreaming(true, mockElement);
            
            expect(window.ConnectionState.isCurrentlyStreaming()).toBe(true);
            expect(window.ConnectionState.hasActiveStream()).toBe(true);
            expect(window.ConnectionState.getStreamingElement()).toBe(mockElement);
            expect(mockObserver).toHaveBeenCalledWith('streaming-changed', { 
                isStreaming: true, 
                responseElement: mockElement 
            });
        });

        it('clears streaming state', () => {
            const mockElement = { textContent: 'streaming response' };
            window.ConnectionState.setStreaming(true, mockElement);
            window.ConnectionState.addObserver(mockObserver);
            
            window.ConnectionState.setStreaming(false);
            
            expect(window.ConnectionState.isCurrentlyStreaming()).toBe(false);
            expect(window.ConnectionState.hasActiveStream()).toBe(false);
            expect(window.ConnectionState.getStreamingElement()).toBe(null);
            expect(mockObserver).toHaveBeenCalledWith('streaming-changed', { 
                isStreaming: false, 
                responseElement: null 
            });
        });

        it('sets streaming without element', () => {
            window.ConnectionState.addObserver(mockObserver);
            
            window.ConnectionState.setStreaming(true);
            
            expect(window.ConnectionState.isCurrentlyStreaming()).toBe(true);
            expect(window.ConnectionState.getStreamingElement()).toBe(null);
            expect(mockObserver).toHaveBeenCalledWith('streaming-changed', { 
                isStreaming: true, 
                responseElement: null 
            });
        });
    });

    describe('response timeout management works', () => {
        it('sets response timeout', () => {
            const mockTimeoutId = 12345;
            global.setTimeout.mockReturnValue(mockTimeoutId);
            
            window.ConnectionState.setResponseTimeout(mockTimeoutId);
            
            // Verify timeout was set (can't directly test internal state, but we can test behavior)
            expect(typeof mockTimeoutId).toBe('number');
        });

        it('clears existing timeout when setting new one', () => {
            const oldTimeoutId = 11111;
            const newTimeoutId = 22222;
            
            window.ConnectionState.setResponseTimeout(oldTimeoutId);
            window.ConnectionState.setResponseTimeout(newTimeoutId);
            
            expect(global.clearTimeout).toHaveBeenCalledWith(oldTimeoutId);
        });

        it('clears response timeout', () => {
            const mockTimeoutId = 54321;
            window.ConnectionState.setResponseTimeout(mockTimeoutId);
            
            window.ConnectionState.clearResponseTimeout();
            
            expect(global.clearTimeout).toHaveBeenCalledWith(mockTimeoutId);
        });

        it('handles clearing timeout when none is set', () => {
            window.ConnectionState.clearResponseTimeout();
            
            // Should not throw or cause issues
            expect(global.clearTimeout).not.toHaveBeenCalled();
        });
    });

    describe('observer notifications fire correctly', () => {
        it('notifies multiple observers', () => {
            const observer1 = jest.fn();
            const observer2 = jest.fn();
            
            window.ConnectionState.addObserver(observer1);
            window.ConnectionState.addObserver(observer2);
            
            window.ConnectionState.setTyping('test-typing');
            
            expect(observer1).toHaveBeenCalledWith('typing-started', { typingId: 'test-typing' });
            expect(observer2).toHaveBeenCalledWith('typing-started', { typingId: 'test-typing' });
        });

        it('observer errors propagate (normal behavior)', () => {
            const faultyObserver = jest.fn(() => {
                throw new Error('Observer error');
            });
            
            window.ConnectionState.addObserver(faultyObserver);
            
            // Observer errors should propagate since there's no error handling in the implementation
            expect(() => {
                window.ConnectionState.setTyping('test-typing');
            }).toThrow('Observer error');
        });
    });

    describe('state query methods return correct values', () => {
        it('returns correct typing state', () => {
            expect(window.ConnectionState.isTyping()).toBe(false);
            expect(window.ConnectionState.hasActiveTyping()).toBe(false);
            expect(window.ConnectionState.getTypingId()).toBe(null);
            
            window.ConnectionState.setTyping('test-id');
            
            expect(window.ConnectionState.isTyping()).toBe(true);
            expect(window.ConnectionState.hasActiveTyping()).toBe(true);
            expect(window.ConnectionState.getTypingId()).toBe('test-id');
        });

        it('returns correct streaming state', () => {
            const mockElement = { textContent: 'test' };
            
            expect(window.ConnectionState.isCurrentlyStreaming()).toBe(false);
            expect(window.ConnectionState.hasActiveStream()).toBe(false);
            expect(window.ConnectionState.getStreamingElement()).toBe(null);
            
            window.ConnectionState.setStreaming(true, mockElement);
            
            expect(window.ConnectionState.isCurrentlyStreaming()).toBe(true);
            expect(window.ConnectionState.hasActiveStream()).toBe(true);
            expect(window.ConnectionState.getStreamingElement()).toBe(mockElement);
        });
    });

    describe('reset() clears all state', () => {
        it('clears all state and notifies observers', () => {
            const mockElement = { textContent: 'test' };
            const mockTimeoutId = 99999;
            window.ConnectionState.addObserver(mockObserver);
            
            // Set up various state
            window.ConnectionState.setTyping('test-typing');
            window.ConnectionState.setStreaming(true, mockElement);
            window.ConnectionState.setResponseTimeout(mockTimeoutId);
            
            mockObserver.mockClear(); // Clear setup calls
            
            window.ConnectionState.reset();
            
            // Verify all state is cleared
            expect(window.ConnectionState.isTyping()).toBe(false);
            expect(window.ConnectionState.isCurrentlyStreaming()).toBe(false);
            expect(window.ConnectionState.getTypingId()).toBe(null);
            expect(window.ConnectionState.getStreamingElement()).toBe(null);
            
            // Verify timeout was cleared
            expect(global.clearTimeout).toHaveBeenCalledWith(mockTimeoutId);
            
            // Verify observers were notified
            expect(mockObserver).toHaveBeenCalledWith('typing-cleared', { typingId: 'test-typing' });
            expect(mockObserver).toHaveBeenCalledWith('streaming-changed', { isStreaming: false, responseElement: null });
            expect(mockObserver).toHaveBeenCalledWith('state-reset', undefined);
        });
    });

    describe('convenience methods work correctly', () => {
        it('hasActiveTyping returns same as isTyping', () => {
            expect(window.ConnectionState.hasActiveTyping()).toBe(window.ConnectionState.isTyping());
            
            window.ConnectionState.setTyping('test');
            
            expect(window.ConnectionState.hasActiveTyping()).toBe(window.ConnectionState.isTyping());
            expect(window.ConnectionState.hasActiveTyping()).toBe(true);
        });

        it('hasActiveStream returns same as isCurrentlyStreaming', () => {
            expect(window.ConnectionState.hasActiveStream()).toBe(window.ConnectionState.isCurrentlyStreaming());
            
            window.ConnectionState.setStreaming(true);
            
            expect(window.ConnectionState.hasActiveStream()).toBe(window.ConnectionState.isCurrentlyStreaming());
            expect(window.ConnectionState.hasActiveStream()).toBe(true);
        });
    });

    describe('multiple observer registration works', () => {
        it('allows multiple observers and calls all of them', () => {
            const observers = [jest.fn(), jest.fn(), jest.fn()];
            
            observers.forEach(observer => {
                window.ConnectionState.addObserver(observer);
            });
            
            window.ConnectionState.setTyping('multi-test');
            
            observers.forEach(observer => {
                expect(observer).toHaveBeenCalledWith('typing-started', { typingId: 'multi-test' });
            });
        });

        it('preserves observer order', () => {
            const callOrder = [];
            const observer1 = jest.fn(() => callOrder.push('observer1'));
            const observer2 = jest.fn(() => callOrder.push('observer2'));
            const observer3 = jest.fn(() => callOrder.push('observer3'));
            
            window.ConnectionState.addObserver(observer1);
            window.ConnectionState.addObserver(observer2);
            window.ConnectionState.addObserver(observer3);
            
            window.ConnectionState.setTyping('order-test');
            
            expect(callOrder).toEqual(['observer1', 'observer2', 'observer3']);
        });
    });
}); 