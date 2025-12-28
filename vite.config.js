import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/orders': 'http://localhost:8000',
      '/payments': 'http://localhost:8000',
      '/mail': 'http://localhost:8000'
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
