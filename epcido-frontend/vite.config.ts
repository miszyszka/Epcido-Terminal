import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Firestore ładuje się osobno, tylko w trybie Firebase
    chunkSizeWarningLimit: 700,
  },
})
