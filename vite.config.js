import { defineConfig } from 'vite'
import terser from '@rollup/plugin-terser'

export default defineConfig(({ command }) => ({
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
    // Zakáže source mapy v produkci – nikdo neuvidí původní kód
    sourcemap: false,
    // Použije Terser místo výchozí esbuild minifikace – agresivnější
    minify: 'terser',
    terserOptions: {
      compress: {
        // Odstraní všechna volání console.log / console.warn / console.error
        drop_console: true,
        drop_debugger: true,
        // Odstraní volání debug funkce dbg() použité v app.js
        pure_funcs: ['dbg'],
        // Agresivnější inline + dead-code elimination
        passes: 2,
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      mangle: {
        // Přejmenuje top-level názvy (proměnné, funkce) – ztíží čitelnost
        toplevel: true,
        // Přejmenuje i privátní vlastnosti objektů začínající __
        properties: {
          regex: /^__/
        }
      },
      format: {
        // Žádné komentáře v dist výstupu
        comments: false,
      }
    },
    rollupOptions: {
      input: {
        main: 'index.html',   // https://fitlime.cz/
        form: 'form.html'     // https://fitlime.cz/form.html
      },
      plugins: [
        // Terser jako Rollup plugin zajistí minifikaci i pro chunky
        command === 'build' ? terser({
          compress: { drop_console: true, drop_debugger: true, pure_funcs: ['dbg'], passes: 2 },
          mangle: { toplevel: true },
          format: { comments: false }
        }) : null
      ].filter(Boolean)
    }
  }
}))
