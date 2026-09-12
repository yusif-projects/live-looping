import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server lives on this port and nowhere else. dj-hands owns 5173, and
// Vite falls forward silently when a port is taken — strictPort turns that into
// an error, so a stale server shows up instead of hiding behind a new URL.
const DEV_PORT = 5180

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built `dist/` can be opened by any plain static
  // server (VS Code Live Server, `python -m http.server`, GitHub Pages subpaths)
  // without being mounted at the domain root.
  base: './',
  server: {
    port: DEV_PORT,
    strictPort: true,
  },
})
