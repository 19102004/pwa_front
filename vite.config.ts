import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),{

      name: 'copy-sw-manual',
      closeBundle() {
        const srcPath = resolve(__dirname, 'public/sw.js')
        const destPath = resolve(__dirname, 'dist/sw.js')
        
        if (existsSync(srcPath)) {
          try {
            copyFileSync(srcPath, destPath)
            console.log('✅ Service Worker copiado exitosamente a dist/sw.js')
          } catch (err) {
            console.error('❌ Error copiando Service Worker:', err)
          }
        } else {
          console.error('❌ No se encontró public/sw.js')
        }
      }
    }
  ],

  build: {
    rollupOptions: {
      output: {
        // Fijar nombres sin hashes
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: ({ name }) => {
          if (!name) return 'assets/[name][extname]'
          if (name.endsWith('.css')) return 'assets/[name].css'
          return 'assets/[name][extname]'
        }
      }
    }
  }

})