import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { officeApiPlugin } from './server/vite-plugin.ts'

// Un solo proceso: Vite sirve el frontend y el plugin officeApiPlugin expone
// /api/* (catálogos, CRUD de agentes y streaming NDJSON de las rondas).
// El plugin tiene acceso a Node, así que puede spawnear `copilot`.
export default defineConfig({
  plugins: [react(), officeApiPlugin()],
  server: {
    port: 5173,
  },
})
