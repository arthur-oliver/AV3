import { defineConfig } from 'vitest/config';
import { urlBancoTeste } from './tests/setup/urlBancoTeste';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Os testes usam um banco próprio (nome do banco do .env + "_teste"), recriado a cada execução:
    // nada do que eles gravam aparece no banco do portal.
    globalSetup: ['tests/setup/bancoDeTeste.ts'],
    env: { DATABASE_URL: urlBancoTeste() },
    fileParallelism: false, // os testes de integração compartilham o mesmo banco
    testTimeout: 30000,
    hookTimeout: 120000
  }
});
