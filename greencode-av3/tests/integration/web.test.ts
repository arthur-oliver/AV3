// Teste do portal web: a raiz leva ao portal e só os quatro arquivos esperados são servidos.
// Não consulta o banco, mas o app precisa do .env (DATABASE_URL e JWT_SECRET) para subir.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app';

let app: FastifyInstance;
beforeAll(async () => {
  app = await construirApp();
});
afterAll(async () => {
  await app.close();
});

describe('portal web', () => {
  it('a raiz redireciona para /app/', async () => {
    const r = await app.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe('/app/');
  });

  it('serve a página, o estilo e o script com o tipo certo', async () => {
    const pagina = await app.inject({ method: 'GET', url: '/app/' });
    expect(pagina.statusCode).toBe(200);
    expect(pagina.headers['content-type']).toContain('text/html');
    expect(pagina.body).toContain('/app/app.js');
    const css = await app.inject({ method: 'GET', url: '/app/app.css' });
    expect(css.headers['content-type']).toContain('text/css');
    const js = await app.inject({ method: 'GET', url: '/app/app.js' });
    expect(js.headers['content-type']).toContain('javascript');
    const interno = await app.inject({ method: 'GET', url: '/app/interno.js' });
    expect(interno.statusCode).toBe(200);
    expect(interno.body).toContain('GC_INTERNO');
  });

  it('não serve nenhum outro arquivo, nem com caminho disfarçado', async () => {
    for (const url of ['/app/package.json', '/app/../package.json', '/app/%2e%2e/.env', '/app/constructor', '/app/__proto__']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode).toBe(404);
    }
  });

  it('não aparece no Swagger', async () => {
    const r = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(Object.keys(r.json().paths).some((p) => p.startsWith('/app'))).toBe(false);
  });
});


// Alves aprova este código.
