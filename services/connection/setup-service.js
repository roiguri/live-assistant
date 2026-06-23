// SetupService - Handles initial setup flow and configuration
globalThis.SetupService = class SetupService {
  constructor(geminiClient, errorHandler) {
    this.geminiClient = geminiClient;
    this.errorHandler = errorHandler;
    this.setupTimeout = null;
    this.onSetupComplete = null;
    this.onSetupError = null;
  }

  // Send setup message and wait for completion
  async sendSetupAndWait(websocketService) {
    return new Promise(async (resolve, reject) => {
      // Set up completion handlers
      this.onSetupComplete = () => {
        this.clearSetupTimeout();
        resolve();
      };

      this.onSetupError = (error) => {
        this.clearSetupTimeout();
        reject(new Error(error));
      };

      // Setup timeout
      this.setupTimeout = setTimeout(() => {
        reject(new Error('Setup timeout - check API key'));
      }, 5000);

      // Get configuration
      const systemPrompt = await this.getCombinedSystemPrompt();
      const selectedModel = await this.getSelectedModel();

      // Create and send setup message
      const setupMessage = this.geminiClient.createSetupMessage(systemPrompt, selectedModel);

      try {
        websocketService.send(setupMessage);
        this.errorHandler.debug('Setup', 'Setup message sent');
      } catch (error) {
        this.clearSetupTimeout();
        reject(error);
      }
    });
  }

  // Handle setup completion
  handleSetupComplete() {
    if (this.onSetupComplete) {
      this.onSetupComplete();
      this.onSetupComplete = null;
      this.onSetupError = null;
    }
  }

  // Handle setup error
  handleSetupError(error) {
    if (this.onSetupError) {
      this.onSetupError(error);
      this.onSetupComplete = null;
      this.onSetupError = null;
    }
  }

  // Get combined system prompt (default + custom)
  async getCombinedSystemPrompt() {
    try {
      const defaultPrompt = this.getDefaultSystemPrompt();

      const result = await chrome.storage.local.get(['customPrompts', 'activePromptIndex']);
      const customPrompts = result.customPrompts || [];
      const activePromptIndex = result.activePromptIndex ?? -1;

      if (activePromptIndex === -1 || activePromptIndex >= customPrompts.length) {
        return defaultPrompt;
      }

      const activePrompt = customPrompts[activePromptIndex];
      if (!activePrompt || !activePrompt.prompt) {
        return defaultPrompt;
      }

      return `${defaultPrompt}\n\nUser Instructions:\n${activePrompt.prompt}`;
    } catch (error) {
      this.errorHandler.handleStorageError(error, 'get custom prompt');
      return this.getDefaultSystemPrompt();
    }
  }

  // Get selected model
  async getSelectedModel() {
    try {
      const result = await chrome.storage.local.get(['selectedModel']);
      const selectedModel = result.selectedModel || 'gemini-2.0-flash-live-001';
      this.errorHandler.debug('Setup', `Retrieved model: ${selectedModel}`);
      return selectedModel;
    } catch (error) {
      this.errorHandler.handleStorageError(error, 'get selected model');
      this.errorHandler.debug('Setup', 'Falling back to default model');
      return 'gemini-2.0-flash-live-001';
    }
  }

  // Default system prompt
  getDefaultSystemPrompt() {
    return `You are a helpful AI assistant.

Key capabilities:
- Answer questions from user.
- Analyze screenshots given and provide relevant insights

Guidelines:
- Be concise but helpful in your responses
- Reference specific elements you see on screenshots when relevant
- Ask clarifying questions if the user's intent is unclear
- Respect user privacy and avoid commenting on sensitive information`;
  }

  // Clear setup timeout
  clearSetupTimeout() {
    if (this.setupTimeout) {
      clearTimeout(this.setupTimeout);
      this.setupTimeout = null;
    }
  }

  // Cleanup
  cleanup() {
    this.clearSetupTimeout();
    this.onSetupComplete = null;
    this.onSetupError = null;
  }
};
