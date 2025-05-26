// Stream Controller - Coordinates screen sharing functionality
window.StreamController = (function() {
    'use strict';
    
    async function toggleLiveShare(container) {
      const isActive = MenuView.getLiveShareState(container);
      
      if (isActive) {
        await stopStreaming(container);
      } else {
        await startStreaming(container);
      }
    }
    
    async function startStreaming(container) {
      // Add status message
      window.ChatUI.addMessage(container, 'Requesting screen share permission...', 'ai');
      
      const result = await window.ScreenCapture.startScreenShare();
      
      if (result.success) {
        // Start video streaming to Gemini
        chrome.runtime.sendMessage({ type: 'START_VIDEO_STREAM' });
        
        // Update UI state
        MenuView.updateLiveShareState(container, true);
        
        const stats = window.ScreenCapture.getStats();
        const message = `Screen sharing started! Capturing ${stats.width}x${stats.height} at ${stats.frameRate}fps`;
        window.ChatUI.addMessage(container, message, 'ai');
        
        return { success: true };
      } else {
        window.ChatUI.addMessage(container, `Failed to start screen sharing: ${result.error}`, 'ai');
        return { success: false, error: result.error };
      }
    }
    
    async function stopStreaming(container) {
      // Stop screen capture
      window.ScreenCapture.stopScreenShare();
      
      // Stop video streaming to Gemini
      chrome.runtime.sendMessage({ type: 'STOP_VIDEO_STREAM' });
      
      // Update UI state
      MenuView.updateLiveShareState(container, false);
      
      // Add status message
      window.ChatUI.addMessage(container, 'Screen sharing stopped.', 'ai');
      
      return { success: true };
    }
    
    function handleStreamEnd() {
      const container = document.getElementById('assistant-chat');
      if (!container) return;
      
      if (MenuView.getLiveShareState(container)) {
        // Reset UI when user stops sharing via browser (not our button)
        MenuView.updateLiveShareState(container, false);
        window.ChatUI.addMessage(container, 'Screen sharing ended.', 'ai');
        
        // Stop video streaming to Gemini
        chrome.runtime.sendMessage({ type: 'STOP_VIDEO_STREAM' });
      }
    }
    
    function getStreamingStatus() {
      return {
        isStreaming: MenuView.getLiveShareState(document.getElementById('assistant-chat')),
        isCapturing: window.ScreenCapture.isScreenSharing(),
        stats: window.ScreenCapture.getStats()
      };
    }
    
    // Public API
    return {
      toggleLiveShare,
      startStreaming,
      stopStreaming,
      handleStreamEnd,
      getStreamingStatus
    };
    
  })();