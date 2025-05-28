// API Service - Centralized API key management and validation
globalThis.ApiService = class ApiService {
    constructor() {
        // API key validation patterns
        this.GEMINI_KEY_PREFIX = 'AIza';
        this.MIN_KEY_LENGTH = 35;
        this.errorHandler = new globalThis.ErrorHandler();
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
            this.errorHandler.handleStorageError(err.message, 'get API key');
        }
        
        return null;
    }

    // Save API key to storage (secure first, then local fallback)
    async saveApiKey(apiKey) {
        if (!this.isValidApiKeyFormat(apiKey)) {
            return { success: false, error: 'Invalid API key format' };
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
                this.errorHandler.handleStorageError(err.message, 'save API key');
                return { success: false, error: 'Failed to save API key' };
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
            return { valid: false, error: 'No API key to test' };
        }

        if (!this.isValidApiKeyFormat(keyToTest)) {
            return { valid: false, error: 'Invalid API key format' };
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
                const isValid = data.models && data.models.length > 0;
                this.errorHandler.logSuccess('ApiService', `API key test: ${isValid ? 'valid' : 'invalid'}`);
                return {
                    valid: isValid,
                    modelsCount: data.models ? data.models.length : 0
                };
            } else {
                const error = `HTTP ${response.status}: ${response.statusText}`;
                this.errorHandler.handleApiError(error, 'API key test');
                return { valid: false, error };
            }
        } catch (error) {
            this.errorHandler.handleApiError(error.message, 'API key test');
            return { valid: false, error: error.message };
        }
    }

    // Clear stored API key
    async clearApiKey() {
        try {
            // Clear from both storage types
            await chrome.storage.secure.remove(['geminiApiKey']).catch(() => {});
            await chrome.storage.local.remove(['geminiApiKey']).catch(() => {});
            this.errorHandler.logSuccess('ApiService', 'API key cleared');
            return { success: true };
        } catch (error) {
            this.errorHandler.handleStorageError(error.message, 'clear API key');
            return { success: false, error: 'Failed to clear API key' };
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
            this.errorHandler.info('ApiService', 'No API key configured - user should click extension icon');
        }
    }
};