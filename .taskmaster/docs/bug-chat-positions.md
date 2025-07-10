PRD: Stable Chat Positioning1. ArchitectureThe changes will be concentrated in the following files to ensure a robust, CSS-only positioning solution:content/styles/shadow-styles.js: This file will be updated with new, more specific CSS rules for each chat position.content/views/chat-view.js: We will remove the ensureWithinViewport function from this file to prevent JavaScript from dynamically interfering with the CSS positioning.popup/popup.js: No changes are needed here. The existing logic for saving the user's position preference and notifying the content script is already correct and sufficient. [cite: roiguri/live-assistant/live-assistant-01a16f954aac46eddf064b02cd62acf4ca851ca5/popup/popup.js]Data Structures:No new data structures will be introduced. The implementation will continue to use the chatPosition key within chrome.storage.local to persist the user's selected position.Summary:The core of this plan is to refactor the CSS to be the single source of truth for positioning and to remove the conflicting JavaScript logic. This will result in a more stable, predictable, and maintainable implementation.2. Step-by-Step Implementation PlanStep 1: Refactor the Positioning CSSFile to Edit: content/styles/shadow-styles.jsAction:Replace the current, less specific position classes with the following rules. This change ensures that top and bottom properties are not used in a conflicting manner, which is a primary cause of the current issues./* content/styles/shadow-styles.js */

/* ... (keep existing styles for #assistant-chat, but remove any default top/bottom/left/right properties) ... */

/* New Position classes */
#assistant-chat.position-bottom-right {
  bottom: 20px;
  right: 20px;
}

#assistant-chat.position-bottom-left {
  bottom: 20px;
  left: 20px;
}

#assistant-chat.position-top-right {
  top: 20px;
  right: 20px;
}

#assistant-chat.position-top-left {
  top: 20px;
  left: 20px;
}

#assistant-chat.position-bottom-center {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}

#assistant-chat.position-top-center {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}
Success Metric:After this change, you can manually apply any of these classes to the #assistant-chat element using the browser's developer tools and confirm that the chat window correctly moves to the specified position without any unexpected shifting.Step 2: Remove Conflicting JavaScript LogicFile to Edit: content/views/chat-view.jsAction:To prevent JavaScript from overriding our new CSS-based positioning, the ensureWithinViewport function must be removed. Also, remove the call to this function from updateState.// content/views/chat-view.js

// ...

function updateState(container) {
    container.setAttribute('data-state', ChatState.getState());
    
    // ... (the rest of the function's logic remains the same)
    
    // REMOVE THE FOLLOWING LINE:
    // ensureWithinViewport(container);

    MenuView.positionMenu(container);
    
    updateMenuText(container);
}

// ...

// DELETE THIS ENTIRE FUNCTION:
/*
function ensureWithinViewport(container) {
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 20;

    const maxTop = viewportHeight - rect.height - margin;
    
    if (rect.top < margin) {
        container.style.top = margin + 'px';
        container.style.bottom = 'auto';
    } else if (rect.bottom > viewportHeight - margin) {
        const safeTop = Math.max(margin, maxTop);
        container.style.top = safeTop + 'px';
        container.style.bottom = 'auto';
    }
}
*/
Success Metric:The chat window's position should now be exclusively controlled by the CSS classes. You can verify this by changing the UI state (e.g., sending a message, expanding the chat to full view) and confirming that the chat window remains fixed in its selected position.3. Important Best PracticesSeparation of Concerns: This plan reinforces the best practice of using CSS for layout and styling, while JavaScript is reserved for handling user interactions and application logic.Code Simplicity: The new CSS rules are more straightforward and easier to debug, as each position is defined by a single, unambiguous class.User Experience: By providing a stable and predictable positioning system, we enhance the user experience and eliminate a key point of frustration.