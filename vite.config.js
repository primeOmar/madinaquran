import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  const agoraConfig = {
    appId: env.VITE_AGORA_APP_ID?.trim() || '',
    region: env.VITE_AGORA_REGION?.trim() || '',
    // New: Token authentication support
    useToken: env.VITE_AGORA_USE_TOKEN === 'true',
    tokenServer: env.VITE_AGORA_TOKEN_SERVER || ''
  }

  const isAppIdValid = agoraConfig.appId && 
                      !agoraConfig.appId.includes('your_') && 
                      agoraConfig.appId.length >= 10

  console.log('🔧 Agora Configuration:', {
    mode: mode.toUpperCase(),
    appId: isAppIdValid ? `${agoraConfig.appId.substring(0, 8)}...` : 'INVALID',
    region: agoraConfig.region || 'default',
    useToken: agoraConfig.useToken,
    tokenServer: agoraConfig.tokenServer ? 'CONFIGURED' : 'NOT SET'
  })

  if (mode === 'production' && !isAppIdValid) {
    console.error('❌ PRODUCTION BUILD: Invalid Agora App ID')
    process.exit(1)
  }

  return {
    plugins: [react()],
    base: './',
    
    define: {
      __AGORA_APP_ID__: JSON.stringify(agoraConfig.appId),
      __AGORA_REGION__: JSON.stringify(agoraConfig.region),
      __AGORA_USE_TOKEN__: JSON.stringify(agoraConfig.useToken),
      __AGORA_TOKEN_SERVER__: JSON.stringify(agoraConfig.tokenServer),
      __APP_ENV__: JSON.stringify(mode),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
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
      }
    },

    server: {
      port: 3000,
      cors: true,
      open: mode === 'development',
      proxy: {
        '/agora-token': {
          target: 'http://localhost:8080',
          changeOrigin: true
        }
      }
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
