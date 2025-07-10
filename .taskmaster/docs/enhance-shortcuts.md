Product Requirements Document (PRD): Enhanced Shortcut Options1. IntroductionThis document outlines the requirements for enhancing the Live Assistant Chrome extension with new keyboard shortcuts and improved user-facing presentation of these shortcuts. The goal is to improve accessibility and streamline the user workflow by providing keyboard-based alternatives for common actions and making shortcut management more transparent.2. Objectives & GoalsPrimary Objective: To introduce new keyboard shortcuts for "New Chat," "Toggle UI State," and "Refresh Connection."Secondary Objective: To create a new "Shortcuts" tab within the extension's popup to dynamically display all available shortcuts.Goal: To provide users with a direct link to chrome://extensions/shortcuts for easy customization of their keybindings.3. Target Users & RolesTarget Audience: All users of the Live Assistant extension, with a particular focus on power users who prefer keyboard-driven navigation.User Role: End-user who wants to quickly access core extension features without using a mouse.4. Core Features for MVPNew Commands:new-chat: Clears the current conversation, mimicking the existing "New Chat" button functionality.toggle-ui-state: Cycles through the chat UI states in the order: minimal -> recent -> full -> minimal.refresh-connection: Triggers a manual reconnection attempt, identical to the existing "Refresh Connection" button.Shortcut Presentation:A new "Shortcuts" tab will be added to the extension popup.This tab will dynamically display a list of all registered commands and their currently assigned shortcuts.A button or link will be included to take the user directly to the chrome://extensions/shortcuts page.5. Future ScopeAllow in-popup editing of shortcuts, if Chrome's extension APIs ever support this.Provide a brief tutorial or onboarding for the new shortcuts.Add the ability to temporarily disable specific shortcuts.6. User JourneyThe user opens the extension popup and navigates to the new "Shortcuts" tab.They see a list of available actions and their corresponding keyboard shortcuts.The user clicks a "Customize Shortcuts" button, which opens the chrome://extensions/shortcuts page in a new tab.The user assigns custom shortcuts to the new commands (e.g., Ctrl+Shift+N for "New Chat").In any active tab, the user presses their custom shortcut, and the corresponding action is triggered in the chat interface.7. Tech StackThe implementation will leverage the existing tech stack:Frontend: HTML, CSS, JavaScript for the extension popup.Backend (Extension Services): background.js will handle the new command listeners.Chrome Extension APIs: chrome.commands.getAll to fetch shortcut information, and chrome.tabs.create to open the shortcuts page.8. Architecturemanifest.json:The commands object will be updated to include the new commands (new-chat, toggle-ui-state, refresh-connection) with suggested default shortcuts.popup/popup.html:A new "Shortcuts" tab and content area will be added.popup/popup.js:Logic will be added to fetch and display the shortcuts dynamically using chrome.commands.getAll().An event listener will be added to the "Customize Shortcuts" button to open chrome://extensions/shortcuts.background.js:The onCommand listener will be expanded to handle the new commands and dispatch messages to the content scripts.content/chat-events.js:The onMessage listener will be updated to handle the new actions dispatched from the background script.9. Step-by-Step Implementation PlanStep 1: Update the ManifestFile to Edit: manifest.jsonAction: Add the new commands to the commands object."commands": {
  "toggle-chat": { ... },
  "focus-chat": { ... },
  "take-screenshot": { ... },
  "new-chat": {
    "suggested_key": {
      "default": "Ctrl+Shift+N",
      "mac": "Command+Shift+N"
    },
    "description": "Start a new chat"
  },
  "toggle-ui-state": {
    "suggested_key": {
      "default": "Ctrl+Shift+U",
      "mac": "Command+Shift+U"
    },
    "description": "Toggle chat UI state"
  },
  "refresh-connection": {
    "suggested_key": {
      "default": "Ctrl+Shift+R",
      "mac": "Command+Shift+R"
    },
    "description": "Refresh connection to AI service"
  }
}
Success Metric: After reloading the extension, the new shortcuts are visible in chrome://extensions/shortcuts.Step 2: Update the Popup UIFile to Edit: popup/popup.htmlAction: Add the "Shortcuts" tab and its content area.<!-- In the .tabs container -->
<button class="tab" data-tab="shortcuts">Shortcuts</button>

<!-- After the other .tab-content containers -->
<div class="tab-content" data-content="shortcuts">
  <div id="shortcuts-list"></div>
  <button id="customize-shortcuts" class="btn-primary">Customize Shortcuts</button>
</div>
Success Metric: The new tab and button are visible in the popup.Step 3: Implement Popup LogicFile to Edit: popup/popup.jsAction: Add logic to populate the shortcuts list and handle the button click.// In the setupTabs function or a new function called from there
function setupShortcutsTab() {
  const shortcutsList = document.getElementById('shortcuts-list');
  const customizeBtn = document.getElementById('customize-shortcuts');

  if (shortcutsList) {
    chrome.commands.getAll((commands) => {
      shortcutsList.innerHTML = '';
      commands.forEach(command => {
        const shortcutEl = document.createElement('div');
        shortcutEl.className = 'shortcut-item';
        shortcutEl.innerHTML = `
          <span class="shortcut-desc">${command.description}</span>
          <span class="shortcut-key">${command.shortcut || 'Not set'}</span>
        `;
        shortcutsList.appendChild(shortcutEl);
      });
    });
  }

  if (customizeBtn) {
    customizeBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }
}

// Call setupShortcutsTab() when the shortcuts tab is activated.
Success Metric: The "Shortcuts" tab correctly displays the commands and their keybindings, and the button opens the correct Chrome page.Step 4: Update the Background ScriptFile to Edit: background.jsAction: Add the new command handlers to the onCommand listener.chrome.commands.onCommand.addListener((command) => {
  // ... existing commands
  
  if (command === 'new-chat') {
    messageRouter.broadcastToAllTabs({ type: 'NEW_CHAT' });
  } else if (command === 'toggle-ui-state') {
    messageRouter.broadcastToAllTabs({ type: 'TOGGLE_UI_STATE' });
  } else if (command === 'refresh-connection') {
    messageRouter.broadcastToAllTabs({ type: 'REFRESH_CONNECTION' });
  }
});
Success Metric: Pressing the new shortcuts triggers the corresponding messages to be broadcast.Step 5: Update the Content ScriptFile to Edit: content/chat-events.jsAction: Add handlers for the new messages in the onMessage listener.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing cases
  
  switch (message.type) {
    // ...
    case 'NEW_CHAT':
      ChatController.changeState(container, 'clear-chat');
      sendResponse({ success: true });
      break;
    case 'TOGGLE_UI_STATE':
      ChatController.changeState(container, 'toggle-full');
      sendResponse({ success: true });
      break;
    case 'REFRESH_CONNECTION':
      if (container.querySelector('.refresh-btn').style.display !== 'none') {
        container.querySelector('.refresh-btn').click();
      }
      sendResponse({ success: true });
      break;
  }
});
Success Metric: The chat interface responds correctly when the new shortcut messages are received.10. Important Best PracticesUser Notification: When a shortcut is used, provide clear visual feedback (e.g., the UI state changes, the connection icon spins).Clarity in Descriptions: The command descriptions in manifest.json should be clear and concise, as they are displayed to the user in the chrome://extensions/shortcuts page.Default Shortcuts: Choose default shortcuts that are unlikely to conflict with common system or website shortcuts.Graceful Degradation: If chrome.commands.getAll() fails for any reason, the "Shortcuts" tab should display a helpful message rather than an empty state.