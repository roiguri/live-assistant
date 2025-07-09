Product Requirements Document (PRD): Predefined Positions1. IntroductionThis document outlines the plan to replace the current drag-and-drop positioning system for the Live Assistant chat window with a new system that allows users to select from a predefined set of screen positions. This change will provide a more stable and user-friendly way to customize the chat window's location, ensuring a consistent experience across all UI states.2. Objectives & GoalsPrimary Objective: Remove the existing drag-and-drop functionality and all associated UI elements and code.Secondary Objective: Implement a new setting in the extension's popup that allows users to select from a predefined set of positions for the chat window.Goal: Ensure the selected position is saved and consistently applied across all tabs and browser sessions, fully supporting all UI states (minimal, recent, and full).3. Target Users & RolesTarget Audience: All users of the Live Stream AI Assistant.User Role: End-user configuring their personal interface preferences.4. Core Features for this ChangePosition Setting: A new dropdown menu will be added to the "General" tab of the extension popup with the following options:Bottom Right (Default)Bottom CenterBottom LeftTop RightTop CenterTop LeftDynamic Updates: When a user selects a new position, the chat window on the current page will immediately move to the selected location.Persistence: The selected position will be saved to the user's local storage and will persist across all tabs and browser sessions.5. Future ScopeAdding more position options (e.g., middle-left, middle-right).Allowing users to define custom offset values for each position.6. Architecture & Implementation PlanDirectory & File Changespopup/popup.html: Add HTML for the new position selection dropdown.popup/popup.js: Add logic to handle saving the selected position and sending a message to the content script.content/styles/shadow-styles.js: Remove the drag handle styles and add new CSS classes for each position.content/chat-events.js: Remove the setupDragEvents function and its related code.content/views/chat-view.js: Remove the drag handle from the HTML template.content.js: Add logic to apply the correct position class to the chat container on load and when the setting is changed.background.js: Add a message listener to relay position changes to all tabs.7. Step-by-Step Implementation PlanStep 1: Remove Drag-and-Drop FunctionalityFile to edit: content/chat-events.jsAction:Delete the setupDragEvents function entirely.Remove the call to setupDragEvents(container); from the setupEventListeners function.File to edit: content/views/chat-view.jsAction: Remove the drag handle div from the getChatHTML function's template.File to edit: content/styles/shadow-styles.jsAction: Remove the entire .drag-handle style block.Success Metric: The drag handle is no longer visible on the chat interface, and dragging functionality is completely disabled.Step 2: Modify the Popup UIFile to edit: popup/popup.htmlAction: Add a new .form-group for the position setting within the "General" tab.<div class="form-group">
  <label for="chatPosition">Chat Position</label>
  <select id="chatPosition">
    <option value="bottom-right">Bottom Right</option>
    <option value="bottom-center">Bottom Center</option>
    <option value="bottom-left">Bottom Left</option>
    <option value="top-right">Top Right</option>
    <option value="top-center">Top Center</option>
    <option value="top-left">Top Left</option>
  </select>
</div>
Success Metric: The new dropdown appears correctly in the extension popup.Step 3: Implement Popup LogicFile to edit: popup/popup.jsAction:Get a reference to the new #chatPosition select element.In loadSavedSettings, load the saved position from chrome.storage.local and set the dropdown's value.Add a new change event listener to the #chatPosition dropdown.When the position is changed, save the new value to chrome.storage.local and send a message to the background script to notify all tabs.Success Metric: Selecting a position in the popup saves the value and triggers a message to the background script.Step 4: Update CSS StylesFile to edit: content/styles/shadow-styles.jsAction:Modify the #assistant-chat style to remove any default positioning properties (bottom, right, left, top).Add new classes for each of the six positions, including transform for centering./* In shadow-styles.js */

/* Modify #assistant-chat */
#assistant-chat {
  position: fixed;
  width: 280px;
  /* ... existing styles ... */
  /* REMOVE any absolute positioning properties */
}

/* ADD new position classes */
#assistant-chat.position-bottom-right { bottom: 20px; right: 20px; }
#assistant-chat.position-bottom-left { bottom: 20px; left: 20px; }
#assistant-chat.position-top-right { top: 20px; right: 20px; }
#assistant-chat.position-top-left { top: 20px; left: 20px; }

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
Success Metric: The new CSS classes are correctly defined.Step 5: Apply Position Class in Content ScriptFile to edit: content.jsAction:When initializing the chat, get the saved position from chrome.storage.local and apply the corresponding class to the chatContainer.Add a chrome.runtime.onMessage listener to handle POSITION_UPDATE messages and update the class dynamically.Success Metric: The chat window appears in the correct position when a page loads, and it moves immediately when the setting is changed in the popup.Step 6: Relay Position Updates from BackgroundFile to edit: background.jsAction: Add a new case to the chrome.runtime.onMessage listener to broadcast position updates to all tabs.Success Metric: Changing the position in one tab updates the chat window's position in all other open tabs.8. Important Best PracticesClear Class Naming: The use of position-* class names is clear and avoids conflicts with other styles.Default Value: Always provide a default value ('bottom-right') when retrieving the position from storage to handle the case where it hasn't been set yet.Efficient DOM Manipulation: When updating the position, we first remove any existing position classes before adding the new one. This ensures that only one position class is applied at a time.UI State Support: The CSS-based positioning will work seamlessly with all UI states (minimal, recent, full) as the container's position is independent of its height and content.This revised plan incorporates your feedback and provides a clear, step-by-step guide for a successful implementation.