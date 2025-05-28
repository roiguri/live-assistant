// API Service - Centralized API key management and validation
globalThis.ApiService = class ApiService {
    constructor() {
        // API key validation patterns
        this.GEMINI_KEY_PREFIX = 'AIza';
        this.MIN_KEY_LENGTH = 35;
    }

    // Get API key from storage (secure first, then local fallback)
    async getApiKey() {
        try {
            // Try secure storage first
            let result = await chrome.storage.secure.get(['geminiApiKey']);
            if (result.geminiApiKey) {
                return result.geminiApiKey;
            }
        } catch (error) {
            // Secure storage not available, continue to local storage
        }
        
        try {
            // Fallback to local storage
            let result = await chrome.storage.local.get(['geminiApiKey']);
            if (result.geminiApiKey) {
                return result.geminiApiKey;
            }
        } catch (err) {
            console.error('API Service: Failed to get API key:', err);
        }
        
        return null;
    }

    // Save API key to storage (secure first, then local fallback)
    async saveApiKey(apiKey) {
        if (!this.isValidApiKeyFormat(apiKey)) {
            throw new Error('Invalid API key format');
        }

        try {
            // Try secure storage first
            await chrome.storage.secure.set({ geminiApiKey: apiKey });
            return { success: true, storage: 'secure' };
        } catch (error) {
            try {
                // Fallback to local storage
                await chrome.storage.local.set({ geminiApiKey: apiKey });
                return { success: true, storage: 'local' };
            } catch (err) {
                throw new Error('Failed to save API key to any storage');
            }
        }
    }

    // Check if we have a valid API key
    async hasValidApiKey() {
        const apiKey = await this.getApiKey();
        return apiKey && this.isValidApiKeyFormat(apiKey);
    }

    // Validate API key format
    isValidApiKeyFormat(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        return apiKey.length >= this.MIN_KEY_LENGTH && 
               apiKey.startsWith(this.GEMINI_KEY_PREFIX);
    }

    // Test API key by making a request to Gemini API
    async testApiKey(apiKey = null) {
        const keyToTest = apiKey || await this.getApiKey();
        
        if (!keyToTest) {
            throw new Error('No API key to test');
        }

        if (!this.isValidApiKeyFormat(keyToTest)) {
            throw new Error('Invalid API key format');
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models?key=${keyToTest}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                return {
                    valid: data.models && data.models.length > 0,
                    modelsCount: data.models ? data.models.length : 0
                };
            } else {
                return {
                    valid: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // Clear stored API key
    async clearApiKey() {
        try {
            // Clear from both storage types
            await chrome.storage.secure.remove(['geminiApiKey']).catch(() => {});
            await chrome.storage.local.remove(['geminiApiKey']).catch(() => {});
            return { success: true };
        } catch (error) {
            throw new Error('Failed to clear API key');
        }
    }

    // Get API key status information
    async getApiKeyStatus() {
        const apiKey = await this.getApiKey();
        
        if (!apiKey) {
            return {
                hasKey: false,
                isValid: false,
                message: 'No API key configured'
            };
        }

        const isValidFormat = this.isValidApiKeyFormat(apiKey);
        
        return {
            hasKey: true,
            isValid: isValidFormat,
            keyLength: apiKey.length,
            keyPrefix: apiKey.substring(0, 6) + '...',
            message: isValidFormat ? 'API key configured' : 'Invalid API key format'
        };
    }

    // Prompt user to configure API key (for content scripts)
    promptForApiKey() {
        // This could open the extension popup or show a notification
        if (chrome.runtime && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            // Fallback: show message to user
            console.warn('API Service: No API key configured. Please click the extension icon to set up your Gemini API key.');
        }
    }
};