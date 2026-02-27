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
      '/mail': 'http://localhost:8000',
      '/discounts': 'http://localhost:8000'
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',   // https://fitlime.cz/
        form: 'form.html'     // https://fitlime.cz/form.html
      }
    }
  }
})
