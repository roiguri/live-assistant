// Popup Script - API Key Management + Prompt Management
(function() {
  'use strict';

  // Chat tab elements
  const chatVisibleToggle = document.getElementById('chatVisible');
  const chatPositionSelect = document.getElementById('chatPosition');
  const chatForm = document.getElementById('chatForm');
  
  // API tab elements
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelectionSelect = document.getElementById('modelSelection');
  const saveModelBtn = document.getElementById('saveModelBtn');
  const testBtn = document.getElementById('testBtn');
  const apiForm = document.getElementById('apiForm');
  
  // Shortcuts tab elements
  const shortcutsList = document.getElementById('shortcuts-list');
  const customizeShortcutsBtn = document.getElementById('customize-shortcuts');
  
  // Common elements
  const statusDiv = document.getElementById('status');
  
  // Prompts tab elements
  const modeChipsContainer = document.getElementById('mode-chips');
  const modesListContainer = document.getElementById('modes-list');
  const addModeBtn = document.getElementById('add-mode-btn');
  
  // Modal elements
  const modeEditorModal = document.getElementById('mode-editor-modal');
  const confirmationModal = document.getElementById('confirmation-modal');
  const deleteModal = document.getElementById('delete-modal');
  const modeNameInput = document.getElementById('mode-name');
  const modePromptInput = document.getElementById('mode-prompt');
  const nameCounter = document.getElementById('name-counter');
  const promptCounter = document.getElementById('prompt-counter');
  
  // Modal control elements
  const closeEditorBtn = document.getElementById('close-editor-modal');
  const closeConfirmBtn = document.getElementById('close-confirm-modal');
  const closeDeleteBtn = document.getElementById('close-delete-modal');
  const cancelEditorBtn = document.getElementById('cancel-editor-btn');
  const saveModeBtn = document.getElementById('save-mode-btn');
  const cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
  const confirmSwitchBtn = document.getElementById('confirm-switch-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  
  // Tab management
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // State management
  let currentModes = [];
  let activeIndex = -1;
  let editingModeIndex = -1;
  let pendingActivation = null;
  
  // Initialize everything
  loadSavedSettings();
  setupTabs();
  setupPromptsHandlers();
  setupShortcutsTab();
  
  // Event listeners
  if (chatForm) chatForm.addEventListener('submit', handleChatSave);
  if (apiForm) apiForm.addEventListener('submit', handleApiSave);
  if (testBtn) testBtn.addEventListener('click', handleTest);
  if (chatVisibleToggle) chatVisibleToggle.addEventListener('change', handleToggleChange);
  if (chatPositionSelect) chatPositionSelect.addEventListener('change', handlePositionChange);
  if (modelSelectionSelect) modelSelectionSelect.addEventListener('change', handleModelSelectionChange);
  if (saveModelBtn) saveModelBtn.addEventListener('click', handleSaveModel);
  if (customizeShortcutsBtn) customizeShortcutsBtn.addEventListener('click', openShortcutsPage);
  
  // Tab management functions
  function setupTabs() {
      tabs.forEach(tab => {
          tab.addEventListener('click', () => {
              const targetTab = tab.getAttribute('data-tab');
              switchTab(targetTab);
          });
      });
  }
  
  function switchTab(tabName) {
      tabs.forEach(tab => {
          tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
      });
      
      tabContents.forEach(content => {
          content.classList.toggle('active', content.getAttribute('data-content') === tabName);
      });
      
      // Load content when switching tabs
      if (tabName === 'prompts') {
          loadPrompts();
      } else if (tabName === 'shortcuts') {
          loadShortcuts();
      }
  }
  
  function setupPromptsHandlers() {
      // Mode management
      if (addModeBtn) addModeBtn.addEventListener('click', showAddModeEditor);
      
      // Modal controls
      if (closeEditorBtn) closeEditorBtn.addEventListener('click', closeEditorModal);
      if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', closeConfirmationModal);
      if (closeDeleteBtn) closeDeleteBtn.addEventListener('click', closeDeleteModal);
      if (cancelEditorBtn) cancelEditorBtn.addEventListener('click', closeEditorModal);
      if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', closeConfirmationModal);
      if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
      if (saveModeBtn) saveModeBtn.addEventListener('click', handleSaveMode);
      if (confirmSwitchBtn) confirmSwitchBtn.addEventListener('click', handleConfirmSwitch);
      if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
      
      // Input character counters
      if (modeNameInput) modeNameInput.addEventListener('input', updateNameCounter);
      if (modePromptInput) modePromptInput.addEventListener('input', updatePromptCounter);
      
      // Modal backdrop clicks
      if (modeEditorModal) modeEditorModal.addEventListener('click', (e) => {
          if (e.target === modeEditorModal) closeEditorModal();
      });
      if (confirmationModal) confirmationModal.addEventListener('click', (e) => {
          if (e.target === confirmationModal) closeConfirmationModal();
      });
      if (deleteModal) deleteModal.addEventListener('click', (e) => {
          if (e.target === deleteModal) closeDeleteModal();
      });
  }
  
  // Load settings
  async function loadSavedSettings() {
      // Load API key
      try {
          const result = await chrome.storage.secure.get(['geminiApiKey']);
          if (result.geminiApiKey) {
              apiKeyInput.value = result.geminiApiKey;
          }
      } catch (error) {
          // Fallback to regular storage if secure storage not available
          try {
              const result = await chrome.storage.local.get(['geminiApiKey']);
              if (result.geminiApiKey) {
                  apiKeyInput.value = result.geminiApiKey;
              }
          } catch (err) {
              showStatus('Failed to load API key', 'error');
          }
      }

      // Load chat visibility setting (default to true)
      try {
          const result = await chrome.storage.local.get(['chatVisible']);
          chatVisibleToggle.checked = result.chatVisible !== false; // Default to true
      } catch (error) {
          chatVisibleToggle.checked = true; // Default to visible on error
      }
      
      // Load chat position setting (default to 'bottom-right')
      try {
          const result = await chrome.storage.local.get(['chatPosition']);
          chatPositionSelect.value = result.chatPosition || 'bottom-right';
      } catch (error) {
          chatPositionSelect.value = 'bottom-right'; // Default to bottom-right on error
      } finally {
          chatPositionSelect.classList.remove('loading');
      }
      
      try {
          const result = await chrome.storage.local.get(['selectedModel']);
          const savedModel = result.selectedModel || 'gemini-2.0-flash-live-001';
          modelSelectionSelect.value = savedModel;
          modelSelectionSelect.dataset.currentValue = savedModel;
      } catch (error) {
          modelSelectionSelect.value = 'gemini-2.0-flash-live-001'; // Default to gemini-2.0-flash-live-001 on error
          modelSelectionSelect.dataset.currentValue = 'gemini-2.0-flash-live-001';
      } finally {
          modelSelectionSelect.classList.remove('loading');
          saveModelBtn.disabled = true;
      }
      
      // Load custom prompts
      loadPrompts();
  }
  
  // Handle position change
  async function handlePositionChange() {
      const selectedPosition = chatPositionSelect.value;
      
      try {
          // Save position preference
          await chrome.storage.local.set({ chatPosition: selectedPosition });
          
          // Notify background script to update all tabs
          chrome.runtime.sendMessage({
              type: 'POSITION_UPDATE',
              position: selectedPosition
          }).catch(() => {
              // Ignore if background script not ready
          });
          
          showStatus(`Position changed to ${getPositionDisplayName(selectedPosition)}`, 'success');
          
      } catch (error) {
          showStatus('Failed to update chat position', 'error');
          // Revert selection on error
          try {
              const result = await chrome.storage.local.get(['chatPosition']);
              chatPositionSelect.value = result.chatPosition || 'bottom-right';
          } catch (err) {
              chatPositionSelect.value = 'bottom-right';
          }
      }
  }
  
  // Helper function to get display name for position
  function getPositionDisplayName(position) {
      const displayNames = {
          'bottom-right': 'Bottom Right',
          'bottom-center': 'Bottom Center',
          'bottom-left': 'Bottom Left',
          'top-right': 'Top Right',
          'top-center': 'Top Center',
          'top-left': 'Top Left'
      };
      return displayNames[position] || position;
  }
  
  function handleModelSelectionChange() {
      const selectedModel = modelSelectionSelect.value;
      const currentModel = modelSelectionSelect.dataset.currentValue || 'gemini-2.0-flash-live-001';
      
      saveModelBtn.disabled = (selectedModel === currentModel);
  }
  
  async function handleSaveModel() {
      const selectedModel = modelSelectionSelect.value;
      
      try {
          saveModelBtn.disabled = true;
          saveModelBtn.textContent = 'Saving...';
          
          await chrome.storage.local.set({ selectedModel: selectedModel });
          
          chrome.runtime.sendMessage({
              type: 'MODEL_CHANGED',
              model: selectedModel
          }).catch(() => {
              // Ignore if background script not ready
          });
          
          modelSelectionSelect.dataset.currentValue = selectedModel;
          
          showStatus('Model updated. Reconnecting...', 'info');
          
      } catch (error) {
          showStatus('Failed to update model selection', 'error');
          // Revert to previous selection on error
          try {
              const result = await chrome.storage.local.get(['selectedModel']);
              modelSelectionSelect.value = result.selectedModel || 'gemini-2.0-flash-live-001';
              modelSelectionSelect.dataset.currentValue = result.selectedModel || 'gemini-2.0-flash-live-001';
          } catch (err) {
              modelSelectionSelect.value = 'gemini-2.0-flash-live-001';
              modelSelectionSelect.dataset.currentValue = 'gemini-2.0-flash-live-001';
          }
      } finally {
          saveModelBtn.textContent = 'Save Model Selection';
          saveModelBtn.disabled = true; // Disable after saving
      }
  }
  
  // Save chat settings
  async function handleChatSave(e) {
      e.preventDefault();
      showStatus('Chat settings saved!', 'success');
  }
  
  // Save API settings
  async function handleApiSave(e) {
      e.preventDefault();
      
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
          showStatus('Please enter an API key', 'error');
          return;
      }
      
      if (!isValidApiKeyFormat(apiKey)) {
          showStatus('Invalid API key format', 'error');
          return;
      }
      
      try {
          showStatus('Saving...', 'info');
          
          // Try secure storage first, fallback to local storage
          try {
              await chrome.storage.secure.set({ geminiApiKey: apiKey });
          } catch (error) {
              await chrome.storage.local.set({ geminiApiKey: apiKey });
          }
          
          showStatus('API key saved successfully!', 'success');
      } catch (error) {
          showStatus('Failed to save API key', 'error');
      }
  }

  // Chat toggle
  async function handleToggleChange() {
      const isVisible = chatVisibleToggle.checked;
      
      try {
          // Save visibility preference
          await chrome.storage.local.set({ chatVisible: isVisible });
          
          // Notify all tabs about visibility change
          const tabs = await chrome.tabs.query({});
          tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                  type: 'TOGGLE_CHAT_VISIBILITY',
                  visible: isVisible
              }).catch(() => {
                  // Ignore errors for tabs without content script
              });
          });
          
          showStatus(isVisible ? 'Chat enabled' : 'Chat hidden', 'success');
          
      } catch (error) {
          showStatus('Failed to update chat visibility', 'error');
          // Revert toggle on error
          chatVisibleToggle.checked = !isVisible;
      }
  }
  
  // Test API key
  async function handleTest(e) {
      e.preventDefault();
      
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
          showStatus('Please enter an API key to test', 'error');
          return;
      }
      
      if (!isValidApiKeyFormat(apiKey)) {
          showStatus('Invalid API key format', 'error');
          return;
      }
      
      try {
          showStatus('Testing API key...', 'info');
          testBtn.disabled = true;
          
          const isValid = await testApiKey(apiKey);
          
          if (isValid) {
              showStatus('✓ API key is valid!', 'success');
          } else {
              showStatus('✗ API key is invalid or expired', 'error');
          }
          
      } catch (error) {
          showStatus('Failed to test API key', 'error');
      } finally {
          testBtn.disabled = false;
      }
  }
  
  // API key testing
  async function testApiKey(apiKey) {
      try {
          const response = await fetch('https://generativelanguage.googleapis.com/v1/models?key=' + apiKey, {
              method: 'GET',
              headers: {
                  'Content-Type': 'application/json',
              }
          });
          
          if (response.ok) {
              const data = await response.json();
              return data.models && data.models.length > 0;
          }
          
          return false;
      } catch (error) {
          return false; // Silently fail - error already shown to user
      }
  }
  
  // API key validation
  function isValidApiKeyFormat(apiKey) {
      // Basic validation for Gemini API key format
      // Typically starts with 'AIza' and is ~39 characters
      return apiKey.length >= 35 && apiKey.startsWith('AIza');
  }
  
  // Status display
  function showStatus(message, type) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
      statusDiv.style.display = 'block';
      
      // Auto-hide success/info messages
      if (type === 'success' || type === 'info') {
          setTimeout(() => {
              if (statusDiv.textContent === message) {
                  statusDiv.style.display = 'none';
              }
          }, 3000);
      }
  }
  
  // ===========================================
  // DYNAMIC PROMPTS SYSTEM
  // ===========================================
  
  async function loadPrompts() {
      if (!PromptManager) {
          showStatus('PromptManager not available', 'error');
          return;
      }
      
      try {
          const { customPrompts, activePromptIndex } = await PromptManager.getCustomPrompts();
          currentModes = customPrompts;
          activeIndex = activePromptIndex;
          renderUnifiedView();
      } catch (error) {
          showStatus('Failed to load prompts', 'error');
      }
  }
  
  function renderUnifiedView() {
      renderModeChips();
      renderManagementList();
  }
  
  function renderModeChips() {
      if (!modeChipsContainer) return;
      
      modeChipsContainer.innerHTML = '';
      
      const defaultChip = createModeChip('Default', null, -1);
      modeChipsContainer.appendChild(defaultChip);
      
      currentModes.forEach((mode, index) => {
          const chip = createModeChip(mode.name, mode.prompt, index);
          modeChipsContainer.appendChild(chip);
      });
  }
  
  function createModeChip(name, prompt, index) {
      const chip = document.createElement('div');
      chip.className = 'mode-chip';
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', activeIndex === index);
      chip.setAttribute('tabindex', '0');
      
      if (index === -1) {
          chip.classList.add('default-mode');
      }
      
      if (activeIndex === index) {
          chip.classList.add('active-chip');
      }
      
      chip.innerHTML = `
          <span>${name}</span>
          ${activeIndex === index ? '<span>✓</span>' : ''}
      `;
      
      chip.addEventListener('click', () => handleModeActivation(index));
      chip.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleModeActivation(index);
          }
      });
      
      return chip;
  }
  
  function handleModeActivation(index) {
      if (activeIndex === index) return;
      
      pendingActivation = index;
      
      const confirmMessage = document.getElementById('confirm-message');
      if (confirmMessage) {
          const modeName = index === -1 ? 'Default' : currentModes[index].name;
          confirmMessage.textContent = `Activating "${modeName}" mode will start a new chat and clear your current conversation. Do you want to continue?`;
      }
      
      if (confirmationModal) {
          confirmationModal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
      }
  }
  
  async function handleConfirmSwitch() {
      if (pendingActivation === null) return;
      
      try {
          const result = await PromptManager.saveCustomPrompts(currentModes, pendingActivation);
          
          if (result.success) {
              activeIndex = pendingActivation;
              renderModeChips();
              
              chrome.runtime.sendMessage({ type: 'CLEAR_CONVERSATION' }).catch(() => {
                  // Ignore if background script not ready
              });
              
              chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' }).catch(() => {
                  // Ignore if background script not ready
              });
              
              showStatus('Mode activated successfully!', 'success');
          } else {
              showStatus(result.error, 'error');
          }
      } catch (error) {
          showStatus('Failed to activate mode', 'error');
      }
      
      closeConfirmationModal();
  }
  
  function renderManagementList() {
      if (!modesListContainer) return;
      
      modesListContainer.innerHTML = '';
      
      if (currentModes.length === 0) {
          const emptyState = document.createElement('div');
          emptyState.className = 'modes-list-empty';
          emptyState.textContent = 'No custom modes created yet. Click "Add New Mode" to get started.';
          modesListContainer.appendChild(emptyState);
          return;
      }
      
      currentModes.forEach((mode, index) => {
          const item = createModeListItem(mode, index);
          modesListContainer.appendChild(item);
      });
  }
  
  function createModeListItem(mode, index) {
      const item = document.createElement('div');
      item.className = 'mode-item';
      item.setAttribute('role', 'listitem');
      
      const preview = mode.prompt.length > 50 ? mode.prompt.substring(0, 50) + '...' : mode.prompt;
      
      item.innerHTML = `
          <div class="mode-info">
              <div class="mode-name">${escapeHtml(mode.name)}</div>
              <div class="mode-preview">${escapeHtml(preview)}</div>
          </div>
          <div class="mode-actions">
              <button class="mode-action-btn edit-btn" data-index="${index}">Edit</button>
              <button class="mode-action-btn delete-btn" data-index="${index}">Delete</button>
          </div>
      `;
      
      const editBtn = item.querySelector('.edit-btn');
      const deleteBtn = item.querySelector('.delete-btn');
      
      editBtn.addEventListener('click', () => showEditModeEditor(index));
      deleteBtn.addEventListener('click', () => showDeleteConfirmation(index));
      
      return item;
  }
  
  
  function showAddModeEditor() {
      editingModeIndex = -1;
      resetEditorModal();
      
      const editorTitle = document.getElementById('editor-title');
      if (editorTitle) editorTitle.textContent = 'Add New Mode';
      
      if (modeEditorModal) {
          modeEditorModal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          if (modeNameInput) modeNameInput.focus();
      }
  }
  
  function showEditModeEditor(index) {
      editingModeIndex = index;
      const mode = currentModes[index];
      
      if (modeNameInput) modeNameInput.value = mode.name;
      if (modePromptInput) modePromptInput.value = mode.prompt;
      
      updateNameCounter();
      updatePromptCounter();
      
      const editorTitle = document.getElementById('editor-title');
      if (editorTitle) editorTitle.textContent = 'Edit Mode';
      
      if (modeEditorModal) {
          modeEditorModal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          if (modeNameInput) modeNameInput.focus();
      }
  }
  
  function showDeleteConfirmation(index) {
      editingModeIndex = index;
      const mode = currentModes[index];
      
      const deleteMessage = document.getElementById('delete-message');
      if (deleteMessage) {
          deleteMessage.textContent = `Are you sure you want to delete "${mode.name}"? This action cannot be undone.`;
      }
      
      if (deleteModal) {
          deleteModal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
      }
  }
  
  async function handleSaveMode() {
      if (!PromptManager) {
          showStatus('PromptManager not available', 'error');
          return;
      }
      
      const name = modeNameInput?.value.trim() || '';
      const prompt = modePromptInput?.value.trim() || '';
      
      if (!name || !prompt) {
          showStatus('Name and prompt are required', 'error');
          return;
      }
      
      const newMode = { name, prompt };
      const validation = PromptManager.validatePrompt(newMode);
      
      if (!validation.valid) {
          showStatus(validation.error, 'error');
          return;
      }
      
      try {
          let updatedModes = [...currentModes];
          let newActiveIndex = activeIndex;
          
          if (editingModeIndex === -1) {
              updatedModes.push(newMode);
          } else {
              updatedModes[editingModeIndex] = newMode;
          }
          
          const result = await PromptManager.saveCustomPrompts(updatedModes, newActiveIndex);
          
          if (result.success) {
              currentModes = updatedModes;
              renderUnifiedView();
              closeEditorModal();
              
              const action = editingModeIndex === -1 ? 'added' : 'updated';
              showStatus(`Mode ${action} successfully!`, 'success');
          } else {
              showStatus(result.error, 'error');
          }
      } catch (error) {
          showStatus('Failed to save mode', 'error');
      }
  }
  
  async function handleConfirmDelete() {
      if (editingModeIndex === -1) return;
      
      try {
          let updatedModes = [...currentModes];
          let newActiveIndex = activeIndex;
          
          updatedModes.splice(editingModeIndex, 1);
          
          if (activeIndex === editingModeIndex) {
              newActiveIndex = -1; // Switch to default
          } else if (activeIndex > editingModeIndex) {
              newActiveIndex = activeIndex - 1;
          }
          
          const result = await PromptManager.saveCustomPrompts(updatedModes, newActiveIndex);
          
          if (result.success) {
              currentModes = updatedModes;
              activeIndex = newActiveIndex;
              renderUnifiedView();
              closeDeleteModal();
              
              if (activeIndex !== newActiveIndex) {
                  chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' }).catch(() => {
                      // Ignore if background script not ready
                  });
              }
              
              showStatus('Mode deleted successfully!', 'success');
          } else {
              showStatus(result.error, 'error');
          }
      } catch (error) {
          showStatus('Failed to delete mode', 'error');
      }
  }
  
  function resetEditorModal() {
      if (modeNameInput) modeNameInput.value = '';
      if (modePromptInput) modePromptInput.value = '';
      updateNameCounter();
      updatePromptCounter();
  }
  
  function closeEditorModal() {
      if (modeEditorModal) {
          modeEditorModal.style.display = 'none';
          document.body.style.overflow = '';
      }
      editingModeIndex = -1;
  }
  
  function closeConfirmationModal() {
      if (confirmationModal) {
          confirmationModal.style.display = 'none';
          document.body.style.overflow = '';
      }
      pendingActivation = null;
  }
  
  function closeDeleteModal() {
      if (deleteModal) {
          deleteModal.style.display = 'none';
          document.body.style.overflow = '';
      }
      editingModeIndex = -1;
  }
  
  function updateNameCounter() {
      if (!nameCounter || !modeNameInput) return;
      
      const currentLength = modeNameInput.value.length;
      const maxLength = 100;
      
      nameCounter.textContent = `${currentLength} / ${maxLength}`;
      nameCounter.classList.toggle('warning', currentLength > maxLength * 0.9);
  }
  
  function updatePromptCounter() {
      if (!promptCounter || !modePromptInput) return;
      
      const currentLength = modePromptInput.value.length;
      const maxLength = 2000;
      
      promptCounter.textContent = `${currentLength} / ${maxLength}`;
      promptCounter.classList.toggle('warning', currentLength > maxLength * 0.9);
  }
  
  function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  }
  
  function setupShortcutsTab() {
      loadShortcuts();
  }
  
  async function loadShortcuts() {
      if (!shortcutsList) return;
      
      try {
          const commands = await chrome.commands.getAll();
          
          shortcutsList.innerHTML = '';
          
          commands.forEach(command => {
              if (command.name === '_execute_action') {
                  return;
              }
              
              const shortcutItem = document.createElement('div');
              shortcutItem.className = 'shortcut-item';
              
              const description = document.createElement('span');
              description.className = 'shortcut-desc';
              description.textContent = command.description || command.name;
              
              const keyCombo = document.createElement('span');
              keyCombo.className = 'shortcut-key';
              if (command.shortcut) {
                  keyCombo.textContent = command.shortcut;
              } else {
                  keyCombo.textContent = 'Not set';
                  keyCombo.classList.add('not-set');
              }
              
              shortcutItem.appendChild(description);
              shortcutItem.appendChild(keyCombo);
              shortcutsList.appendChild(shortcutItem);
          });
          
      } catch (error) {
          shortcutsList.innerHTML = '<div class="error">Failed to load shortcuts</div>';
      }
  }
  
  function openShortcutsPage() {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }
  
})();