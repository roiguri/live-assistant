# Chrome Extension Manual Testing Guide
*Live Stream AI Assistant - Version 1.0*

## Prerequisites
- Chrome browser (latest version)
- Valid Gemini API key from [Google AI Studio](https://aistudio.google.com/)
- Internet connection
- Test websites (e.g., google.com, github.com, news sites)

---

## 1. Extension Management

### Basic Tests

#### 1.1 Installation
- [ ] Load unpacked extension in Chrome Developer Mode
- [ ] Extension icon appears in toolbar
- [ ] No console errors in extension pages
- [ ] **Expected:** Extension loads successfully, icon visible

#### 1.2 Permissions
- [ ] Extension requests appropriate permissions on install
- [ ] Can access all websites (`<all_urls>`)
- [ ] Storage permission granted
- [ ] **Expected:** All required permissions granted without issues

### Comprehensive Tests

#### 1.3 Extension States
- [ ] Enable/disable extension via chrome://extensions
- [ ] Extension survives browser restart
- [ ] Works in incognito mode (if enabled)
- [ ] **Expected:** Extension maintains functionality across state changes

#### 1.4 Multiple Tabs
- [ ] Extension works across multiple tabs simultaneously
- [ ] No conflicts between tabs
- [ ] Settings persist across tabs
- [ ] **Expected:** Consistent behavior across all tabs

---

## 2. API Configuration & Testing

### Basic Tests

#### 2.1 API Key Setup
- [ ] Click extension icon to open popup
- [ ] Navigate to General tab
- [ ] Enter valid Gemini API key
- [ ] Click "Save" button
- [ ] **Expected:** "API key saved successfully!" message appears

#### 2.2 API Key Validation
- [ ] Enter valid API key
- [ ] Click "Test" button
- [ ] **Expected:** "✓ API key is valid!" message appears
- [ ] Check browser console for connection logs (if needed)

#### 2.3 Settings Persistence
- [ ] Save API key and close popup
- [ ] Reopen popup
- [ ] **Expected:** API key field shows saved key (masked)

### Comprehensive Tests

#### 2.4 Invalid API Keys
- [ ] Enter invalid API key (wrong format)
- [ ] Click "Test"
- [ ] **Expected:** "Invalid API key format" error
- [ ] Try empty key: **Expected:** "Please enter an API key" error
- [ ] Try expired/revoked key: **Expected:** "✗ API key is invalid or expired" error

#### 2.5 Network Issues
- [ ] Disconnect internet
- [ ] Try to test API key
- [ ] **Expected:** "Failed to test API key" error
- [ ] Reconnect internet and retest
- [ ] **Expected:** Normal validation resumes

#### 2.6 Storage Fallback
- [ ] Test API key storage in different modes
- [ ] Verify fallback from secure to local storage
- [ ] **Expected:** API key saved regardless of storage method

---

## 3. Chat Interface

### Basic Tests

#### 3.1 Chat Visibility
- [ ] Toggle "Show chat on websites" in popup
- [ ] Visit any website
- [ ] **Expected:** Chat appears/disappears in bottom-right corner

#### 3.2 UI State Transitions
- [ ] Default state: minimal (input only)
- [ ] Send message and receive response
- [ ] **Expected:** Transitions to recent state (shows last AI message)
- [ ] Click chat history icon (💬)
- [ ] **Expected:** Transitions to full state (shows all messages)

#### 3.3 Input Functionality
- [ ] Type message in input field
- [ ] Press Enter to send
- [ ] **Expected:** Message appears in chat, input clears
- [ ] Try clicking send button
- [ ] **Expected:** Same behavior as Enter key

#### 3.4 Keyboard Shortcuts
- [ ] Press Ctrl+Shift+L (Cmd+Shift+L on Mac)
- [ ] **Expected:** Chat visibility toggles
- [ ] Press Ctrl+Shift+F (Cmd+Shift+F on Mac)
- [ ] **Expected:** Chat appears and input gets focus
- [ ] Press Ctrl+Shift+S (Cmd+Shift+S on Mac)
- [ ] **Expected:** Screenshot taken and sent to AI

### Comprehensive Tests

#### 3.5 Drag and Drop
- [ ] Click and drag the drag handle (⋮⋮)
- [ ] Move chat to different corners
- [ ] **Expected:** Chat repositions smoothly, stays within viewport
- [ ] Try dragging outside viewport bounds
- [ ] **Expected:** Chat constrained to visible area

#### 3.6 Menu Interactions
- [ ] Hover over chat interface
- [ ] **Expected:** Context menu appears
- [ ] Click screenshot button (📸)
- [ ] **Expected:** Screenshot captured and sent
- [ ] Click clear chat button (🗑️)
- [ ] Confirm deletion
- [ ] **Expected:** All messages cleared, returns to minimal state

#### 3.7 Browser Interactions
- [ ] Resize browser window with chat open
- [ ] **Expected:** Chat repositions to stay visible
- [ ] Switch between tabs
- [ ] **Expected:** Chat state persists per tab
- [ ] Refresh page with chat open
- [ ] **Expected:** Chat reappears, context may reset (expected behavior)

#### 3.8 Input Edge Cases
- [ ] Send empty message
- [ ] **Expected:** Nothing happens, send button disabled
- [ ] Send very long message (500+ characters)
- [ ] **Expected:** Message sends normally
- [ ] Send message with special characters/emojis
- [ ] **Expected:** Characters preserved in display

---

## 4. AI Integration

### Basic Tests

#### 4.1 Text Messages
- [ ] Send simple question: "What is 2+2?"
- [ ] **Expected:** AI responds with answer
- [ ] Verify typing indicator appears
- [ ] **Expected:** "AI is thinking..." shows briefly
- [ ] Check response appears in correct format
- [ ] **Expected:** AI message styled differently from user message

#### 4.2 Screenshot Functionality
- [ ] Navigate to visually rich webpage
- [ ] Click screenshot button (📸) or use Ctrl+Shift+S
- [ ] **Expected:** "Screenshot sent" system message appears
- [ ] Wait for AI response
- [ ] **Expected:** AI describes what it sees in the screenshot

#### 4.3 Connection Status
- [ ] Check connection indicator when chat is open
- [ ] **Expected:** Green indicator when connected
- [ ] Send message successfully
- [ ] **Expected:** No connection errors

### Comprehensive Tests

#### 4.4 Response Handling
- [ ] Send multiple messages quickly
- [ ] **Expected:** All messages queue and get responses
- [ ] Send message while AI is responding
- [ ] **Expected:** New message waits for current response to complete

#### 4.5 Screenshot Edge Cases
- [ ] Take screenshot of blank page
- [ ] **Expected:** AI acknowledges blank/minimal content
- [ ] Take screenshot of page with chat visible
- [ ] **Expected:** AI may mention seeing chat interface
- [ ] Take screenshot on protected pages (chrome://)
- [ ] **Expected:** Graceful error handling

#### 4.6 Connection Issues
- [ ] Disconnect internet after connecting
- [ ] Try to send message
- [ ] **Expected:** "Not connected to AI service" error
- [ ] Reconnect internet
- [ ] Click "Reconnect" button if available
- [ ] **Expected:** Connection restored, can send messages

#### 4.7 API Rate Limiting
- [ ] Send many messages rapidly (10+ in quick succession)
- [ ] **Expected:** Either all process or rate limit error appears
- [ ] Wait and try again
- [ ] **Expected:** Service resumes normally

#### 4.8 Long Conversations
- [ ] Have extended conversation (20+ exchanges)
- [ ] **Expected:** All messages visible in full chat view
- [ ] Check recent view shows only last AI message
- [ ] **Expected:** Recent area updates correctly

---

## 5. Settings & Customization

### Basic Tests

#### 5.1 Custom Instructions
- [ ] Open popup, go to Prompts tab
- [ ] Add custom instructions: "Always be very brief"
- [ ] Click "Save"
- [ ] **Expected:** "Instructions saved successfully!" message
- [ ] Test with new conversation
- [ ] **Expected:** AI follows custom instructions

#### 5.2 Settings Persistence
- [ ] Configure all settings (API key, visibility, instructions)
- [ ] Close browser completely
- [ ] Reopen and check settings
- [ ] **Expected:** All settings preserved

### Comprehensive Tests

#### 5.3 Custom Instructions Edge Cases
- [ ] Try very long instructions (1900+ characters)
- [ ] **Expected:** Character counter shows warning near limit
- [ ] Try exceeding 2000 character limit
- [ ] **Expected:** Save button disabled, error message shown
- [ ] Clear instructions and save
- [ ] **Expected:** AI returns to default behavior

#### 5.4 Settings Conflicts
- [ ] Set custom instructions, then change API key
- [ ] **Expected:** Instructions persist with new key
- [ ] Toggle chat visibility while chat is open
- [ ] **Expected:** Chat hides/shows immediately

---

## 6. Error Recovery

### Basic Tests

#### 6.1 Connection Recovery
- [ ] Start with working connection
- [ ] Disconnect internet briefly (30 seconds)
- [ ] Reconnect internet
- [ ] **Expected:** Connection automatically restores
- [ ] Try sending message
- [ ] **Expected:** Message sends successfully

#### 6.2 Manual Reconnection
- [ ] When connection shows as failed
- [ ] Click "Reconnect" button
- [ ] **Expected:** Connection attempt initiated
- [ ] **Expected:** Status updates to "Connecting..." then "Connected"

### Comprehensive Tests

#### 6.3 API Key Issues
- [ ] Start with valid API key and working chat
- [ ] Change to invalid API key in settings
- [ ] Try to send message
- [ ] **Expected:** "Please check your API key" error
- [ ] Restore valid API key
- [ ] **Expected:** Connection resumes

#### 6.4 Browser Resource Issues
- [ ] Open many tabs (20+) with extension
- [ ] **Expected:** Extension continues working
- [ ] Use chat in multiple tabs simultaneously
- [ ] **Expected:** No conflicts or errors

#### 6.5 Page Navigation
- [ ] Open 2 tabs
- [ ] Start conversation on one tab
- [ ] Navigate to second tab
- [ ] **Expected:** Chat appears on second tab with chat history.
- [ ] Create new tab
- [ ] **Expected:** Chat loads all history (same as both opened tabs).
- [ ] Clear converation and close chat to minimal view.
- [ ] **Expected:** Chat should be clear and minimal in all tabs.
- [ ] Use keyboard shortcuts on new page
- [ ] **Expected:** Shortcuts work correctly

---

## Common Issues & Solutions

### Chat Not Appearing
- Check extension is enabled
- Verify "Show chat on websites" is toggled on
- Try refreshing the page

### API Connection Fails
- Verify API key is correct and valid
- Check internet connection
- Try manual reconnection

### Screenshots Not Working
- Check tab permissions
- Verify not on restricted pages (chrome://)
- Try on regular websites

### Settings Not Saving
- Check Chrome storage permissions
- Try restarting browser
- Verify popup closes properly after saving

---

## Testing Checklist Summary

**Basic Tests Completed:** ___/25
**Comprehensive Tests Completed:** ___/20
**Critical Issues Found:** ___
**Minor Issues Found:** ___

**Overall Status:** ⭕ Pass / ❌ Fail / ⚠️ Pass with Issues

**Notes:**
_Use this space to document any specific issues, unusual behavior, or additional observations._