// MessageQueueService - Handles message timeout management
globalThis.MessageQueueService = class MessageQueueService {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.messageTimeouts = new Map();
    this.onTimeoutCallback = null;
  }

  // Set timeout for a message
  setMessageTimeout(messageId, timeoutMs = 5000) {
    // Clear existing timeout if any
    this.clearMessageTimeout(messageId);

    const timeoutId = setTimeout(() => {
      this.errorHandler.logWarning('MessageQueue', `Message timeout [${messageId}]`);
      if (this.onTimeoutCallback) {
        this.onTimeoutCallback(messageId);
      }
      this.messageTimeouts.delete(messageId);
    }, timeoutMs);

    this.messageTimeouts.set(messageId, timeoutId);
    this.errorHandler.debug('MessageQueue', `Timeout set for message ${messageId}`);
  }

  // Clear timeout for a specific message
  clearMessageTimeout(messageId) {
    if (this.messageTimeouts.has(messageId)) {
      const timeoutId = this.messageTimeouts.get(messageId);
      clearTimeout(timeoutId);
      this.messageTimeouts.delete(messageId);
      this.errorHandler.debug('MessageQueue', `Cleared timeout for message ${messageId}`);
    }
  }

  // Clear all message timeouts
  clearAllTimeouts() {
    this.messageTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.messageTimeouts.clear();
    this.errorHandler.debug('MessageQueue', 'Cleared all message timeouts');
  }

  // Set callback for timeout events
  onTimeout(callback) {
    this.onTimeoutCallback = callback;
  }

  // Get count of pending timeouts
  getPendingCount() {
    return this.messageTimeouts.size;
  }

  // Cleanup
  cleanup() {
    this.clearAllTimeouts();
    this.onTimeoutCallback = null;
  }
};
