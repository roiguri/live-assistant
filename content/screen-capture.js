// Screen Capture Module - WebRTC Screen Sharing
window.ScreenCapture = (function() {
    'use strict';
    
    let mediaStream = null;
    let isCapturing = false;
    
    async function startScreenShare() {
      try {
        // Request screen share permission
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 60 }
              },
              audio: false,
              selfBrowserSurface: "include"
        });
        
        isCapturing = true;
        
        // Handle stream end (when user stops sharing)
        mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
          handleStreamEnded();
        });
        
        console.log('Screen capture started successfully');
        return { success: true, stream: mediaStream };
        
      } catch (error) {
        console.error('Screen capture failed:', error);
        
        let errorMessage = 'Screen sharing failed';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Screen sharing permission denied';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Screen sharing not supported in this browser';
        } else if (error.name === 'AbortError') {
          errorMessage = 'Screen sharing was cancelled';
        }
        
        return { success: false, error: errorMessage };
      }
    }
    
    function stopScreenShare() {
      if (mediaStream) {
        // Stop all tracks
        mediaStream.getTracks().forEach(track => {
          track.stop();
        });
        
        mediaStream = null;
        isCapturing = false;
        
        console.log('Screen capture stopped');
      }
    }
    
    function handleStreamEnded() {
      // Called when user stops sharing via browser UI
      mediaStream = null;
      isCapturing = false;
      
      // Notify chat interface that sharing stopped
      if (window.ChatEvents && window.ChatEvents.onScreenShareEnded) {
        window.ChatEvents.onScreenShareEnded();
      }
      
      console.log('Screen sharing ended by user');
    }
    
    function getMediaStream() {
      return mediaStream;
    }
    
    function isScreenSharing() {
      return isCapturing && mediaStream && mediaStream.active;
    }
    
    // Capture a single frame as base64 image (for testing/preview)
    async function captureFrame() {
      if (!isScreenSharing()) {
        return null;
      }
      
      try {
        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.play();
        
        return new Promise((resolve) => {
          video.addEventListener('loadedmetadata', () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            ctx.drawImage(video, 0, 0);
            
            const frameData = canvas.toDataURL('image/jpeg', 0.8);
            video.remove();
            canvas.remove();
            
            resolve(frameData);
          });
        });
      } catch (error) {
        console.error('Frame capture failed:', error);
        return null;
      }
    }
    
    // Get screen sharing statistics
    function getStats() {
      if (!isScreenSharing()) {
        return null;
      }
      
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      return {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        isActive: videoTrack.enabled && videoTrack.readyState === 'live'
      };
    }
    
    // Public API
    return {
      startScreenShare,
      stopScreenShare,
      isScreenSharing,
      getMediaStream,
      captureFrame,
      getStats
    };
    
  })();