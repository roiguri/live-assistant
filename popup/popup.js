// Popup Script - API Key Management
(function() {
    'use strict';
    // TODO: consider adding a clear method to the stored api key

    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const statusDiv = document.getElementById('status');
    const form = document.getElementById('settingsForm');
    
    // Load saved API key on popup open
    loadSavedApiKey();
    
    // Event listeners
    form.addEventListener('submit', handleSave);
    testBtn.addEventListener('click', handleTest);
    
    async function loadSavedApiKey() {
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
          console.error('Failed to load API key:', err);
        }
      }
    }
    
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
        
        // Auto-close popup after successful save
        setTimeout(() => {
          window.close();
        }, 1500);
        
      } catch (error) {
        console.error('Save error:', error);
        showStatus('Failed to save API key', 'error');
      }
    }
    
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
        console.error('Test error:', error);
        showStatus('Failed to test API key', 'error');
      } finally {
        testBtn.disabled = false;
      }
    }
    
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
        console.error('API test failed:', error);
        return false;
      }
    }
    
    function isValidApiKeyFormat(apiKey) {
      // Basic validation for Gemini API key format
      // Typically starts with 'AIza' and is ~39 characters
      return apiKey.length >= 35 && apiKey.startsWith('AIza');
    }
    
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
    
  })();