import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    
    // 🔥 CRITICAL:  proxy configuration  fix the HTML response error
    proxy: {
      '/api': {
        target: 'http://localhost:3001', //  backend server
        changeOrigin: true,
        secure: false,
        // Additional configuration for better handling
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying request to:', req.url);
          });
        }
      },
      // Also proxy websocket connections for hot reload
      '/@react-refresh': {
        target: 'ws://localhost:5173',
        ws: true
      }
    },
    
    // options to prevent cache issues
    watch: {
      usePolling: true
    }
  },
  optimizeDeps: {
    // Explicitly include problematic dependencies
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@supabase/supabase-js',
      'lucide-react'
    ],
    // Exclude large or problematic packages
    exclude: ['@react-oauth/google'] // Remove if not using Google OAuth
  },
  build: {
    // Add chunk size warnings
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react', 'framer-motion'],
          utils: ['@supabase/supabase-js']
        }
      }
    }
  }
});