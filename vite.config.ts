import { defineConfig } from 'vite'

// GitHub Pages sirve el sitio bajo /ugo-platform/ (el workflow de deploy valida esa ruta).
// En desarrollo/preview local el server escucha en toda la interfaz y acepta el host del preview.
export default defineConfig({
  base: '/ugo-platform/',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
