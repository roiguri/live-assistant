// RetryService - Handles reconnection logic and network monitoring
globalThis.RetryService = class RetryService {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.attempts = 0;
    this.retryTimeout = null;
    this.onRetryCallback = null;
    this.onNetworkOnlineCallback = null;

    this.startNetworkMonitoring();
  }

  // Schedule retry with delay
  scheduleRetry(onRetry, error) {
    this.attempts++;

    // Max 1 retry (total 2 attempts including initial)
    if (this.attempts >= 1) {
      this.errorHandler.error('Retry', `Connection failed after ${this.attempts} attempts`);
      return false; // No more retries
    }

    // Schedule retry
    const delay = 1500; // 1.5 second delay
    this.errorHandler.info('Retry', `Retrying in ${delay}ms (attempt ${this.attempts + 1})`);

    this.onRetryCallback = onRetry;
    this.retryTimeout = setTimeout(() => {
      if (this.onRetryCallback) {
        this.onRetryCallback();
      }
    }, delay);

    return true; // Retry scheduled
  }

  // Stop any ongoing retries
  stopRetries() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.onRetryCallback = null;
  }

  // Reset attempt counter
  resetAttempts() {
    this.attempts = 0;
  }

  // Get current attempt count
  getAttempts() {
    return this.attempts;
  }

  // Network monitoring using browser events
  startNetworkMonitoring() {
    globalThis.addEventListener('online', () => {
      this.errorHandler.info('Network', 'Network came back online');
      if (this.onNetworkOnlineCallback) {
        this.onNetworkOnlineCallback();
      }
    });

    globalThis.addEventListener('offline', () => {
      this.errorHandler.info('Network', 'Network went offline');
    });
  }

  // Set callback for when network comes online
  onNetworkOnline(callback) {
    this.onNetworkOnlineCallback = callback;
  }

  // Check if browser is online
  isOnline() {
    return globalThis.navigator.onLine;
  }

  // Check network connectivity with fallback URLs
  async checkConnectivity() {
    const testUrls = [
      'https://generativelanguage.googleapis.com',
      'https://www.googleapis.com',
      'https://8.8.8.8'
    ];

    for (const url of testUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        this.errorHandler.debug('Network', `Connectivity check passed using ${url}`);
        return true;
      } catch (error) {
        this.errorHandler.debug('Network', `Check failed for ${url}: ${error.message}`);
      }
    }

    return false;
  }

  // Cleanup
  cleanup() {
    this.stopRetries();
    this.onNetworkOnlineCallback = null;
  }
};
