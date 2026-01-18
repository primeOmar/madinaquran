import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      'react-native-agora': path.resolve(__dirname, './react-native-agora-mock.js'),
    },
  },
  optimizeDeps: {
    include: [
      'agora-rtc-sdk-ng', 
      'lucide-react', 
      'src/lib/agora/videoApi.js',
      'react-native-web'
    ],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      external: ['capacitor-agora-screenshare'],
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  server: {
    port: 3000,
    host: true
  },
  define: {
    'process.env': {},
    global: 'window',
  }
})