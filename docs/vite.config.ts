import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    open: true,
    host: 'local.bigesj.com',
    proxy: {
      '/new': {
        // target: 'https://neweditor.bige.show/new',
        target: 'https://admin.bige.show/new',
        rewrite: (path) => path.replace(/^\/new/, ''),
        changeOrigin: true,
      },
    },
  }
})
