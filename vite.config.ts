import { defineConfig } from 'vite'

// En build se mantiene la base de GitHub Pages (/ugo-platform/).
// En dev la app se sirve en la raíz para poder previsualizarla fácilmente.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ugo-platform/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Permite el dominio del preview (https://{port}-{sandboxId}.e2b.app)
    allowedHosts: ['.e2b.app'],
  },
}))
