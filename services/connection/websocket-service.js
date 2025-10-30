// WebSocketService - Pure WebSocket lifecycle management
globalThis.WebSocketService = class WebSocketService {
  constructor(errorHandler) {
    this.ws = null;
    this.errorHandler = errorHandler;
    this.eventHandlers = {
      onOpen: null,
      onClose: null,
      onError: null,
      onMessage: null
    };
  }

  // Create and connect WebSocket
  async connect(apiKey) {
    return new Promise((resolve, reject) => {
      this.cleanup();

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      this.ws = new globalThis.WebSocket(wsUrl);

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.errorHandler.debug('WebSocket', 'Connection opened');
        if (this.eventHandlers.onOpen) {
          this.eventHandlers.onOpen();
        }
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.errorHandler.debug('WebSocket', 'Connection error');
        if (this.eventHandlers.onError) {
          this.eventHandlers.onError(error);
        }
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.errorHandler.debug('WebSocket', `Connection closed: code=${event.code}, reason=${event.reason}`);
        if (this.eventHandlers.onClose) {
          this.eventHandlers.onClose(event);
        }
      };

      this.ws.onmessage = (event) => {
        if (this.eventHandlers.onMessage) {
          this.eventHandlers.onMessage(event.data);
        }
      };
    });
  }

  // Send message through WebSocket
  send(data) {
    if (!this.isOpen()) {
      throw new Error('WebSocket not open');
    }
    this.ws.send(JSON.stringify(data));
  }

  // Check if WebSocket is open
  isOpen() {
    return this.ws && this.ws.readyState === globalThis.WebSocket.OPEN;
  }

  // Get current WebSocket state
  getReadyState() {
    return this.ws ? this.ws.readyState : null;
  }

  // Register event handlers
  setEventHandlers(handlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Clean up WebSocket connection
  cleanup() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      if (this.ws.readyState === globalThis.WebSocket.OPEN ||
          this.ws.readyState === globalThis.WebSocket.CONNECTING) {
        this.ws.close(1000, 'Connection cleanup');
      }
      this.ws = null;
    }
  }
};
