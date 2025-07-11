// Popup Prompt Manager
const PromptManager = (function() {
    'use strict';
    
    const STORAGE_KEYS = {
        CUSTOM_PROMPTS: 'customPrompts',
        ACTIVE_PROMPT_INDEX: 'activePromptIndex'
    };

    async function getCustomPrompts() {
        try {
            const result = await chrome.storage.local.get([
                STORAGE_KEYS.CUSTOM_PROMPTS,
                STORAGE_KEYS.ACTIVE_PROMPT_INDEX
            ]);
            
            const customPrompts = result[STORAGE_KEYS.CUSTOM_PROMPTS] || [];
            const activePromptIndex = result[STORAGE_KEYS.ACTIVE_PROMPT_INDEX] ?? -1;
            
            return {
                customPrompts,
                activePromptIndex
            };
        } catch (error) {
            // Return default values on error - UI will handle gracefully
            return {
                customPrompts: [],
                activePromptIndex: -1
            };
        }
    }

    async function saveCustomPrompts(prompts, activeIndex) {
        try {
            if (!Array.isArray(prompts)) {
                return { success: false, error: 'Prompts must be an array' };
            }
            
            if (typeof activeIndex !== 'number' || activeIndex < -1) {
                return { success: false, error: 'Active index must be a number >= -1' };
            }
            
            if (activeIndex >= prompts.length) {
                return { success: false, error: 'Active index out of bounds' };
            }
            
            // Validate each prompt object
            for (let i = 0; i < prompts.length; i++) {
                const validation = validatePrompt(prompts[i]);
                if (!validation.valid) {
                    return { success: false, error: `Prompt ${i + 1}: ${validation.error}` };
                }
            }

            await chrome.storage.local.set({
                [STORAGE_KEYS.CUSTOM_PROMPTS]: prompts,
                [STORAGE_KEYS.ACTIVE_PROMPT_INDEX]: activeIndex
            });
            
            return { success: true };
        } catch (error) {
            // Return user-friendly error message - popup will display it
            return { success: false, error: error.message };
        }
    }

    function validatePrompt(prompt) {
        if (!prompt || typeof prompt !== 'object') {
            return { valid: false, error: 'Prompt must be an object' };
        }
        
        if (!prompt.name || typeof prompt.name !== 'string') {
            return { valid: false, error: 'Prompt name is required and must be text' };
        }
        
        if (prompt.name.trim().length === 0) {
            return { valid: false, error: 'Prompt name cannot be empty' };
        }
        
        if (prompt.name.length > 100) {
            return { valid: false, error: 'Prompt name too long (max 100 characters)' };
        }
        
        if (!prompt.prompt || typeof prompt.prompt !== 'string') {
            return { valid: false, error: 'Prompt text is required and must be text' };
        }
        
        if (prompt.prompt.trim().length === 0) {
            return { valid: false, error: 'Prompt text cannot be empty' };
        }
        
        if (prompt.prompt.length > 2000) {
            return { valid: false, error: 'Prompt text too long (max 2000 characters)' };
        }
        
        return { valid: true };
    }

    return {
        getCustomPrompts,
        saveCustomPrompts,
        validatePrompt
    };

})();