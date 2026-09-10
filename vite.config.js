import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createGenerateHandler } from './server.js';

export default defineConfig(({ mode }) => {
  const handler = createGenerateHandler({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  const configure = server => { server.middlewares.use((request, response, next) => {
    if (request.url === '/api/generate') return handler(request, response);
    next();
  }); };
  return { plugins: [react(), { name: 'gemini-api', configureServer: configure, configurePreviewServer: configure }] };
});
