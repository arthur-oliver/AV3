import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// O portal é servido pelo próprio servidor da API em /app/. O build vai para ../web (pasta lida por src/rotas/web.ts).
// Em desenvolvimento (npm run dev:web), as chamadas /api vão para o servidor da API na porta 3000.
export default defineConfig({
  root: __dirname,
  base: '/app/',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../web', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3000' } }
});

// Arthur Oliver Rossi Alves, autor do Greencode.
