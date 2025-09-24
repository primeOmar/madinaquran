import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // Ensure base is set to root
  build: {
    outDir: 'dist',
    assetsDir: 'assets', // This is causing the issue
    rollupOptions: {
      output: {
        // Remove assetsDir or fix the paths
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.jpg')) {
            return 'images/[name][extname]'
          }
          return 'assets/[name][extname]'
        }
      }
    }
  },
  server: {
    port: 3000
  }
})
