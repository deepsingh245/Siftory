import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { createChatGptMiddleware } from './server/chatgpt-middleware.mjs'
import { createMediaMiddleware } from './server/media-middleware.mjs'
import { createLibraryMiddleware } from './server/library-middleware.mjs'
import { createAppLinkMiddleware } from './server/app-link-middleware.mjs'

const privateFiles = [
  '.env', '.env.*', '*.{crt,pem,key,p12,pfx}', '**/.git/**',
  '**/.siftory/**', '**/data.json', '**/local-data/**', '**/user-data/**',
  '**/backups/**', '**/imports/**', '**/*.sqlite*', '**/*.siftory-backup*',
]

// https://vite.dev/config/
export default defineConfig({
  server: { host: 'localhost', strictPort: true, fs: { deny: privateFiles } },
  preview: { host: 'localhost', strictPort: true },
  plugins: [react(), {
    name: 'siftory-local-ai',
    configureServer(server) {
      const scheme = server.config.server.https ? 'https' : 'http'
      const library = createLibraryMiddleware(scheme)
      server.middlewares.use(library)
      server.middlewares.use(createChatGptMiddleware(scheme))
      server.middlewares.use(createMediaMiddleware(scheme))
      server.middlewares.use(createAppLinkMiddleware(scheme))
      server.httpServer?.once('close', library.close)
    },
    configurePreviewServer(server) {
      const scheme = server.config.preview.https ? 'https' : 'http'
      const library = createLibraryMiddleware(scheme)
      server.middlewares.use(library)
      server.middlewares.use(createChatGptMiddleware(scheme))
      server.middlewares.use(createMediaMiddleware(scheme))
      server.middlewares.use(createAppLinkMiddleware(scheme))
      server.httpServer.once('close', library.close)
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
