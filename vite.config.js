import { defineConfig } from 'vite'

const terserOptions = {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['dbg'],
    passes: 2,
    unsafe_arrows: true,
    unsafe_methods: true,
  },
  mangle: {
    toplevel: true,
    properties: {
      regex: /^__/
    }
  },
  format: {
    comments: false,
  }
}

export default defineConfig(async ({ command }) => {
  const isBuild = command === 'build'
  let useTerserMinify = false
  let terserPlugin = null

  if (isBuild) {
    try {
      await import('terser')
      useTerserMinify = true
    } catch {
      console.warn('[vite] Optional dependency "terser" is missing. Falling back to esbuild minification.')
    }

    if (useTerserMinify) {
      try {
        const { default: terser } = await import('@rollup/plugin-terser')
        terserPlugin = terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['dbg'],
            passes: 2
          },
          mangle: {
            toplevel: true
          },
          format: {
            comments: false
          }
        })
      } catch {
        console.warn('[vite] Optional dependency "@rollup/plugin-terser" is missing. Using Vite minification only.')
      }
    }
  }

  return {
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
      sourcemap: false,
      minify: useTerserMinify ? 'terser' : 'esbuild',
      terserOptions: useTerserMinify ? terserOptions : undefined,
      rollupOptions: {
        input: {
          main: 'index.html',
          form: 'form.html'
        },
        plugins: terserPlugin ? [terserPlugin] : []
      }
    }
  }
})
