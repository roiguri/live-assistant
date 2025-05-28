// Error Handler Service - Centralized error handling and logging
globalThis.ErrorHandler = class ErrorHandler {
    constructor() {
        this.logLevel = 'info'; // 'error', 'warn', 'info', 'debug'
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    // Set logging level
    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.logLevel = level;
        }
    }

    // Internal logging method
    _log(level, component, message, data = null) {
        if (this.logLevels[level] <= this.logLevels[this.logLevel]) {
            const timestamp = new Date().toISOString().substr(11, 12);
            const prefix = `[${timestamp}] AI Assistant (${component}):`;
            
            if (data) {
                console[level](prefix, message, data);
            } else {
                console[level](prefix, message);
            }
        }
    }

    // Logging methods
    error(component, message, data = null) {
        this._log('error', component, message, data);
    }

    warn(component, message, data = null) {
        this._log('warn', component, message, data);
    }

    info(component, message, data = null) {
        this._log('info', component, message, data);
    }

    debug(component, message, data = null) {
        this._log('debug', component, message, data);
    }

    // Handle connection errors with user notification
    handleConnectionError(error, context = 'Connection') {
        this.error('Connection', `${context} error: ${error}`);
        
        // Determine user-friendly message
        let userMessage = 'Connection failed';
        if (error.includes('API key')) {
            userMessage = 'Please check your API key in settings';
        } else if (error.includes('network') || error.includes('fetch')) {
            userMessage = 'Network error - please check your internet connection';
        } else if (error.includes('timeout')) {
            userMessage = 'Request timed out - please try again';
        }

        // Send to content scripts
        this._notifyContentScripts('CONNECTION_ERROR', {
            error: userMessage,
            technical: error
        });

        return userMessage;
    }

    // Handle API errors with user notification
    handleApiError(error, context = 'API') {
        this.error('API', `${context} error: ${error}`);
        
        let userMessage = 'AI service error';
        if (error.includes('401') || error.includes('403')) {
            userMessage = 'Invalid API key - please check your settings';
        } else if (error.includes('429')) {
            userMessage = 'Rate limit exceeded - please wait a moment';
        } else if (error.includes('500') || error.includes('502') || error.includes('503')) {
            userMessage = 'AI service temporarily unavailable';
        }

        this._notifyContentScripts('API_ERROR', {
            error: userMessage,
            technical: error
        });

        return userMessage;
    }

    // Handle message send errors
    handleMessageError(error, messageText = '') {
        this.error('Message', `Failed to send message: ${error}`);
        
        const userMessage = messageText.length > 50 
            ? 'Failed to send message - please try again'
            : `Failed to send "${messageText}" - please try again`;

        this._notifyContentScripts('MESSAGE_ERROR', {
            error: userMessage,
            originalMessage: messageText
        });

        return userMessage;
    }

    // Handle screenshot errors
    handleScreenshotError(error) {
        this.error('Screenshot', `Screenshot failed: ${error}`);
        
        let userMessage = 'Screenshot failed';
        if (error.includes('permission')) {
            userMessage = 'Screenshot permission denied';
        } else if (error.includes('tab')) {
            userMessage = 'Cannot capture this tab';
        }

        this._notifyContentScripts('SCREENSHOT_ERROR', {
            error: userMessage
        });

        return userMessage;
    }

    // Handle storage errors
    handleStorageError(error, operation = 'storage') {
        this.error('Storage', `${operation} failed: ${error}`);
        
        const userMessage = 'Settings could not be saved - please try again';
        
        return userMessage;
    }

    // Log successful operations (info level)
    logSuccess(component, operation, details = null) {
        this.info(component, `${operation} successful`, details);
    }

    // Log warnings for non-critical issues
    logWarning(component, issue, details = null) {
        this.warn(component, issue, details);
    }

    // Track performance metrics
    logPerformance(component, operation, duration) {
        if (duration > 5000) { // Log slow operations
            this.warn(component, `Slow ${operation}: ${duration}ms`);
        } else {
            this.debug(component, `${operation}: ${duration}ms`);
        }
    }

    // Notify content scripts of errors
    _notifyContentScripts(type, data) {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: type,
                        ...data
                    }).catch(() => {
                        // Ignore errors for tabs without content script
                    });
                });
            });
        }
    }

    // Format error for development
    formatError(error, context = '') {
        const timestamp = new Date().toISOString();
        return {
            timestamp,
            context,
            message: error.message || error,
            stack: error.stack || null,
            type: error.name || 'Error'
        };
    }

    // Create standard error response
    createErrorResponse(message, code = 'UNKNOWN_ERROR') {
        return {
            success: false,
            error: message,
            code: code,
            timestamp: Date.now()
        };
    }

    // Create success response
    createSuccessResponse(data = null, message = null) {
        const response = {
            success: true,
            timestamp: Date.now()
        };
        
        if (data) response.data = data;
        if (message) response.message = message;
        
        return response;
    }
};