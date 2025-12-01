
export const AgoraConfig = {
  appId: process.env.NEXT_PUBLIC_AGORA_APP_ID,
  // Enable more reliable codec and mode
  codec: 'h264',
  mode: 'rtc',
  
  // Retry configuration
  retryConfig: {
    maxRetries: 3,
    timeout: 10000,
    backoffMultiplier: 2
  },
  
  // Fallback server configuration
  fallbackConfig: {
    enableFallback: true,
    serverUrls: [
      'wss://webrtc2.ap.agora.io',
      'wss://webrtc2.ap.sd-rtn.com',
      'wss://webrtc2.ap.sd-rtn.com'
    ]
  }
};
