// Popup Prompt Manager - Simplified for popup context
const PromptManager = (function() {
    'use strict';
    
    const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.

Key capabilities:
- Analyze screen contentwhen provided with a screenshot and provide relevant insights
- Help with tasks based on screen context
- Maintain conversation continuity across interactions

Guidelines:
- Be concise but helpful in your responses
- Reference specific elements you see on screen when relevant
- Ask clarifying questions if the user's intent is unclear
- Respect user privacy and avoid commenting on sensitive information`;

    const STORAGE_KEY = 'customInstructions';

    async function getSystemPrompt() {
        return DEFAULT_SYSTEM_PROMPT;
    }

    async function getCustomInstructions() {
        try {
            const result = await chrome.storage.local.get([STORAGE_KEY]);
            return result[STORAGE_KEY] || '';
        } catch (error) {
            console.error('Failed to get custom instructions:', error);
            return '';
        }
    }

    async function setCustomInstructions(instructions) {
        try {
            if (typeof instructions !== 'string') {
                throw new Error('Instructions must be a string');
            }
            
            if (instructions.length > 2000) {
                throw new Error('Instructions too long (max 2000 characters)');
            }

            await chrome.storage.local.set({
                [STORAGE_KEY]: instructions.trim()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Failed to save custom instructions:', error);
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
        getSystemPrompt,
        getCustomInstructions,
        setCustomInstructions,
        validateInstructions
    };

})();