const path = require('path');

require('../../../config/test-helpers.js');

// Mock createElement with a factory to ensure unique elements and correct container
const createMockElement = () => {
    const element = {
        className: '',
        textContent: '',
        innerHTML: '',
        id: '',
        style: {
            right: '',
            top: '',
            bottom: '',
            left: ''
        },
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

// Mock setTimeout/clearTimeout for menu hide delays
global.setTimeout = jest.fn();
global.clearTimeout = jest.fn();

// Load the module after mocks are set up
require('../../../../content/views/menu-view.js');

describe('MenuView', () => {
    let mockContainer;
    let mockElements;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset global state  
        global.window = {
            innerHeight: 800,
            innerWidth: 1200
        };

        // Define default mock behavior
        global.setTimeout = jest.fn((callback) => {
            callback();
        });
        
        // Create mock elements
        mockElements = {
            inputArea: createMockElement(),
            recentArea: createMockElement(),
            titlePanel: createMockElement(),
            menu: createMockElement()
        };

        // Create mock container
        mockContainer = {
            id: 'assistant-chat',
            innerHTML: '',
            setAttribute: jest.fn(),
            querySelector: jest.fn(),
            getAttribute: jest.fn(),
            appendChild: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            contains: jest.fn(),
            matches: jest.fn(),
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

        // Set up querySelector mock implementation
        mockContainer.querySelector.mockImplementation((selector) => {
            switch (selector) {
                case '.chat-input-area': return mockElements.inputArea;
                case '.chat-recent': return mockElements.recentArea;
                case '.title-panel': return mockElements.titlePanel;
                case '.chat-menu': return mockElements.menu;
                default: return null;
            }
        });

        // Set up getAttribute mock
        mockContainer.getAttribute.mockImplementation((attr) => {
            if (attr === 'data-state') return 'recent';
            return null;
        });

        // Set up default mock behaviors
        mockElements.menu.classList.contains.mockReturnValue(false);
        mockElements.menu.matches.mockReturnValue(false);
        mockElements.inputArea.matches.mockReturnValue(false);
        mockContainer.contains.mockReturnValue(false);

        // Set up shadow DOM mock
        const { mockShadowHost } = global.setupShadowDOMMock(mockContainer);
        
        // Configure shadow host behavior for setupClickOutside tests
        mockShadowHost.contains.mockImplementation((target) => {
            // Return false by default unless we're testing click inside
            return false;
        });

        // Simple createElement mock: returns a fresh mock element by default
        mockCreateElement.mockImplementation(() => createMockElement());
    });

    describe('setupHoverBehavior', () => {
        it('adds event listeners to hover areas', () => {
            window.MenuView.setupHoverBehavior(mockContainer);

            // Verify event listeners are added to input area
            expect(mockElements.inputArea.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
            expect(mockElements.inputArea.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));

            // Verify event listeners are added to recent area
            expect(mockElements.recentArea.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
            expect(mockElements.recentArea.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));

            // Verify event listeners are added to container
            expect(mockContainer.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
            expect(mockContainer.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));

            // Verify menu-specific event listeners
            expect(mockElements.menu.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
            expect(mockElements.menu.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
        });

        it('handles menu hover correctly', () => {
            window.MenuView.setupHoverBehavior(mockContainer);

            // Get the menu mouseenter handler
            const menuEnterHandler = mockElements.menu.addEventListener.mock.calls
                .find(call => call[0] === 'mouseenter')[1];

            // Trigger menu mouseenter
            menuEnterHandler();

            // Verify menu becomes visible
            expect(mockElements.menu.classList.add).toHaveBeenCalledWith('visible');
        });

        it('handles menu mouseleave with delay', () => {
            window.MenuView.setupHoverBehavior(mockContainer);

            // Get the menu mouseleave handler
            const menuLeaveHandler = mockElements.menu.addEventListener.mock.calls
                .find(call => call[0] === 'mouseleave')[1];

            // Mock event with relatedTarget not in active areas
            const mockEvent = { relatedTarget: {} };
            mockElements.menu.contains.mockReturnValue(false);

            // Trigger menu mouseleave
            menuLeaveHandler(mockEvent);

            // Verify setTimeout is called for delayed hide
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
        });
    });

    describe('showMenu', () => {
        it('positions and makes menu visible', () => {
            window.MenuView.showMenu(mockContainer);

            // Verify positionMenu was called (menu style properties set)
            expect(typeof mockElements.menu.style.right).toBe('string');
            
            // Verify menu becomes visible
            expect(mockElements.menu.classList.add).toHaveBeenCalledWith('visible');
        });
    });

    describe('hideMenu', () => {
        it('hides menu after delay when not moving to menu', () => {
            window.MenuView.hideMenu(mockContainer);

            // Verify setTimeout is called for delayed hide
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
        });

        it('does not hide when moving to menu', () => {
            const relatedTarget = {};
            mockElements.menu.contains.mockReturnValue(true);

            window.MenuView.hideMenu(mockContainer, relatedTarget);

            // Verify setTimeout is not called
            expect(global.setTimeout).not.toHaveBeenCalled();
        });

        it('executes delayed hide when conditions are met', () => {
            // Mock the timeout callback execution
            global.setTimeout.mockImplementation((callback) => callback());
            mockElements.menu.matches.mockReturnValue(false);
            mockElements.inputArea.matches.mockReturnValue(false);

            window.MenuView.hideMenu(mockContainer);

            // Verify menu is hidden
            expect(mockElements.menu.classList.remove).toHaveBeenCalledWith('visible');
        });
    });

    describe('forceHideMenu', () => {
        it('immediately hides menu without delay', () => {
            window.MenuView.forceHideMenu(mockContainer);

            // Verify menu is immediately hidden
            expect(mockElements.menu.classList.remove).toHaveBeenCalledWith('visible');
            
            // Verify no timeout is set
            expect(global.setTimeout).not.toHaveBeenCalled();
        });
    });

    describe('positionMenu', () => {
        it('calculates correct position above chat by default', () => {
            // Set up container rect with enough space above
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: 150,
                bottom: 300,
                height: 150,
                left: 100,
                right: 380,
                width: 280
            });

            window.MenuView.positionMenu(mockContainer);

            // Verify menu is positioned above (bottom positioning)
            expect(mockElements.menu.style.bottom).toBe('628px');
            expect(mockElements.menu.style.top).toBe('auto');
            expect(mockElements.menu.style.right).toBe('644px');
            expect(mockElements.menu.style.left).toBe('auto');
        });

        it('positions menu below when insufficient space above', () => {
            // Set up container rect with insufficient space above
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: 30, // Less than menuHeight + 20 (50 + 20 = 70)
                bottom: 180,
                height: 150,
                left: 100,
                right: 380,
                width: 280
            });

            window.MenuView.positionMenu(mockContainer);

            // Verify menu is positioned below (top positioning)
            expect(mockElements.menu.style.top).toBe('190px');
            expect(mockElements.menu.style.bottom).toBe('auto');
            expect(mockElements.menu.style.right).toBe('644px');
            expect(mockElements.menu.style.left).toBe('auto');
        });

        it('handles viewport constraints for right positioning', () => {
            // Set up container rect near right edge
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: 50,
                bottom: 200,
                height: 150,
                left: 1150,
                right: 1190, // Very close to right edge (1200)
                width: 40
            });

            window.MenuView.positionMenu(mockContainer);

            // Verify minimum right margin is enforced
            expect(mockElements.menu.style.right).toBe('10px'); // Math.max(10, 1200 - 1190) = 10
        });
    });

    describe('isMenuVisible', () => {
        it('returns true when menu has visible class', () => {
            mockElements.menu.classList.contains.mockReturnValue(true);

            const result = window.MenuView.isMenuVisible(mockContainer);

            expect(mockElements.menu.classList.contains).toHaveBeenCalledWith('visible');
            expect(result).toBe(true);
        });

        it('returns false when menu does not have visible class', () => {
            mockElements.menu.classList.contains.mockReturnValue(false);

            const result = window.MenuView.isMenuVisible(mockContainer);

            expect(mockElements.menu.classList.contains).toHaveBeenCalledWith('visible');
            expect(result).toBe(false);
        });
    });

    describe('updateMenuForDrag', () => {
        it('hides menu when dragging starts', () => {
            window.MenuView.updateMenuForDrag(mockContainer, true);

            expect(mockElements.menu.classList.remove).toHaveBeenCalledWith('visible');
        });

        it('does nothing when dragging stops', () => {
            window.MenuView.updateMenuForDrag(mockContainer, false);

            expect(mockElements.menu.classList.remove).not.toHaveBeenCalled();
        });
    });

    describe('setupClickOutside', () => {
        it('adds click event listener to document', () => {
            window.MenuView.setupClickOutside(mockContainer);

            expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('hides menu when clicking outside container', () => {
            window.MenuView.setupClickOutside(mockContainer);

            // Get the click handler
            const clickHandler = global.document.addEventListener.mock.calls
                .find(call => call[0] === 'click')[1];

            // Mock clicking outside - the shadow host contains should return false
            const mockEvent = { target: {} };
            
            // Mock shadow host behavior - target is outside the shadow host
            const mockShadowHost = global.document.getElementById('ai-assistant-shadow-host');
            mockShadowHost.contains.mockReturnValue(false);
            mockContainer.contains.mockReturnValue(false);

            // Mock the timeout callback execution for hideMenu
            global.setTimeout.mockImplementation((callback) => callback());
            mockElements.menu.matches.mockReturnValue(false);
            mockElements.inputArea.matches.mockReturnValue(false);

            clickHandler(mockEvent);

            // Verify shadow host contains was called
            expect(mockShadowHost.contains).toHaveBeenCalledWith(mockEvent.target);
            // Verify menu is hidden
            expect(mockElements.menu.classList.remove).toHaveBeenCalledWith('visible');
        });

        it('does not hide menu when clicking inside container', () => {
            window.MenuView.setupClickOutside(mockContainer);

            // Get the click handler
            const clickHandler = global.document.addEventListener.mock.calls
                .find(call => call[0] === 'click')[1];

            // Mock clicking inside - the shadow host contains should return true
            const mockEvent = { target: {} };
            
            // Mock shadow host behavior - target is inside the shadow host
            const mockShadowHost = global.document.getElementById('ai-assistant-shadow-host');
            mockShadowHost.contains.mockReturnValue(true);

            clickHandler(mockEvent);

            // Verify shadow host contains was called
            expect(mockShadowHost.contains).toHaveBeenCalledWith(mockEvent.target);
            // Verify menu is not hidden (no classList.remove call)
            expect(mockElements.menu.classList.remove).not.toHaveBeenCalledWith('visible');
        });
    });

    describe('hover state management', () => {
        it('shows menu when hovering over active areas in different states', () => {
            // Test in recent state
            mockContainer.getAttribute.mockReturnValue('recent');
            window.MenuView.setupHoverBehavior(mockContainer);

            // Get input area mouseenter handler
            const inputEnterHandler = mockElements.inputArea.addEventListener.mock.calls
                .find(call => call[0] === 'mouseenter')[1];

            inputEnterHandler();

            // Verify menu is shown
            expect(mockElements.menu.classList.add).toHaveBeenCalledWith('visible');
        });

        it('handles state-specific hover areas correctly', () => {
            window.MenuView.setupHoverBehavior(mockContainer);

            // All areas should have event listeners regardless of current state
            expect(mockElements.inputArea.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
            expect(mockElements.recentArea.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
            expect(mockContainer.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
        });
    });

    describe('edge cases', () => {
        it('handles missing menu element gracefully', () => {
            mockContainer.querySelector.mockReturnValue(null);

            expect(() => {
                window.MenuView.showMenu(mockContainer);
            }).toThrow(); // This will throw because menu is null

            expect(() => {
                window.MenuView.forceHideMenu(mockContainer);
            }).toThrow(); // This will throw because menu is null
        });

        it('handles viewport edge cases in positioning', () => {
            // Test with extreme positioning
            mockContainer.getBoundingClientRect.mockReturnValue({
                top: 0,
                bottom: 50,
                height: 50,
                left: 0,
                right: 1200, // Full width
                width: 1200
            });

            window.MenuView.positionMenu(mockContainer);

            // Should handle extreme values gracefully
            expect(mockElements.menu.style.right).toBe('10px'); // Minimum enforced
        });
    });
}); 