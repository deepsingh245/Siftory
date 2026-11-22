import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { createChatGptMiddleware } from './server/chatgpt-middleware.mjs'
import { createMediaMiddleware } from './server/media-middleware.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'siftory-local-ai',
    configureServer(server) {
      server.middlewares.use(createChatGptMiddleware(server.config.server.https ? 'https' : 'http'))
      server.middlewares.use(createMediaMiddleware(server.config.server.https ? 'https' : 'http'))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createChatGptMiddleware(server.config.preview.https ? 'https' : 'http'))
      server.middlewares.use(createMediaMiddleware(server.config.preview.https ? 'https' : 'http'))
    },
  }],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
