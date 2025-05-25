// API Utilities - Gemini API Key Management
window.ApiUtils = (function() {
    'use strict';
    
    async function getApiKey() {
      try {
        // Try secure storage first
        let result = await chrome.storage.secure.get(['geminiApiKey']);
        if (result.geminiApiKey) {
          return result.geminiApiKey;
        }
      } catch (error) {
        // Fallback to local storage
        try {
          let result = await chrome.storage.local.get(['geminiApiKey']);
          if (result.geminiApiKey) {
            return result.geminiApiKey;
          }
        } catch (err) {
          console.error('Failed to get API key:', err);
        }
      }
      
      return null;
    }
    
    async function hasValidApiKey() {
      const apiKey = await getApiKey();
      return apiKey && apiKey.length >= 35 && apiKey.startsWith('AIza');
    }
    
    function promptForApiKey() {
      // Open extension popup for API key setup
      if (chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        // Fallback: show message to user
        alert('Please click the extension icon to set up your Gemini API key.');
      }
    }
    
    // Public API
    return {
      getApiKey,
      hasValidApiKey,
      promptForApiKey
    };
    
  })();