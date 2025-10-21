import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '')
  
  // Validate Agora configuration
  const agoraAppId = env.VITE_AGORA_APP_ID?.trim() || ''
  const agoraRegion = env.VITE_AGORA_REGION?.trim() || ''
  
  // Enhanced validation with specific checks
  const isAppIdValid = agoraAppId && 
                      !agoraAppId.includes('your_') && 
                      agoraAppId.length >= 10 &&
                      !agoraAppId.includes(' ') &&
                      agoraAppId.indexOf('#') === -1

  console.log('🔧 Vite Configuration Analysis:', {
    mode: mode.toUpperCase(),
    appIdProvided: !!agoraAppId,
    appIdValid: isAppIdValid,
    appIdPreview: isAppIdValid ? `${agoraAppId.substring(0, 8)}...${agoraAppId.substring(agoraAppId.length - 4)}` : 'INVALID',
    region: agoraRegion || 'default',
    nodeEnv: process.env.NODE_ENV
  })

  if (mode === 'production' && !isAppIdValid) {
    console.error('❌ PRODUCTION BUILD BLOCKED: Invalid Agora App ID')
    console.error('💡 Please check:')
    console.error('   1. VITE_AGORA_APP_ID in .env.production')
    console.error('   2. App ID format (32-character hex string)')
    console.error('   3. No spaces or special characters')
    process.exit(1)
  }

  return {
    plugins: [react()],
    base: './',
    
    // Critical: Define global constants for build-time replacement
    define: {
      __AGORA_APP_ID__: JSON.stringify(agoraAppId),
      __AGORA_REGION__: JSON.stringify(agoraRegion),
      __APP_ENV__: JSON.stringify(mode),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
      __AGORA_APP_ID_VALID__: JSON.stringify(isAppIdValid)
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
      
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      },
      
      // Clear output directory
      emptyOutDir: true
    },

    server: {
      port: 3000,
      cors: true,
      open: mode === 'development'
    },

    preview: {
      port: 3000,
      host: true
    },

    css: {
      devSourcemap: true
    },

    optimizeDeps: {
      include: ['agora-rtc-sdk-ng'],
      exclude: []
    }
  }
})
