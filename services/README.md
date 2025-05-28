# Error Handler Usage Guide

## Quick Setup

```javascript
// In any service class
constructor() {
    this.errorHandler = new globalThis.ErrorHandler();
}
```

## Basic Logging

```javascript
// Different log levels (only shows if log level allows)
this.errorHandler.error('ComponentName', 'Something failed', errorData);
this.errorHandler.warn('ComponentName', 'Potential issue', warningData);
this.errorHandler.info('ComponentName', 'Operation completed', details);
this.errorHandler.debug('ComponentName', 'Debug info', debugData);
```

## Specialized Error Handling

```javascript
// Connection errors (shows user-friendly messages)
const userMessage = this.errorHandler.handleConnectionError(error.message);

// API errors (handles 401, 429, 500, etc.)
const userMessage = this.errorHandler.handleApiError(error.message);

// Message send failures
const userMessage = this.errorHandler.handleMessageError(error.message, originalText);

// Screenshot failures  
const userMessage = this.errorHandler.handleScreenshotError(error.message);

// Storage/settings errors
const userMessage = this.errorHandler.handleStorageError(error.message, 'save settings');
```

## Success & Performance Tracking

```javascript
// Log successful operations
this.errorHandler.logSuccess('Connection', 'Connected to API');

// Track slow operations
const startTime = Date.now();
// ... do work ...
this.errorHandler.logPerformance('Screenshot', 'capture', Date.now() - startTime);
```

## Response Helpers

```javascript
// Create standardized responses
return this.errorHandler.createErrorResponse('Connection failed', 'CONN_ERROR');
return this.errorHandler.createSuccessResponse(data, 'Operation completed');
```

## Log Level Control

```javascript
// Set in background.js for production
errorHandler.setLogLevel('info');  // Only error, warn, info
errorHandler.setLogLevel('debug'); // All logs (development)
```

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Critical failures that affect functionality | API connection failed, parsing errors |
| `warn` | Issues that don't break functionality | Unknown response format, cleanup operations |
| `info` | Important operational events | Connection established, messages sent |
| `debug` | Detailed debugging information | Message IDs, response processing steps |

## Error Categories

### Connection Errors
- Automatically shows user-friendly messages
- Handles network timeouts, API key issues
- Notifies all content scripts

### API Errors  
- Maps HTTP status codes to user messages
- Handles rate limits, authentication, server errors
- Provides actionable feedback

### Message Errors
- Tracks failed message sends
- Shows partial message text for context
- Suggests retry actions

### Storage Errors
- Handles settings save/load failures
- Browser storage permission issues
- Provides fallback instructions

## Best Practices

### ✅ Good Usage
```javascript
// Specific component names
this.errorHandler.error('ConnectionManager', 'WebSocket failed', error);

// Structured data instead of strings
this.errorHandler.debug('GeminiClient', 'Message created', { 
    messageId, 
    textLength: text.length 
});

// Use specialized handlers
const userMsg = this.errorHandler.handleApiError(response.statusText);
```

### ❌ Avoid
```javascript
// Generic component names
this.errorHandler.error('App', 'Error happened');

// Logging sensitive data
this.errorHandler.debug('API', 'Request', { apiKey: 'secret123' });

// Direct console.log instead of error handler
console.log('Debug info');
```