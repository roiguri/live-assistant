// Popup Script - API Key Management + Prompt Management
(function() {
  'use strict';

  // General tab elements
  const apiKeyInput = document.getElementById('apiKey');
  const chatVisibleToggle = document.getElementById('chatVisible');
  const chatPositionSelect = document.getElementById('chatPosition');
  const testBtn = document.getElementById('testBtn');
  const statusDiv = document.getElementById('status');
  const form = document.getElementById('settingsForm');
  
  // Prompts tab elements
  const customInstructionsInput = document.getElementById('customInstructions');
  const saveInstructionsBtn = document.getElementById('saveInstructions');
  const clearInstructionsBtn = document.getElementById('clearInstructions');
  const charCounter = document.getElementById('charCounter');
  
  // Tab management
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Initialize everything
  loadSavedSettings();
  setupTabs();
  setupPromptHandlers();
  
  // Event listeners
  form.addEventListener('submit', handleSave);
  testBtn.addEventListener('click', handleTest);
  chatVisibleToggle.addEventListener('change', handleToggleChange);
  chatPositionSelect.addEventListener('change', handlePositionChange);
  
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
      
      // Load prompt preview when switching to prompts tab
      if (tabName === 'prompts') {
          updateCharCounter();
      }
  }
  
  function setupPromptHandlers() {
      if (customInstructionsInput) {
          customInstructionsInput.addEventListener('input', handleInstructionsInput);
      }
      if (saveInstructionsBtn) {
          saveInstructionsBtn.addEventListener('click', saveInstructions);
      }
      if (clearInstructionsBtn) {
          clearInstructionsBtn.addEventListener('click', clearInstructions);
      }
  }
  
  // Load settings
  async function loadSavedSettings() {
      // Load API key
      try {
          const result = await chrome.storage.secure.get(['geminiApiKey']);
          if (result.geminiApiKey) {
              apiKeyInput.value = result.geminiApiKey;
              showStatus('API key loaded', 'success');
          }
      } catch (error) {
          // Fallback to regular storage if secure storage not available
          try {
              const result = await chrome.storage.local.get(['geminiApiKey']);
              if (result.geminiApiKey) {
                  apiKeyInput.value = result.geminiApiKey;
                  showStatus('API key loaded', 'success');
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
      }
      
      // Load custom instructions
      if (PromptManager && customInstructionsInput) {
          try {
              const customInstructions = await PromptManager.getCustomInstructions();
              customInstructionsInput.value = customInstructions;
              updateCharCounter();
          } catch (error) {
              showStatus('Failed to load custom instructions', 'error');
          }
      }
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
  
  // Save API key
  async function handleSave(e) {
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
  
  // Prompt management functions
  function handleInstructionsInput() {
      updateCharCounter();
      
      // Validate instructions
      if (PromptManager) {
          const instructions = customInstructionsInput.value;
          const validation = PromptManager.validateInstructions(instructions);
          
          if (!validation.valid) {
              showStatus(validation.error, 'error');
              saveInstructionsBtn.disabled = true;
          } else {
              saveInstructionsBtn.disabled = false;
              // Clear error status if input becomes valid
              if (statusDiv.classList.contains('error')) {
                  statusDiv.style.display = 'none';
              }
          }
      }
  }
  
  function updateCharCounter() {
      if (!charCounter || !customInstructionsInput) return;
      
      const currentLength = customInstructionsInput.value.length;
      const maxLength = 2000;
      
      charCounter.textContent = `${currentLength} / ${maxLength}`;
      charCounter.classList.toggle('warning', currentLength > maxLength * 0.9);
  }
  
  async function saveInstructions() {
      if (!PromptManager) {
          showStatus('PromptManager not available', 'error');
          return;
      }
      
      const instructions = customInstructionsInput.value.trim();
      
      try {
          const result = await PromptManager.setCustomInstructions(instructions);
          
          if (result.success) {
              showStatus('Instructions saved successfully!', 'success');
              
              // Notify background script to update system prompt
              chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' }).catch(() => {
                  // Ignore if background script not ready
              });
              
          } else {
              showStatus(result.error, 'error');
          }
      } catch (error) {
          showStatus('Failed to save instructions', 'error');
      }
  }
  
  async function clearInstructions() {
      if (confirm('Clear all custom instructions?')) {
          customInstructionsInput.value = '';
          await saveInstructions();
          updateCharCounter();
      }
  }
  
})();