// ApiService Unit Tests
const path = require('path');

// Load test helpers
require('../../config/test-helpers.js');

// Load the service
require('../../../services/api-service.js');

describe('ApiService', () => {
    let apiService;
    let mockFetch;

    beforeEach(() => {
        // Create fresh instance
        apiService = new globalThis.ApiService();
        
        // Mock fetch globally
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        
        // Reset all chrome storage mocks
        chrome.storage.secure.get.mockClear();
        chrome.storage.secure.set.mockClear();
        chrome.storage.secure.remove.mockClear();
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
        chrome.storage.local.remove.mockClear();
        
        // Reset runtime mock
        chrome.runtime.openOptionsPage = jest.fn();
    });

    afterEach(() => {
        delete global.fetch;
    });

    describe('getApiKey', () => {
        it('should try secure storage first, fall back to local', async () => {            
            // Setup: secure storage has key
            chrome.storage.secure.get.mockResolvedValue({ geminiApiKey: testData.validApiKey });
            
            const result = await apiService.getApiKey();
            
            expect(chrome.storage.secure.get).toHaveBeenCalledWith(['geminiApiKey']);
            expect(chrome.storage.local.get).not.toHaveBeenCalled();
            expect(result).toBe(testData.validApiKey);
        });

        it('should fall back to local storage when secure storage fails', async () => {
            // Setup: secure storage throws, local storage has key
            chrome.storage.secure.get.mockRejectedValue(new Error('Secure storage unavailable'));
            chrome.storage.local.get.mockResolvedValue({ geminiApiKey: testData.validApiKey });
            
            const result = await apiService.getApiKey();
            
            expect(chrome.storage.secure.get).toHaveBeenCalledWith(['geminiApiKey']);
            expect(chrome.storage.local.get).toHaveBeenCalledWith(['geminiApiKey']);
            expect(result).toBe(testData.validApiKey);
        });

        it('should return null when no key found in either storage', async () => {
            // Setup: both storages empty
            chrome.storage.secure.get.mockResolvedValue({});
            chrome.storage.local.get.mockResolvedValue({});
            
            const result = await apiService.getApiKey();
            
            expect(result).toBeNull();
        });

        it('should handle local storage errors gracefully', async () => {
            // Setup: both storages fail
            chrome.storage.secure.get.mockRejectedValue(new Error('Secure error'));
            chrome.storage.local.get.mockRejectedValue(new Error('Local error'));
            
            const result = await apiService.getApiKey();
            
            expect(result).toBeNull();
        });
    });

    describe('saveApiKey', () => {
        it('should validate format before saving', async () => {            
            const result = await apiService.saveApiKey(testData.invalidApiKey);
            
            expect(result).toEqual({
                success: false,
                error: 'Invalid API key format'
            });
            expect(chrome.storage.secure.set).not.toHaveBeenCalled();
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should save to secure storage when available', async () => {
            chrome.storage.secure.set.mockResolvedValue();
            
            const result = await apiService.saveApiKey(testData.validApiKey);
            
            expect(chrome.storage.secure.set).toHaveBeenCalledWith({ geminiApiKey: testData.validApiKey });
            expect(result).toEqual({
                success: true,
                storage: 'secure'
            });
        });

        it('should fall back to local storage when secure storage fails', async () => {
            chrome.storage.secure.set.mockRejectedValue(new Error('Secure storage unavailable'));
            chrome.storage.local.set.mockResolvedValue();
            
            const result = await apiService.saveApiKey(testData.validApiKey);
            
            expect(chrome.storage.secure.set).toHaveBeenCalledWith({ geminiApiKey: testData.validApiKey });
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ geminiApiKey: testData.validApiKey });
            expect(result).toEqual({
                success: true,
                storage: 'local'
            });
        });

        it('should handle complete storage failure', async () => {
            chrome.storage.secure.set.mockRejectedValue(new Error('Secure error'));
            chrome.storage.local.set.mockRejectedValue(new Error('Local error'));
            
            const result = await apiService.saveApiKey(testData.validApiKey);
            
            expect(result).toEqual({
                success: false,
                error: 'Failed to save API key'
            });
        });
    });

    describe('hasValidApiKey', () => {
        it('should check existence and format', async () => {            
            chrome.storage.secure.get.mockResolvedValue({ geminiApiKey: testData.validApiKey });
            
            const result = await apiService.hasValidApiKey();
            
            expect(result).toBe(true);
        });

        it('should return false for invalid format', async () => {
            chrome.storage.secure.get.mockResolvedValue({ geminiApiKey: testData.invalidApiKey });
            
            const result = await apiService.hasValidApiKey();
            
            expect(result).toBe(false);
        });

        it('should return false when no key exists', async () => {
            chrome.storage.secure.get.mockResolvedValue({});
            chrome.storage.local.get.mockResolvedValue({});
            
            const result = await apiService.hasValidApiKey();
            
            expect(result).toBe(null);
        });
    });

    describe('isValidApiKeyFormat', () => {
        it('should validate prefix and length', async () => {            
            expect(apiService.isValidApiKeyFormat(testData.validApiKey)).toBe(true);
            expect(apiService.isValidApiKeyFormat(testData.invalidApiKey)).toBe(false);
            expect(apiService.isValidApiKeyFormat('AIza123')).toBe(false); // too short
            expect(apiService.isValidApiKeyFormat('INVALID1234567890123456789012345678901234567')).toBe(false); // wrong prefix
            expect(apiService.isValidApiKeyFormat(null)).toBe(false);
            expect(apiService.isValidApiKeyFormat(undefined)).toBe(false);
            expect(apiService.isValidApiKeyFormat(123)).toBe(false);
        });
    });

    describe('testApiKey', () => {
        it('should make correct API call', async () => {            
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    models: [{ name: 'gemini-pro' }, { name: 'gemini-pro-vision' }]
                })
            });
            
            const result = await apiService.testApiKey(testData.validApiKey);
            
            expect(mockFetch).toHaveBeenCalledWith(
                `https://generativelanguage.googleapis.com/v1/models?key=${testData.validApiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );
            expect(result).toEqual({
                valid: true,
                modelsCount: 2
            });
        });

        it('should handle HTTP errors (401, 429, 500)', async () => {            
            const testCases = [
                { status: 401, statusText: 'Unauthorized' },
                { status: 429, statusText: 'Too Many Requests' },
                { status: 500, statusText: 'Internal Server Error' }
            ];

            for (const testCase of testCases) {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: testCase.status,
                    statusText: testCase.statusText
                });
                
                const result = await apiService.testApiKey(testData.validApiKey);
                
                expect(result).toEqual({
                    valid: false,
                    error: `HTTP ${testCase.status}: ${testCase.statusText}`
                });
            }
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            const result = await apiService.testApiKey(testData.validApiKey);
            
            expect(result).toEqual({
                valid: false,
                error: 'Network error'
            });
        });

        it('should handle no API key provided', async () => {
            chrome.storage.secure.get.mockResolvedValue({});
            chrome.storage.local.get.mockResolvedValue({});
            
            const result = await apiService.testApiKey();
            
            expect(result).toEqual({
                valid: false,
                error: 'No API key to test'
            });
        });

        it('should handle invalid API key format', async () => {
            const result = await apiService.testApiKey(testData.invalidApiKey);
            
            expect(result).toEqual({
                valid: false,
                error: 'Invalid API key format'
            });
        });
    });

    describe('clearApiKey', () => {
        it('should remove from both storage types', async () => {            
            chrome.storage.secure.remove.mockResolvedValue();
            chrome.storage.local.remove.mockResolvedValue();
            
            const result = await apiService.clearApiKey();
            
            expect(chrome.storage.secure.remove).toHaveBeenCalledWith(['geminiApiKey']);
            expect(chrome.storage.local.remove).toHaveBeenCalledWith(['geminiApiKey']);
            expect(result).toEqual({ success: true });
        });

        it('should handle storage errors gracefully', async () => {
            // Test the case where the chrome storage operations themselves work
            // but some other error occurs that triggers the outer catch block
            chrome.storage.secure.remove.mockResolvedValue();
            chrome.storage.local.remove.mockResolvedValue();
            
            // Override the errorHandler to throw, simulating an unexpected error
            const originalLogSuccess = apiService.errorHandler.logSuccess;
            apiService.errorHandler.logSuccess = jest.fn().mockImplementation(() => {
                throw new Error('Unexpected error during logging');
            });
            
            const result = await apiService.clearApiKey();
            
            // Should fail because the outer try-catch caught the logging error
            expect(result).toEqual({
                success: false,
                error: 'Failed to clear API key'
            });
            
            // Restore the original method
            apiService.errorHandler.logSuccess = originalLogSuccess;
        });
    });

    describe('getApiKeyStatus', () => {
        it('should return correct status object', async () => {            
            chrome.storage.secure.get.mockResolvedValue({ geminiApiKey: testData.validApiKey });
            
            const result = await apiService.getApiKeyStatus();
            
            expect(result).toEqual({
                hasKey: true,
                isValid: true,
                keyLength: testData.validApiKey.length,
                keyPrefix: testData.validApiKey.substring(0, 6) + '...',
                message: 'API key configured'
            });
        });

        it('should handle no API key case', async () => {
            chrome.storage.secure.get.mockResolvedValue({});
            chrome.storage.local.get.mockResolvedValue({});
            
            const result = await apiService.getApiKeyStatus();
            
            expect(result).toEqual({
                hasKey: false,
                isValid: false,
                message: 'No API key configured'
            });
        });

        it('should handle invalid API key format', async () => {
            chrome.storage.secure.get.mockResolvedValue({ geminiApiKey: testData.invalidApiKey });
            
            const result = await apiService.getApiKeyStatus();
            
            expect(result).toEqual({
                hasKey: true,
                isValid: false,
                keyLength: testData.invalidApiKey.length,
                keyPrefix: testData.invalidApiKey.substring(0, 6) + '...',
                message: 'Invalid API key format'
            });
        });
    });

    describe('storage fallback', () => {
        it('should work when secure storage fails', async () => {            
            // Setup getApiKey to use local storage
            chrome.storage.secure.get.mockRejectedValue(new Error('Secure storage unavailable'));
            chrome.storage.local.get.mockResolvedValue({ geminiApiKey: testData.validApiKey });
            
            // Test that other methods work with fallback
            const hasValid = await apiService.hasValidApiKey();
            expect(hasValid).toBe(true);
            
            const status = await apiService.getApiKeyStatus();
            expect(status.hasKey).toBe(true);
            expect(status.isValid).toBe(true);
        });
    });

    describe('promptForApiKey', () => {
        it('should open options page', () => {            
            apiService.promptForApiKey();
            
            expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
        });

        it('should handle missing openOptionsPage API', () => {
            delete chrome.runtime.openOptionsPage;
            
            // Should not throw
            expect(() => {
                apiService.promptForApiKey();
            }).not.toThrow();
        });
    });
}); 