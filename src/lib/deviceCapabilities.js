// In deviceCapabilities.js - SIMPLIFIED WORKING VERSION
export const getDeviceCapabilities = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  
  // Simple feature detection
  const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  
  return {
    canScreenShare: hasGetDisplayMedia,
    isIOS,
    isAndroid,
    isDesktop: !isIOS && !isAndroid,
    screenShareMethod: hasGetDisplayMedia ? 'web' : 'none'
  };
};