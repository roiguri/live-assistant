// Popup Prompt Manager - Simplified for popup context
const PromptManager = (function() {
    'use strict';
    
    const STORAGE_KEY = 'customInstructions';

    async function getCustomInstructions() {
        try {
            const result = await chrome.storage.local.get([STORAGE_KEY]);
            return result[STORAGE_KEY] || '';
        } catch (error) {
          // Silently return empty string on error - UI will handle gracefully
          return '';
        }
    }

    async function setCustomInstructions(instructions) {
        try {
            if (typeof instructions !== 'string') {
                return { success: false, error: 'Instructions must be a string' };
            }
            
            if (instructions.length > 2000) {
                return { success: false, error: 'Instructions too long (max 2000 characters)' };
            }

            await chrome.storage.local.set({
                [STORAGE_KEY]: instructions.trim()
            });
            
            return { success: true };
        } catch (error) {
            // Return user-friendly error message - popup will display it
            return { success: false, error: error.message };
        }
    }

    function validateInstructions(instructions) {
        if (typeof instructions !== 'string') {
            return { valid: false, error: 'Instructions must be text' };
        }
        
        if (instructions.length > 2000) {
            return { valid: false, error: 'Too long (max 2000 characters)' };
        }
        
        return { valid: true };
    }

    return {
        getCustomInstructions,
        setCustomInstructions,
        validateInstructions
    };

})();