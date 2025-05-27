// Menu View Layer - Menu positioning, hover behavior, and visual states
window.MenuView = (function() {
    'use strict';
    
    function setupHoverBehavior(container) {
        const inputArea = container.querySelector('.chat-input-area');
        const recentArea = container.querySelector('.chat-recent');
        const titlePanel = container.querySelector('.title-panel');
        const menu = container.querySelector('.chat-menu');
        
        function shouldShowMenu(state) {
            return state === 'full' || state === 'recent' || state === 'minimal';
        }
        
        function getActiveHoverAreas(state) {
            switch (state) {
                case 'full': return [container];
                case 'recent': return [inputArea, recentArea, titlePanel];
                case 'minimal': return [inputArea];
                default: return [inputArea];
            }
        }
        
        function isHoveringOverActiveArea(state) {
            const areas = getActiveHoverAreas(state);
            return areas.some(area => area.matches(':hover'));
        }
        
        function handleMouseEnter() {
            const state = container.getAttribute('data-state');
            if (shouldShowMenu(state)) {
                showMenu(container);
            }
        }
        
        function handleMouseLeave(e) {
            const state = container.getAttribute('data-state');
            if (!menu.contains(e.relatedTarget)) {
                hideMenu(container, e.relatedTarget);
            }
        }
        
        // Set up event listeners for all possible hover areas
        [inputArea, recentArea, container].forEach(area => {
            area.addEventListener('mouseenter', handleMouseEnter);
            area.addEventListener('mouseleave', handleMouseLeave);
        });
        
        // Menu-specific hover handling
        menu.addEventListener('mouseenter', () => {
            menu.classList.add('visible');
        });
        
        menu.addEventListener('mouseleave', (e) => {
            const state = container.getAttribute('data-state');
            const activeAreas = getActiveHoverAreas(state);
            
            if (!activeAreas.some(area => area.contains(e.relatedTarget))) {
                setTimeout(() => {
                    if (!menu.matches(':hover') && !isHoveringOverActiveArea(state)) {
                        menu.classList.remove('visible');
                    }
                }, 100);
            }
        });
     }
    
    function setupClickOutside(container) {
        document.addEventListener('click', (e) => {
            // Hide menu if clicking outside (for touch devices)
            if (!container.contains(e.target)) {
                hideMenu(container);
            }
        });
    }
    
    function showMenu(container) {
        positionMenu(container);
        const menu = container.querySelector('.chat-menu');
        menu.classList.add('visible');
    }
    
    function hideMenu(container, relatedTarget = null) {
        const menu = container.querySelector('.chat-menu');
        
        if (relatedTarget && menu.contains(relatedTarget)) {
            return; // Don't hide if moving to menu
        }
        
        setTimeout(() => {
            const hoverTarget = getHoverTarget(container);
            if (!menu.matches(':hover') && !hoverTarget.matches(':hover')) {
                menu.classList.remove('visible');
            }
        }, 100);
    }
    
    function forceHideMenu(container) {
        const menu = container.querySelector('.chat-menu');
        menu.classList.remove('visible');
    }
    
    function positionMenu(container) {
        const menu = container.querySelector('.chat-menu');
        const containerRect = container.getBoundingClientRect();
        
        // Calculate available space above and below
        const spaceAbove = containerRect.top;
        const spaceBelow = window.innerHeight - containerRect.bottom;
        const menuHeight = 50; // Approximate menu height
        
        // Determine if menu should appear above or below
        const shouldShowBelow = spaceAbove < menuHeight + 20 && spaceBelow > menuHeight + 20;
        
        const menuRight = window.innerWidth - containerRect.right;
        
        if (shouldShowBelow) {
            // Position menu below the chat
            const menuTop = containerRect.bottom + 10;
            menu.style.right = Math.max(10, menuRight) + 'px';
            menu.style.top = menuTop + 'px';
            menu.style.bottom = 'auto';
            menu.style.left = 'auto';
        } else {
            // Position menu above the chat (default)
            const menuBottom = window.innerHeight - containerRect.top + 10;
            menu.style.right = Math.max(10, menuRight) + 'px';
            menu.style.bottom = menuBottom + 'px';
            menu.style.top = 'auto';
            menu.style.left = 'auto';
        }
    }
    
    function updateLiveShareState(container, isActive) {
        const menuItem = container.querySelector('[data-action="toggle-live"]');
        const iconEl = menuItem.querySelector('.menu-icon');
        
        if (isActive) {
            menuItem.classList.remove('live-inactive');
            menuItem.classList.add('live-active');
            menuItem.title = 'Stop live share';
            iconEl.textContent = '⏸️';
        } else {
            menuItem.classList.remove('live-active');
            menuItem.classList.add('live-inactive');
            menuItem.title = 'Start live share';
            iconEl.textContent = '▶️';
        }
    }
    
    function getLiveShareState(container) {
        const menuItem = container.querySelector('[data-action="toggle-live"]');
        return menuItem.classList.contains('live-active');
    }
    
    function getHoverTarget(container) {
        return container.getAttribute('data-state') === 'full' ? container : container.querySelector('.chat-input-area');
    }
    
    function isMenuVisible(container) {
        const menu = container.querySelector('.chat-menu');
        return menu.classList.contains('visible');
    }
    
    function updateMenuForDrag(container, isDragging) {
        if (isDragging) {
            forceHideMenu(container);
        }
    }
    
    // Public API - Pure menu view functions
    return {
        setupHoverBehavior,
        setupClickOutside,
        showMenu,
        hideMenu,
        forceHideMenu,
        positionMenu,
        updateLiveShareState,
        getLiveShareState,
        isMenuVisible,
        updateMenuForDrag
    };
    
})(); 